# ROI Stats validation

Checks that ROI Stats shows the same numbers nibabel computes from the file.
sub-003 has scl_slope = 1, which can't catch a scaling bug, so we re-store it
as int16 and let nibabel pick a real slope.

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
2. Paste `capture.js` in the console and click around in all three views
3. Run `copy(JSON.stringify(rec))` and save it as `rec.json`
4. `python check.py`

## Result

46 positions across axial, coronal and sagittal views. All six stats matched
at every position. Worst error 0.005, which is the panel's 2 decimal rounding.

`rec.json` was captured before `capture.js` saved the view, so `check.py`
works out the plane for those entries.
