import { Framework } from "../framework.js";

import { Util } from "../util.js";

import { CanvasFallback } from "./canvasFallback.js";

// papaya shows a volume in one of two modes
// in voxel mode its cursor goes through orientMat to a stored voxel
// in world space which it uses for tilted or reordered headers the cursor goes through mm and worldMat
// either way the adapter follows papaya's own path to the stored voxel
// then maps stored voxels to ras with the file's affine the same way nibabel and niivue do
// so the patch is made of the file's own voxels in every mode

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
    return !!(viewer && viewer.initialized && viewer.volume && viewer.volume.header.fileFormat);
  }

  // stored dims in file order
  stored_dims() {
    const d = this.viewer().volume.header.imageDimensions;
    return [d.cols, d.rows, d.slices];
  }

  // for each stored axis the ras axis it runs along and whether it runs backwards
  // taken from the sform when set and the qform otherwise like nibabel
  axes() {
    const n = this.viewer().volume.header.fileFormat.nifti;
    const A = n.sform_code > 0 ? n.affine : n.getQformMat();
    return [0, 1, 2].map(i => {
      let r = 0;
      for (let k = 1; k < 3; k++) if (Math.abs(A[k][i]) > Math.abs(A[r][i])) r = k;
      return { ras: r, back: A[r][i] < 0 };
    });
  }

  dims_ras() {
    const sd = this.stored_dims(), ax = this.axes(), d = [0, 0, 0];
    for (let i = 0; i < 3; i++) d[ax[i].ras] = sd[i];
    return d;
  }

  stored_to_ras(s) {
    const sd = this.stored_dims(), ax = this.axes(), v = [0, 0, 0];
    for (let i = 0; i < 3; i++) v[ax[i].ras] = ax[i].back ? sd[i] - 1 - s[i] : s[i];
    return v;
  }

  ras_to_stored(v) {
    const sd = this.stored_dims(), ax = this.axes();
    return [0, 1, 2].map(i => ax[i].back ? sd[i] - 1 - v[ax[i].ras] : v[ax[i].ras]);
  }

  // stored voxel under a papaya cursor position by the same path papaya draws with
  cursor_to_stored(c) {
    const viewer = this.viewer(), vol = viewer.volume, o = vol.header.orientation;
    let p;
    if (viewer.worldSpace) {
      const org = vol.header.origin, vd = vol.header.voxelDimensions, m = vol.transform.worldMat;
      const mm = [(c.x - org.x) * vd.xSize, (org.y - c.y) * vd.ySize, (org.z - c.z) * vd.zSize];
      p = [0, 1, 2].map(r => Math.round(m[r][0] * mm[0] + m[r][1] * mm[1] + m[r][2] * mm[2] + m[r][3]));
    } else {
      const m = o.orientMat;
      p = [0, 1, 2].map(r => Math.floor(m[r][0] * c.x + m[r][1] * c.y + m[r][2] * c.z + m[r][3]));
    }
    // papaya's own increments turn that into an offset in the raw array
    // and the offset gives the stored voxel in file order
    const sd = this.stored_dims();
    const offset = p[0] * o.xIncrement + p[1] * o.yIncrement + p[2] * o.zIncrement;
    return [offset % sd[0], Math.floor(offset / sd[0]) % sd[1], Math.floor(offset / (sd[0] * sd[1]))];
  }

  // papaya applies slope and intercept when it reads a voxel
  // so get_subvolume already returns display values
  get_scaling() {
    const sv = this.viewer().screenVolumes[0];
    return { slope: 1, inter: 0, cal_min: sv.screenMin, cal_max: sv.screenMax };
  }

  get_crosshair_vox() {
    return this.stored_to_ras(this.cursor_to_stored(this.viewer().currentCoord));
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
        // in world space papaya's grid is larger than the file so a click can land outside it
        // skip those like niivue whose crosshair cannot leave the volume
        const vox = self.stored_to_ras(self.cursor_to_stored(c));
        const d = self.dims_ras();
        if (vox.every((v, i) => v >= 0 && v < d[i])) cb({ vox, axCorSag: plane });
      }
      return out;
    };
  }

  // values between two ras corners with x fastest like niivue getVolumeData
  // corners are clamped to the volume so a patch at an edge comes back smaller
  // values come straight from the file's raw array with papaya's scaling
  get_subvolume(start, end) {
    const vv = this.viewer().volume.transform.voxelValue;
    const d = this.dims_ras(), sd = this.stored_dims();
    const clamp = (p, i) => Math.min(Math.max(0, Math.round(p)), d[i] - 1);
    const lo = [0, 1, 2].map(i => clamp(Math.min(start[i], end[i]), i));
    const hi = [0, 1, 2].map(i => clamp(Math.max(start[i], end[i]), i));
    const dims = [0, 1, 2].map(i => hi[i] - lo[i] + 1);
    const data = new Float32Array(dims[0] * dims[1] * dims[2]);
    let n = 0;
    for (let z = lo[2]; z <= hi[2]; z++) {
      for (let y = lo[1]; y <= hi[1]; y++) {
        for (let x = lo[0]; x <= hi[0]; x++) {
          const s = this.ras_to_stored([x, y, z]);
          // the location arguments only feed a bounds check so pass a point inside it
          data[n++] = vv.getVoxelAtOffset(s[0] + s[1] * sd[0] + s[2] * sd[0] * sd[1], 0, 0, 0, 0);
        }
      }
    }
    return { data, dims };
  }
}
