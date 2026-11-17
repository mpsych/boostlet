const CATEGORY = "Visualization"

if (typeof window._PixelExplorerLoaded === 'undefined') {
window._PixelExplorerLoaded = true;

(function() {

const HALF = 4;

// load boostlet once then wait for niivue with a loaded volume
if (window.Boostlet) {
  waitForViewer();
} else {
  const script = document.createElement("script");
  script.src = "https://boostlet.org/dist/boostlet.min.js";
  script.onload = waitForViewer;
  document.head.appendChild(script);
}

function waitForViewer() {
  let tries = 0;
  const poll = setInterval(function() {
    try { Boostlet.init(); } catch(e) {}
    const fw = Boostlet.framework;
    const ready = fw && fw.name === 'niivue' && fw.instance.volumes && fw.instance.volumes.length;
    if (!ready && ++tries <= 40) return;
    clearInterval(poll);
    if (ready) {
      setup(fw.instance);
      Boostlet.hint('PixelExplorer loaded', 2500);
      return;
    }
    // init falls back to a plain canvas so no niivue after 12 seconds means there is none
    // clearing the flag lets the bookmark be clicked again
    delete window._PixelExplorerLoaded;
    Boostlet.hint('PixelExplorer found no NiiVue viewer with a loaded volume', 5000);
  }, 300);
}

function setup(nv) {
  // create the panel once
  plot();

  // save the existing onLocationChange so we don't clobber it
  const existingOnLocationChange = nv.onLocationChange;

  // hook into location change — fires on every crosshair move / slice change
  // fire once immediately so the panel is populated on load without requiring a click
  const triggerUpdate = function(loc) {
    if (existingOnLocationChange) existingOnLocationChange(loc);

    if (!nv.volumes || !nv.volumes.length) return;

    const v = [Math.round(loc.vox[0]), Math.round(loc.vox[1]), Math.round(loc.vox[2])];

    const start = [v[0] - HALF, v[1] - HALF, v[2] - HALF];
    const end   = [v[0] + HALF, v[1] + HALF, v[2] + HALF];

    // boostlet knows the plane as 0 axial 1 coronal 2 sagittal
    // in multiplanar that is the panel which was clicked last
    // a boostlet build from before get_plane only knows single plane views
    const view = nv.opts.sliceType;
    const plane = Boostlet.get_plane ? Boostlet.get_plane(loc) : (view === 1 || view === 2) ? view : 0;

    // collapse the axis perpendicular to that plane to a single voxel
    // axial holds z and coronal holds y and sagittal holds x
    const fixedAxis = 2 - plane;
    start[fixedAxis] = end[fixedAxis] = v[fixedAxis];

    const { data, dims } = Boostlet.get_subvolume(start, end);
    if (data && dims) {
      // the two axes that lie in the plane, first is drawn across and second up
      const [ax, ay] = [0, 1, 2].filter(a => a !== fixedAxis);
      // at a volume edge the block comes back clipped
      // a negative start tells how many cells are missing on the low side
      const skip = [Math.max(0, -start[ax]), Math.max(0, -start[ay])];
      const mc = document.getElementById('PixelExplorerCanvas');
      if (mc) drawMatrix(data, dims[ax], dims[ay], skip, mc);
    }
  };

  nv.onLocationChange = triggerUpdate;

  // make a loc object from current crosshair state so the panel fills immediately
  const pos = nv.scene.crosshairPos;
  const dims = nv.volumes[0].dims;
  // floor matches how niivue maps crosshair position to a voxel
  const initialVox = [
    Math.min(Math.floor(pos[0] * dims[1]), dims[1] - 1),
    Math.min(Math.floor(pos[1] * dims[2]), dims[2] - 1),
    Math.min(Math.floor(pos[2] * dims[3]), dims[3] - 1)
  ];
  triggerUpdate({ vox: initialVox });
}

// render voxel values as a labeled grayscale grid
// the grid is always 9 by 9 with the crosshair voxel in the middle
// cells that fall outside the volume stay dark and unlabeled
function drawMatrix(data, cols, rows, skip, mc) {
  const nv = Boostlet.framework.instance;
  const { cal_min, cal_max } = nv.volumes[0];
  const range = cal_max - cal_min || 1;
  const ctx = mc.getContext('2d');

  // apply nifti slope/intercept to convert raw values to display values.
  // raw voxel values can be stored in arbitrary units (e.g. large negatives like -9000)
  // and need to be scaled to match what NiiVue actually displays: display_value = raw * slope + inter
  const slope = nv.volumes[0].hdr.scl_slope || 1;
  const inter = nv.volumes[0].hdr.scl_inter || 0;

  const N = HALF * 2 + 1;
  const cell = Math.floor(mc.width / N);

  // narrow intensity ranges need decimals or every label reads 0 or 1
  const decimals = range >= 100 ? 0 : range >= 10 ? 1 : 2;

  ctx.font = `${Math.max(Math.floor(cell * 0.28), 6)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#301818';
  ctx.fillRect(0, 0, mc.width, mc.height);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = data[c + r * cols] * slope + inter;
      const norm = (val - cal_min) / range;
      const g = Math.round(norm * 255);

      // row 0 of the data is the bottom of the grid
      const x = (c + skip[0]) * cell;
      const y = (N - 1 - (r + skip[1])) * cell;

      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(x, y, cell, cell);

      ctx.fillStyle = norm > 0.55 ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)';
      ctx.fillText(val.toFixed(decimals), x + cell / 2, y + cell / 2);
    }
  }
}

function plot() {
  // remove existing panel if re-run
  const existing = document.getElementById('PixelExplorerDiv');
  if (existing) existing.remove();

  let container = window.document.createElement('div');
  container.id = 'PixelExplorerDiv';
  container.style.cssText = 'position:fixed; top:10px; left:10px; z-index:2147483647; cursor:move; border:2px solid #fff; box-shadow:0 0 0 1px #000; border-radius:3px; overflow:hidden; line-height:0;';
  window.document.body.appendChild(container);

  const size = Math.floor(400 / (HALF * 2 + 1)) * (HALF * 2 + 1);

  const mc = document.createElement('canvas');
  mc.id = 'PixelExplorerCanvas';
  mc.width = size;
  mc.height = size;
  mc.style.cssText = `display:block; width:${size}px; height:${size}px;`;
  container.appendChild(mc);

  // drag logic
  let startX, startY, startLeft, startTop;
  container.addEventListener('mousedown', function(e) {
    startX = e.clientX;
    startY = e.clientY;
    startLeft = container.offsetLeft;
    startTop = container.offsetTop;

    function onMove(e) {
      container.style.left = (startLeft + e.clientX - startX) + 'px';
      container.style.top  = (startTop  + e.clientY - startY) + 'px';
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

})();
}
