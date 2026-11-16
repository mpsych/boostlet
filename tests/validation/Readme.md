# ROI Stats validation

Checks that ROI Stats shows the same numbers nibabel computes from the file.
sub-003 has scl_slope = 1, which can't catch a scaling bug, so we re-store it
as int16 and let nibabel pick a real slope.

Note: the OpenNeuro viewer reports scl_slope 0.0197 and scl_inter 645.5 for the
original file. `make_variants.py` prints the original's slope and intercept, so
run it once and correct the paragraph above if they are not 1 and 0.

## Quick check (no browser)

Uses the recorded `rec.json` from our run.

1. Download sub-003 from OpenNeuro ds004697 v1.0.1:
   https://openneuro.org/crn/datasets/ds004697/snapshots/1.0.1/files/sub-003:ses-1:anat:sub-003_ses-1_T1w.nii.gz
2. `pip install nibabel==5.4.1`
3. `python make_scaled.py` (should print scl_slope 0.0197)
4. `python check.py`

## Full check

Do steps 1 to 3, then:

1. Load `sub-003_scaled.nii.gz` in NiiVue and run ROI Stats
2. Paste `capture.js` in the console
3. In multiplanar view, click in the axial, coronal and sagittal panels, and
   include positions at the volume edges and corners. Repeat a few clicks in
   each single plane view.
4. Run `copy(JSON.stringify(rec))` and save it as `rec.json`
5. `python check.py sub-003_scaled.nii.gz rec.json`

`capture.js` records the world position, the viewer layout, the panel NiiVue
reports as clicked and the panel title. `check.py` works out which plane the
plugin should have used from those, looks the patch up by world position, and
prints one line per position and a summary per plane. It also checks that the
title shows the real patch size at an edge.

## Other data types, intercept and axis orders

`python make_variants.py` writes copies of sub-003 as float32, int16 and uint8,
one with a chosen slope and intercept (0.05 and -100), and three stored in
other axis orders (LAS, PIR, ASL). For each one, load it in NiiVue, capture as
above, and run `python check.py var_NAME.nii.gz rec_NAME.json`. Because the
check uses world positions, the same script works for every axis order.

## Result

46 positions across axial, coronal and sagittal views. All six stats matched
at every position. Worst error 0.005, which is the panel's 2 decimal rounding.

`rec.json` was captured before `capture.js` saved the view, and before ROI
Stats followed the clicked panel in multiplanar view, so `check.py` works out
the plane for those entries. It needs to be captured again with the current
scripts.
