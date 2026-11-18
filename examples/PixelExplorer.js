// plain assignment since powerboost loads plugins as page scripts that share one scope
CATEGORY = "Visualization"

if (typeof window._PixelExplorerLoaded === 'undefined') {
window._PixelExplorerLoaded = true;

(function() {

const HALF = 4;

// load boostlet once then wait for a viewer with a loaded volume
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
    // any viewer whose adapter can read voxels works so niivue and papaya both do
    const ready = Boostlet.has_volume && Boostlet.has_volume();
    if (!ready && ++tries <= 40) return;
    clearInterval(poll);
    if (ready) {
      setup();
      Boostlet.hint('PixelExplorer loaded on ' + Boostlet.framework.name, 2500);
      return;
    }
    // init falls back to a plain canvas so no viewer after 12 seconds means there is none
    // clearing the flag lets the bookmark be clicked again
    delete window._PixelExplorerLoaded;
    Boostlet.hint('PixelExplorer found no supported viewer with a loaded volume', 5000);
  }, 300);
}

function setup() {
  // create the panel once
  plot();

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

  Boostlet.on_location_change(triggerUpdate);
  triggerUpdate({ vox: Boostlet.get_crosshair_vox() });
}

// render voxel values as a labeled grayscale grid
// the grid is always 9 by 9 with the crosshair voxel in the middle
// cells that fall outside the volume stay dark and unlabeled
function drawMatrix(data, cols, rows, skip, mc) {
  // display value is raw times slope plus inter and the window maps cal_min to black
  const { slope, inter, cal_min, cal_max } = Boostlet.get_scaling();
  const range = cal_max - cal_min || 1;
  const ctx = mc.getContext('2d');

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
