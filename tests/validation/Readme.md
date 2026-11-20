# ROI Stats validation

Checks that ROI Stats shows the same six numbers nibabel computes from the file
(mean, population std, min, max, 25th and 75th percentile, all in display units),
on NiiVue and on Papaya, for several data types, a chosen intercept and three
storage orders. PixelExplorer uses the same patch and scaling code.

## Results

Captured 17 Nov 2026 with nibabel 5.4.2 in Chrome on Windows. Every position
matched on all six stats. The worst error everywhere is 0.005, which is the
panel's two decimal rounding. Full output is in `check_results.txt`.

### NiiVue (Slice:Drop Reloaded), 139,226 positions, 0 failed

| Volume | Stored as | Axial | Coronal | Sagittal | Total | At an edge | Failed |
|---|---|---|---|---|---|---|---|
| original | int16, slope 0.0197, inter 645.5, RAS | 10,658 | 6,689 | 2,566 | 19,913 | 2,353 | 0 |
| var_float32 | float32, RAS | 5,864 | 5,051 | 6,095 | 17,010 | 1,394 | 0 |
| var_int16 | int16, RAS | 6,726 | 4,536 | 5,013 | 16,275 | 1,977 | 0 |
| var_uint8 | uint8, slope 5.06, RAS | 6,157 | 4,360 | 4,428 | 14,945 | 2,256 | 0 |
| var_inter | int16, slope 0.05, inter −100, RAS | 6,315 | 6,068 | 6,157 | 18,540 | 2,797 | 0 |
| var_LAS | int16, LAS | 8,295 | 5,591 | 5,837 | 19,723 | 3,135 | 0 |
| var_PIR | int16, PIR, 256×256×160 | 7,536 | 6,951 | 8,445 | 22,932 | 3,938 | 0 |
| var_ASL | int16, ASL, 256×256×160 | 3,924 | 3,101 | 2,863 | 9,888 | 2,111 | 0 |

### Papaya (`tests/papaya/viewer.html`), 8,699 positions, 0 failed

| Volume | Axial | Coronal | Sagittal | Total | At an edge | Failed |
|---|---|---|---|---|---|---|
| original | 777 | 491 | 924 | 2,192 | 178 | 0 |
| var_float32 | 691 | 266 | 449 | 1,406 | 267 | 0 |
| var_LAS | 700 | 316 | 737 | 1,753 | 191 | 0 |
| var_PIR | 358 | 292 | 371 | 1,021 | 93 | 0 |
| var_ASL | 1,164 | 762 | 401 | 2,327 | 116 | 0 |

The float32 Papaya recording also holds 19 clicks outside the volume, made before
the adapter ignored them. `check.py` skips and counts those.

### What the results cover

- **Plane selection.** Every NiiVue recording includes multiplanar clicks, stored
  with the panel NiiVue reports as clicked. Papaya always shows three panels.
  Results are reported per plane.
- **Edges.** At an edge the patch is clipped (down to 5×5 in a corner) and the
  panel title shows the real size. `check.py` checks the title too.
- **Data types and scaling.** float32, int16, uint8, and the original's own
  non-zero intercept (645.5) plus a chosen one (−100).
- **Orientation.** LAS flips an axis. PIR and ASL reorder the axes, with unequal
  lengths. Orientation comes from the file's affine (sform, else qform), the
  same rule nibabel uses.

### Things found along the way

- **sub-003 is already scaled.** It is stored as int16 with slope 0.0197 and
  intercept 645.5, so the original file tests both scaling fields on its own.
- **Voxel boundaries.** In var_PIR, 1,212 positions sit exactly on the edge
  between two voxels, because the superior inferior axis is stored flipped. There
  NiiVue and a rounding of the world position pick neighboring voxels. `check.py`
  therefore uses the voxel NiiVue reports and counts boundary positions apart. A
  disagreement of more than one voxel would mean an orientation error. There were
  none.
- **Papaya and tilted scans.** sub-003 was acquired about 2.3° off axis. Papaya
  treats any rotation in the header as a reason to show the volume in world space,
  resampled onto its own grid, so all files here open in that mode. The Papaya
  adapter follows Papaya's own path from cursor to stored voxel in either mode,
  then maps stored voxels to RAS with the file's affine, so the patch is made of
  the file's voxels. `find_mapping.py` was used to find the axis mapping during
  development. It tries all 48 axis orders and flips against a recording.
- **Clicks outside the volume.** Papaya's world space grid is larger than the
  file, so a click can land outside it. The adapter ignores those, as NiiVue's
  crosshair cannot leave the volume.

## How to reproduce

### Setup

1. Download sub-003 from OpenNeuro ds004697 v1.0.1 into this folder:
   https://openneuro.org/crn/datasets/ds004697/snapshots/1.0.1/files/sub-003:ses-1:anat:sub-003_ses-1_T1w.nii.gz
2. `pip install nibabel==5.4.2` (5.4.1 is no longer on PyPI)
3. `python make_variants.py` writes the seven `var_*.nii.gz` copies and prints
   each one's type, scaling, orientation and round trip error. Each copy keeps the
   original's qform and sform so it differs only in what it tests. The output of
   our run is in `variants_log.txt`.

The volumes are left out of git and rebuilt by these steps.

### Quick check (no browser)

`python check.py VOLUME RECORDING` for any pair listed above, for example
`python check.py var_PIR.nii.gz rec_PIR.json`.

### NiiVue

1. Load the volume in a NiiVue page such as Slice:Drop Reloaded and run ROI Stats.
2. Paste `capture.js` in the console.
3. In multiplanar view, click in the axial, coronal and sagittal panels, including
   edges and corners. Add a few clicks in each single plane view.
4. `copy(JSON.stringify(rec))` and save it as `rec_NAME.json`
   (the original is `rec.json`).
5. `python check.py VOLUME rec_NAME.json`

### Papaya

1. Serve the repository root (`npm run dev`) and open
   `http://127.0.0.1:5501/tests/papaya/viewer.html?file=VOLUME`.
   The page loads Papaya, the local `dist/boostlet.min.js` and the volume.
2. Click ROI Stats, then paste `capture_papaya.js` in the console.
3. Click in all three panels, including edges.
4. Save `rec` as `recp_NAME.json` and run `python check.py VOLUME recp_NAME.json`.

Papaya's world coordinates do not follow the NIfTI affine, so Papaya recordings
store only the voxel and the boundary count is always 0.

## Files

| File | What it is |
|---|---|
| `make_variants.py` | writes the test copies |
| `capture.js` | NiiVue console script that records each crosshair move |
| `capture_papaya.js` | the same through Boostlet, for Papaya |
| `check.py` | compares recordings against nibabel, per plane |
| `find_mapping.py` | finds a viewer's axis mapping from a recording |
| `rec*.json`, `recp_*.json` | NiiVue and Papaya recordings |
| `check_results.txt` | `check.py` summaries for every recording |
| `variants_log.txt` | `make_variants.py` output |
| `make_scaled.py` | kept from the first version of this check |
