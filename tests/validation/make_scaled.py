# re-store the volume as int16 so nibabel picks a nontrivial scl_slope
import nibabel as nib, numpy as np

img = nib.load('sub-003_ses-1_T1w.nii.gz')
out = nib.Nifti1Image(img.get_fdata().astype(np.float32), img.affine)
out.set_data_dtype(np.int16)
nib.save(out, 'sub-003_scaled.nii.gz')
print('scl_slope', nib.load('sub-003_scaled.nii.gz').dataobj.slope)
