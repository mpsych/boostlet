# find how a viewer's reported voxel maps onto the ras volume
# tries every axis order and flip and reports which one reproduces the recorded stats
# usage: py find_mapping.py volume.nii.gz rec.json
import json, sys, itertools, nibabel as nib, numpy as np

vol = nib.as_closest_canonical(nib.load(sys.argv[1])).get_fdata()
recs = json.load(open(sys.argv[2], encoding='utf-8-sig'))
# skip flat background where every mapping looks right
recs = [r for r in recs if r['std'] > 1][:300]
D = vol.shape

def stats(p):
    return np.array([p.mean(), p.std(), p.min(), p.max(), np.percentile(p, 25), np.percentile(p, 75)])

results = []
for perm in itertools.permutations(range(3)):
    for flip in itertools.product((False, True), repeat=3):
        # claimed axis j is true axis perm[j], read backwards when flipped
        dc = [D[perm[j]] for j in range(3)]
        fails = 0
        for r in recs:
            v = [int(x) for x in r['vox']]
            fixed = 2 - r['clicked']
            lo = [max(v[j] - 4, 0) for j in range(3)]
            hi = [min(v[j] + 4, dc[j] - 1) for j in range(3)]
            lo[fixed] = hi[fixed] = v[fixed]
            if any(lo[j] > hi[j] or v[j] >= dc[j] for j in range(3)):
                fails += 1
                continue
            vals = []
            for c in itertools.product(*[range(lo[j], hi[j] + 1) for j in range(3)]):
                t = [0, 0, 0]
                for j in range(3):
                    t[perm[j]] = D[perm[j]] - 1 - c[j] if flip[j] else c[j]
                vals.append(vol[t[0], t[1], t[2]])
            ref = stats(np.array(vals))
            got = np.array([r[k] for k in ('mean', 'std', 'min', 'max', 'p25', 'p75')])
            fails += np.abs(ref - got).max() >= 0.01
        results.append((fails, perm, flip))

results.sort(key=lambda x: x[0])
print(len(recs), 'positions tried')
for fails, perm, flip in results[:5]:
    print(f'{fails:4d} failed  claimed axes come from true axes {perm} flipped {flip}')
