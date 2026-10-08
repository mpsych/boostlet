const CATEGORY = "Visualization"

if (typeof window._PixelExplorerLoaded === 'undefined') {
window._PixelExplorerLoaded = true;

(function() {

const script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";
script.onload = function() {
  /// wait for nv and volumes before calling init
  // calling init too early means niivue won't be detected yet
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

const HALF = 4;

function run() {
  if (Boostlet.framework.name !== 'niivue') {
    alert('Only niivue is supported right now :(');
    return;
  }

  const nv = Boostlet.framework.instance;
  setup(nv);
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

    // collapse the axis perpendicular to the current slice to a single voxel
    // 2 = sagittal (x axis), 1 = coronal (y axis), default axial (z axis)
    const fixedAxis = nv.opts.sliceType === 2 ? 0
                    : nv.opts.sliceType === 1  ? 1 : 2;
    start[fixedAxis] = end[fixedAxis] = Math.round((start[fixedAxis] + end[fixedAxis]) / 2);

    const { data, dims } = Boostlet.get_subvolume(start, end);
    if (data && dims) {
      const mc = document.getElementById('PixelExplorerCanvas');
      if (mc) drawMatrix(data, dims, mc);
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
function drawMatrix(data, dims, mc) {
  const nv = Boostlet.framework.instance;
  const { cal_min, cal_max } = nv.volumes[0];
  const range = cal_max - cal_min || 1;
  const ctx = mc.getContext('2d');

  // apply nifti slope/intercept to convert raw values to display values.
  // raw voxel values can be stored in arbitrary units (e.g. large negatives like -9000)
  // and need to be scaled to match what NiiVue actually displays: display_value = raw * slope + inter
  const slope = nv.volumes[0].hdr.scl_slope || 1;
  const inter = nv.volumes[0].hdr.scl_inter || 0;

  // getVolumeData returns dims as X Y Z and the collapsed axis has size 1
  // the first non-1 dim is cols, second is rows
  const [cols, rows] = dims.filter(d => d > 1);
  if (!cols || !rows) return;

  const cell = Math.floor(Math.min(mc.width / cols, mc.height / rows));
  if (cell < 1) return;

  const showLabels = cell >= 8;
  if (showLabels) {
    ctx.font = `${Math.max(Math.floor(cell * 0.28), 6)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
  }

  ctx.clearRect(0, 0, mc.width, mc.height);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const raw = data[c + (rows - 1 - r) * cols];
      const val = raw * slope + inter;
      const norm = (val - cal_min) / range;
      const g = Math.round(norm * 255);

      ctx.fillStyle = `rgb(${g},${g},${g})`;
      ctx.fillRect(c * cell, r * cell, cell, cell);

      if (showLabels) {
        ctx.fillStyle = norm > 0.55 ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)';
        ctx.fillText(val.toFixed(0), c * cell + cell / 2, r * cell + cell / 2);
      }
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
