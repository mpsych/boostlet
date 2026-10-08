const CATEGORY = "Statistics";

if (typeof window._RoiStatsLoaded === 'undefined') {
window._RoiStatsLoaded = true;

(function() {

const NUMPY_TS_URL = 'https://cdn.jsdelivr.net/npm/numpy-ts@1.3.0/dist/numpy-ts.browser.js';

// half width of the roi in voxels so the full neighborhood is (2*HALF+1)^2
const HALF = 4;

const script = document.createElement('script');
script.type = 'text/javascript';
script.src = 'https://boostlet.org/dist/boostlet.min.js';
script.onload = function() {
  var poll = setInterval(function() {
    try {
      Boostlet.init();
      clearInterval(poll);
      run();
    } catch(e) {
      // framework not ready yet keep polling
    }
  }, 300);
};
document.head.appendChild(script);

function run() {
  if (Boostlet.framework.name !== 'niivue') {
    alert('Only niivue is supported right now :(');
    return;
  }
  const nv = Boostlet.framework.instance;
  setup(nv);
}

async function setup(nv) {
  plot();

  // load numpy-ts directly no boostlet wrapper needed
  const np = await import(NUMPY_TS_URL);

  const existingOnLocationChange = nv.onLocationChange;

  const triggerUpdate = async function(loc) {
    if (existingOnLocationChange) existingOnLocationChange(loc);
    if (!nv.volumes || !nv.volumes.length) return;

    const v = [Math.round(loc.vox[0]), Math.round(loc.vox[1]), Math.round(loc.vox[2])];

    const start = [v[0] - HALF, v[1] - HALF, v[2] - HALF];
    const end   = [v[0] + HALF, v[1] + HALF, v[2] + HALF];

    const fixedAxis = nv.opts.sliceType === 2 ? 0
                    : nv.opts.sliceType === 1  ? 1 : 2;
    start[fixedAxis] = end[fixedAxis] = Math.round((start[fixedAxis] + end[fixedAxis]) / 2);

    const { data } = Boostlet.get_subvolume(start, end);
    if (!data || data.length === 0) return;

    const result = computeStats(np, data, nv.volumes[0]);
    updatePanel(result);
  };

  nv.onLocationChange = triggerUpdate;

  // fire immediately so panel populates on load
  const pos = nv.scene.crosshairPos;
  const dims = nv.volumes[0].dims;
  // floor matches how niivue maps crosshair position to a voxel
  triggerUpdate({ vox: [
    Math.min(Math.floor(pos[0] * dims[1]), dims[1] - 1),
    Math.min(Math.floor(pos[1] * dims[2]), dims[2] - 1),
    Math.min(Math.floor(pos[2] * dims[3]), dims[3] - 1)
  ]});
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
    <div style="font-size:11px;color:#aaa;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.08em;">ROI Stats (${HALF*2+1}×${HALF*2+1})</div>
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
function computeStats(np, data, volume) {
  const slope = (volume && volume.hdr.scl_slope) || 1;
  const inter = (volume && volume.hdr.scl_inter) || 0;
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
