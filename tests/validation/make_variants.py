# write test copies of sub-003 covering data types, a chosen intercept and other axis orders
# each copy keeps the original's qform and sform so it differs only in what it tests
import nibabel as nib, numpy as np
from nibabel.affines import apply_affine
from nibabel.orientations import axcodes2ornt, io_orientation, ornt_transform, apply_orientation, inv_ornt_aff

src = nib.load('sub-003_ses-1_T1w.nii.gz')
data = src.get_fdata().astype(np.float32)
qform, qcode = src.get_qform(coded=True)
sform, scode = src.get_sform(coded=True)
print('original', src.get_data_dtype(), src.shape, 'slope', src.dataobj.slope, 'inter', src.dataobj.inter,
      ''.join(nib.aff2axcodes(src.affine)), 'qform code', int(qcode), 'sform code', int(scode))
# how far apart the two matrices are which is why both have to be kept
print('largest qform sform difference', float(np.abs(qform - sform).max()))

def save(name, arr, q, s, dtype, slope=None, inter=None):
    if slope is None:
        img = nib.Nifti1Image(arr, s)
        img.set_data_dtype(dtype)
    else:
        # nibabel keeps a header slope but writes the array unscaled
        # so store the raw values ourselves
        raw = np.round((arr - inter) / slope).astype(dtype)
        img = nib.Nifti1Image(raw, s)
        img.header.set_slope_inter(slope, inter)
    # both matrices and their codes as in the original
    # writing the sform into both would make some viewers read the file as rotated
    img.set_qform(q, int(qcode))
    img.set_sform(s, int(scode))
    nib.save(img, name)
    back = nib.load(name)
    # round trip error shows how much the stored type costs, and that the scaling was applied
    print(name, back.get_data_dtype(), back.shape, 'slope', back.dataobj.slope, 'inter', back.dataobj.inter,
          ''.join(nib.aff2axcodes(back.affine)), 'max round trip error', float(np.abs(back.get_fdata() - arr).max()))

# data types, nibabel picks the scaling for the integer ones
save('var_float32.nii.gz', data, qform, sform, np.float32)
save('var_int16.nii.gz', data, qform, sform, np.int16)
save('var_uint8.nii.gz', data, qform, sform, np.uint8)

# a slope and intercept chosen here, so the intercept is known not to be zero
save('var_inter.nii.gz', data, qform, sform, np.int16, slope=0.05, inter=-100.0)

# check a reordered copy holds the same value at the same world position as the original
# a 10 by 10 by 10 grid of voxels including the edges goes through the original affine and back through the copy's
def check_world(name):
    back = nib.load(name)
    vals = back.get_fdata()
    axes = [np.linspace(0, s - 1, 10).astype(int) for s in data.shape]
    ijk = np.stack(np.meshgrid(*axes, indexing='ij'), -1).reshape(-1, 3)
    world = apply_affine(src.affine, ijk)
    ijk2 = np.rint(apply_affine(np.linalg.inv(back.affine), world)).astype(int)
    err = np.abs(vals[tuple(ijk2.T)] - data[tuple(ijk.T)]).max()
    print(name, 'world lookup error', float(err))

# other storage orders, the reordered axes have unequal lengths
# the data and both matrices are reordered the same way
for codes in ('LAS', 'PIR', 'ASL'):
    ornt = ornt_transform(io_orientation(src.affine), axcodes2ornt(tuple(codes)))
    back_to_old = inv_ornt_aff(ornt, data.shape)
    save(f'var_{codes}.nii.gz', apply_orientation(data, ornt).astype(np.float32),
         qform @ back_to_old, sform @ back_to_old, np.int16)
    check_world(f'var_{codes}.nii.gz')
