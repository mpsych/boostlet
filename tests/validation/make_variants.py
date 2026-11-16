# write test copies of sub-003 covering data types, a chosen intercept and other axis orders
import nibabel as nib, numpy as np
from nibabel.orientations import axcodes2ornt, io_orientation, ornt_transform

src = nib.load('sub-003_ses-1_T1w.nii.gz')
data = src.get_fdata().astype(np.float32)
print('original', src.get_data_dtype(), src.shape, 'slope', src.dataobj.slope, 'inter', src.dataobj.inter,
      ''.join(nib.aff2axcodes(src.affine)))

def save(name, arr, affine, dtype, slope=None, inter=None):
    img = nib.Nifti1Image(arr, affine)
    img.set_data_dtype(dtype)
    if slope is not None:
        img.header.set_slope_inter(slope, inter)
    nib.save(img, name)
    back = nib.load(name)
    # round trip error shows how much the stored type costs, and that the scaling was applied
    print(name, back.get_data_dtype(), back.shape, 'slope', back.dataobj.slope, 'inter', back.dataobj.inter,
          ''.join(nib.aff2axcodes(back.affine)), 'max round trip error', float(np.abs(back.get_fdata() - arr).max()))

# data types, nibabel picks the scaling for the integer ones
save('var_float32.nii.gz', data, src.affine, np.float32)
save('var_int16.nii.gz', data, src.affine, np.int16)
save('var_uint8.nii.gz', data, src.affine, np.uint8)

# a slope and intercept chosen here, so the intercept is known not to be zero
save('var_inter.nii.gz', data, src.affine, np.int16, slope=0.05, inter=-100.0)

# other storage orders, the reordered axes have unequal lengths
for codes in ('LAS', 'PIR', 'ASL'):
    ornt = ornt_transform(io_orientation(src.affine), axcodes2ornt(tuple(codes)))
    re = nib.Nifti1Image(data, src.affine).as_reoriented(ornt)
    save(f'var_{codes}.nii.gz', np.asarray(re.dataobj, dtype=np.float32), re.affine, np.int16)
