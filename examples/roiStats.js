// plain assignment since powerboost loads plugins as page scripts that share one scope
CATEGORY = "Statistics";

if (typeof window._RoiStatsLoaded === 'undefined') {
window._RoiStatsLoaded = true;

(function() {

const NUMPY_TS_URL = 'https://cdn.jsdelivr.net/npm/numpy-ts@1.3.0/dist/numpy-ts.browser.js';

// half width of the roi in voxels so the full neighborhood is (2*HALF+1)^2
const HALF = 4;

// load boostlet once then wait for a viewer with a loaded volume
if (window.Boostlet) {
  waitForViewer();
} else {
  const script = document.createElement('script');
  script.src = 'https://boostlet.org/dist/boostlet.min.js';
  script.onload = waitForViewer;
  document.head.appendChild(script);
}

function waitForViewer() {
  let tries = 0;
  const poll = setInterval(function() {
    try { Boostlet.init(); } catch(e) {}
    // any viewer whose adapter can read voxels works so niivue and papaya both do
    const ready = Boostlet.has_volume && Boostlet.has_volume();
    if (!ready && ++tries <= 40) return;
    clearInterval(poll);
    if (ready) {
      // setup waits on numpy-ts so say loaded only once it is in
      setup()
        .then(() => Boostlet.hint('ROI Stats loaded on ' + Boostlet.framework.name, 2500))
        .catch(() => {
          delete window._RoiStatsLoaded;
          Boostlet.hint('ROI Stats could not load numpy-ts', 5000);
        });
      return;
    }
    // init falls back to a plain canvas so no viewer after 12 seconds means there is none
    // clearing the flag lets the bookmark be clicked again
    delete window._RoiStatsLoaded;
    Boostlet.hint('ROI Stats found no supported viewer with a loaded volume', 5000);
  }, 300);
}

async function setup() {
  plot();

  // load numpy-ts directly no boostlet wrapper needed
  const np = await import(NUMPY_TS_URL);

  // runs on every crosshair move and once now so the panel fills on load
  const triggerUpdate = function(loc) {
    if (!Boostlet.has_volume()) return;

    const v = [Math.round(loc.vox[0]), Math.round(loc.vox[1]), Math.round(loc.vox[2])];

    const start = [v[0] - HALF, v[1] - HALF, v[2] - HALF];
    const end   = [v[0] + HALF, v[1] + HALF, v[2] + HALF];

    // boostlet knows the plane as 0 axial 1 coronal 2 sagittal
    // in multiplanar that is the panel which was clicked last
    const plane = Boostlet.get_plane(loc);

    // collapse the axis perpendicular to that plane to a single voxel
    // axial holds z and coronal holds y and sagittal holds x
    const fixedAxis = 2 - plane;
    start[fixedAxis] = end[fixedAxis] = v[fixedAxis];

    const { data, dims } = Boostlet.get_subvolume(start, end);
    if (!data || data.length === 0) return;

    // at a volume edge the patch is clipped so show its real size
    const size = Array.from(dims).filter((d, i) => i !== fixedAxis);
    document.getElementById('roi-title').textContent = `ROI Stats (${size[0]}×${size[1]})`;

    const result = computeStats(np, data, Boostlet.get_scaling());
    updatePanel(result);
  };

  Boostlet.on_location_change(triggerUpdate);
  triggerUpdate({ vox: Boostlet.get_crosshair_vox() });
}

// write computed stats into the panel dom elements
function updatePanel(s) {
  document.getElementById('roi-mean').textContent = s.mean.toFixed(2);
  document.getElementById('roi-std').textContent  = s.std.toFixed(2);
  document.getElementById('roi-min').textContent  = s.min.toFixed(2);
  document.getElementById('roi-max').textContent  = s.max.toFixed(2);
  document.getElementById('roi-p25').textContent  = s.p25.toFixed(2);
  document.getElementById('roi-p75').textContent  = s.p75.toFixed(2);
}

// create and inject the stats panel remove any existing one first
function plot() {
  const existing = document.getElementById('RoiStatsDiv');
  if (existing) existing.remove();

  const div = document.createElement('div');
  div.id = 'RoiStatsDiv';
  div.style.cssText = `
    position: fixed; top: 10px; right: 10px; z-index: 2147483647;
    background: rgba(0,0,0,0.85); color: #fff;
    font-family: monospace; font-size: 13px;
    padding: 12px 16px; border-radius: 6px;
    border: 1px solid #444; min-width: 160px;
    cursor: move; line-height: 2;
  `;

  div.innerHTML = `
    <div id="roi-title" style="font-size:11px;color:#aaa;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.08em;">ROI Stats (${HALF*2+1}×${HALF*2+1})</div>
    <div>mean <span id="roi-mean" style="float:right;color:#7cf">—</span></div>
    <div>std  <span id="roi-std"  style="float:right;color:#7cf">—</span></div>
    <div>min  <span id="roi-min"  style="float:right;color:#7cf">—</span></div>
    <div>max  <span id="roi-max"  style="float:right;color:#7cf">—</span></div>
    <div>p25  <span id="roi-p25"  style="float:right;color:#7cf">—</span></div>
    <div>p75  <span id="roi-p75"  style="float:right;color:#7cf">—</span></div>
  `;

  document.body.appendChild(div);

  // drag logic
  let startX, startY, startRight, startTop;
  div.addEventListener('mousedown', function(e) {
    startX     = e.clientX;
    startY     = e.clientY;
    startRight = div.offsetLeft;
    startTop   = div.offsetTop;
    function onMove(e) {
      div.style.left  = (startRight + e.clientX - startX) + 'px';
      div.style.top   = (startTop  + e.clientY - startY) + 'px';
      div.style.right = 'auto';
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// inline stat functions using numpy-ts directly
// apply nifti slope/intercept then compute all stats in one pass
function computeStats(np, data, scaling) {
  const { slope, inter } = scaling;
  // pass the typed array directly, Array.from is a slow extra copy
  const raw = np.array(data, 'float32');
  const scaled = raw.multiply(slope);
  const a = scaled.add(inter);
  // free any array results too, this runs on every crosshair move
  const scalar = v => {
    const n = typeof v === 'number' ? v : v.tolist ? v.tolist() : Number(v);
    v?.dispose?.();
    return n;
  };
  const stats = {
    mean : scalar(np.mean(a)),
    std  : scalar(np.std(a)),
    min  : scalar(np.min(a)),
    max  : scalar(np.max(a)),
    p25  : scalar(np.percentile(a, 25)),
    p75  : scalar(np.percentile(a, 75)),
  };
  for (const x of [raw, scaled, a]) x.dispose?.();
  return stats;
}

})();
}
