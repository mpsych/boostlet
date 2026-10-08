# compare ROI Stats panel values (rec.json) against nibabel
import json, nibabel as nib, numpy as np

vol = nib.as_closest_canonical(nib.load('sub-003_scaled.nii.gz')).get_fdata()
names = {0: 'sagittal', 1: 'coronal', 2: 'axial'}
# niivue sliceType to the axis roiStats collapses
view_axis = {0: 2, 1: 1, 2: 0}

def patch(x, y, z, fixed):
    lo = [max(c - 4, 0) for c in (x, y, z)]
    hi = [c + 5 for c in (x, y, z)]
    lo[fixed], hi[fixed] = (x, y, z)[fixed], (x, y, z)[fixed] + 1
    return vol[lo[0]:hi[0], lo[1]:hi[1], lo[2]:hi[2]]

def error(r, p):
    ref = dict(mean=p.mean(), std=p.std(), min=p.min(), max=p.max(),
               p25=np.percentile(p, 25), p75=np.percentile(p, 75))
    return max(abs(r[k] - v) for k, v in ref.items())

recs = json.load(open('rec.json'))
worst, fails = 0, 0
for r in recs:
    v = r['vox']
    x, y, z = (int(v[k]) for k in ('0', '1', '2')) if isinstance(v, dict) else v
    if 'view' in r:
        fixed = view_axis[r['view']]
        err = error(r, patch(x, y, z, fixed))
    else:
        # older captures have no view, so try each plane
        err, fixed = min((error(r, patch(x, y, z, f)), f) for f in (2, 1, 0))
    worst = max(worst, err)
    if err >= 0.01: fails += 1
    print([x, y, z], names[fixed], 'ok' if err < 0.01 else f'OFF by {err:.3f}')
print(len(recs), 'positions,', fails, 'failed, worst error', worst)
