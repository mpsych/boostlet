import { Framework } from "../framework.js";

import { Util } from "../util.js";

import { CanvasFallback } from "./canvasFallback.js";

// papaya keeps the volume in its own index order
// x runs toward the right and y toward posterior and z toward inferior
// so ras is the same x with y and z flipped

export class Papaya extends Framework {
  constructor(instance) {
    super(instance);
    this.name = "papaya";
    this.canvasFallback = new CanvasFallback();
  }

  viewer() {
    return this.instance && this.instance[0] && this.instance[0].viewer;
  }

  get_image(from_canvas) {
    return this.canvasFallback.get_image(from_canvas);
  }

  set_image(new_pixels) {
    return this.canvasFallback.set_image(new_pixels);
  }

  set_mask(new_mask) {
    return this.canvasFallback.set_mask(new_mask);
  }

  select_box(callback) {
    return this.canvasFallback.select_box(callback);
  }

  has_volume() {
    const viewer = this.viewer();
    return !!(viewer && viewer.initialized && viewer.volume);
  }

  dims_ras() {
    const vol = this.viewer().volume;
    return [vol.getXDim(), vol.getYDim(), vol.getZDim()];
  }

  // papaya index to ras and back since flipping is its own inverse
  to_ras(x, y, z) {
    const d = this.dims_ras();
    return [x, d[1] - 1 - y, d[2] - 1 - z];
  }

  // papaya applies slope and intercept when it reads a voxel
  // so get_subvolume already returns display values
  get_scaling() {
    const sv = this.viewer().screenVolumes[0];
    return { slope: 1, inter: 0, cal_min: sv.screenMin, cal_max: sv.screenMax };
  }

  get_crosshair_vox() {
    const c = this.viewer().currentCoord;
    return this.to_ras(c.x, c.y, c.z);
  }

  // the panel last clicked as 0 axial 1 coronal 2 sagittal
  // papaya numbers them 1 2 3 and forgets the click on mouse up so remember it on the viewer
  track_plane() {
    const viewer = this.viewer();
    const s = viewer.selectedSlice || (viewer.__boostletPlane === undefined ? viewer.mainImage : null);
    if (s && s.sliceDirection) viewer.__boostletPlane = s.sliceDirection - 1;
    if (!(viewer.__boostletPlane >= 0 && viewer.__boostletPlane <= 2)) viewer.__boostletPlane = 0;
    return viewer.__boostletPlane;
  }

  get_plane(loc) {
    if (loc && (loc.axCorSag === 0 || loc.axCorSag === 1 || loc.axCorSag === 2)) return loc.axCorSag;
    return this.track_plane();
  }

  // papaya has no location event but every cursor move redraws
  // so watch the redraw and call cb only when the cursor or panel changed
  on_location_change(cb) {
    const self = this;
    const viewer = this.viewer();
    const draw = viewer.drawViewer;
    let last = null;
    viewer.drawViewer = function() {
      const out = draw.apply(this, arguments);
      const c = viewer.currentCoord;
      const plane = self.track_plane();
      const key = c.x + ',' + c.y + ',' + c.z + ',' + plane;
      if (key !== last) {
        last = key;
        cb({ vox: self.to_ras(c.x, c.y, c.z), axCorSag: plane });
      }
      return out;
    };
  }

  // values between two ras corners with x fastest like niivue getVolumeData
  // corners are clamped to the volume so a patch at an edge comes back smaller
  get_subvolume(start, end) {
    const vol = this.viewer().volume;
    const d = this.dims_ras();
    const clamp = (p, i) => Math.min(Math.max(0, Math.round(p)), d[i] - 1);
    const lo = [0, 1, 2].map(i => clamp(Math.min(start[i], end[i]), i));
    const hi = [0, 1, 2].map(i => clamp(Math.max(start[i], end[i]), i));
    const dims = [0, 1, 2].map(i => hi[i] - lo[i] + 1);
    const data = new Float32Array(dims[0] * dims[1] * dims[2]);
    let n = 0;
    for (let z = lo[2]; z <= hi[2]; z++) {
      for (let y = lo[1]; y <= hi[1]; y++) {
        for (let x = lo[0]; x <= hi[0]; x++) {
          // nearest neighbor read at the papaya index of this ras voxel
          data[n++] = vol.getVoxelAtIndex(x, d[1] - 1 - y, d[2] - 1 - z, 0, true);
        }
      }
    }
    return { data, dims };
  }
}
