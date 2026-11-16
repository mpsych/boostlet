# compare ROI Stats panel values (rec.json) against nibabel
# usage: python check.py [volume.nii.gz] [rec.json]
import json, sys, nibabel as nib, numpy as np

path = sys.argv[1] if len(sys.argv) > 1 else 'sub-003_scaled.nii.gz'
recs = json.load(open(sys.argv[2] if len(sys.argv) > 2 else 'rec.json'))

# reorder to RAS so axis 0 is left to right, 1 is back to front, 2 is bottom to top
img = nib.as_closest_canonical(nib.load(path))
vol = img.get_fdata()
to_vox = np.linalg.inv(img.affine)
names = {0: 'axial', 1: 'coronal', 2: 'sagittal'}

def voxel(r):
    # newer captures store the world position, which does not depend on storage order
    if 'mm' in r:
        return [int(x) for x in np.rint(to_vox @ [*r['mm'], 1])[:3]]
    v = r['vox']
    return [int(v[k]) for k in ('0', '1', '2')] if isinstance(v, dict) else [int(x) for x in v]

def patch(c, plane):
    # axial holds z, coronal holds y, sagittal holds x
    fixed = 2 - plane
    lo = [max(x - 4, 0) for x in c]
    hi = [x + 5 for x in c]
    lo[fixed], hi[fixed] = c[fixed], c[fixed] + 1
    return vol[lo[0]:hi[0], lo[1]:hi[1], lo[2]:hi[2]]

def error(r, p):
    ref = dict(mean=p.mean(), std=p.std(), min=p.min(), max=p.max(),
               p25=np.percentile(p, 25), p75=np.percentile(p, 75))
    return max(abs(r[k] - v) for k, v in ref.items())

# the plane the plugin should use: a single plane view decides it, otherwise the
# clicked panel does, and a move without a click keeps the previous plane
plane = 0
tally = {n: dict(n=0, edge=0, fails=0, worst=0.0) for n in names.values()}
for r in recs:
    c = voxel(r)
    view, clicked = r.get('view'), r.get('clicked')
    if view in (0, 1, 2):
        plane = view
    elif clicked in (0, 1, 2):
        plane = clicked
    elif view is None:
        # captures from before the view was stored, so try each plane
        plane = min((error(r, patch(c, f)), f) for f in (0, 1, 2))[1]
    p = patch(c, plane)
    err = error(r, p)
    fixed = 2 - plane
    size = [n for i, n in enumerate(p.shape) if i != fixed]
    notes = []
    if err >= 0.01:
        notes.append(f'OFF by {err:.3f}')
    if 'title' in r and r['title'] != f'ROI Stats ({size[0]}×{size[1]})':
        notes.append(f"title says {r['title']}, patch is {size[0]}x{size[1]}")
    t = tally[names[plane]]
    t['n'] += 1
    t['edge'] += p.size < 81
    t['fails'] += bool(notes)
    t['worst'] = max(t['worst'], err)
    print(c, names[plane], f'{size[0]}x{size[1]}', '; '.join(notes) or 'ok')

print()
for name, t in tally.items():
    print(f"{name:9s} {t['n']:3d} positions, {t['edge']:3d} at an edge, {t['fails']:3d} failed, worst error {t['worst']:.4f}")
print(len(recs), 'positions,', sum(t['fails'] for t in tally.values()), 'failed, worst error',
      max(t['worst'] for t in tally.values()))
