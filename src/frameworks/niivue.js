import {Framework} from '../framework.js';

import {Util} from '../util.js';
import {CanvasFallback} from './canvasFallback.js';

// Raw voxels in RAS voxel coords, end inclusive and both clamped to the volume.
// Port of 0.6 NVImage.getVolumeData (removed in 1.0); the fields it reads exist in both.
function volume_data(v, start, end) {
  const d = v.dimsRAS, o = v.img2RASstart, step = v.img2RASstep, img = v.img;
  const lo = [], hi = [];
  for (let i = 0; i < 3; i++) {
    const a = Math.max(0, Math.min(Math.round(start[i]), d[i + 1] - 1));
    const b = Math.max(0, Math.min(Math.round(end[i]), d[i + 1] - 1));
    lo[i] = Math.min(a, b);
    hi[i] = Math.max(a, b);
  }
  const dims = [hi[0] - lo[0] + 1, hi[1] - lo[1] + 1, hi[2] - lo[2] + 1];
  const out = new img.constructor(dims[0] * dims[1] * dims[2]);
  let n = 0;
  for (let z = lo[2]; z <= hi[2]; z++) {
    for (let y = lo[1]; y <= hi[1]; y++) {
      const yz = o[0] + o[1] + o[2] + y * step[1] + z * step[2];
      for (let x = lo[0]; x <= hi[0]; x++) out[n++] = img[yz + x * step[0]];
    }
  }
  return [out, dims];
}

export class NiiVue extends Framework {
  
  constructor(instance) {

    super(instance);
    this.name = 'niivue';
    this.canvasFallback = new CanvasFallback();

    // NiiVue 1.0 has getCanvasImage; 0.6 is read back with gl.readPixels (bottom-up)
    this.v1 = typeof instance.getCanvasImage === 'function';
    this.flip_on_png = !this.v1;

    // track the clicked panel for get_plane in multiplanar
    if (instance.__boostletPlane === undefined) {
      instance.__boostletPlane = 0;
      this.on_location_change(loc => this.get_plane(loc));
      // 1.0 slice clicks report axCorSag NaN, so read the tile under the pointer; capture runs before niivue's handler
      if (this.v1) instance.canvas.addEventListener('pointerdown', e => {
        const r = instance.canvas.getBoundingClientRect();
        const hit = instance.hitTest((e.clientX - r.left) * instance.canvas.width / r.width, (e.clientY - r.top) * instance.canvas.height / r.height);
        if (hit && !hit.isRender) instance.__boostletPlane = hit.sliceType;
      }, true);
    }

  }

  // 0.6 and 1.0 differ only in where these live
  slice_type() {
    return this.v1 ? this.instance.sliceType : this.instance.opts.sliceType;
  }

  crosshair_pos() {
    return this.v1 ? this.instance.crosshairPos : this.instance.scene.crosshairPos;
  }

  // plane the user is working in as 0 axial 1 coronal 2 sagittal
  // a single plane view is its own answer; in multiplanar it is the panel clicked last
  // (kept on the instance because every Boostlet.init makes a new adapter)
  get_plane(loc) {
    const nv = this.instance;
    const view = this.slice_type();
    if (view === 0 || view === 1 || view === 2) {
      nv.__boostletPlane = view;
    } else if (loc && (loc.axCorSag === 0 || loc.axCorSag === 1 || loc.axCorSag === 2)) {
      nv.__boostletPlane = loc.axCorSag;
    }
    return nv.__boostletPlane;
  }

  has_volume() {
    const v = this.instance.volumes;
    return !!(v && v.length);
  }

  get_scaling() {
    const v = this.instance.volumes[0];
    return {
      slope: v.hdr.scl_slope || 1,
      inter: v.hdr.scl_inter || 0,
      cal_min: v.cal_min ?? v.calMin,
      cal_max: v.cal_max ?? v.calMax
    };
  }

  // crosshairPos is a fraction along the ras axes; floor matches how niivue maps it to a voxel
  get_crosshair_vox() {
    const pos = this.crosshair_pos();
    const d = this.instance.volumes[0].dimsRAS;
    return [0, 1, 2].map(i => Math.min(Math.floor(pos[i] * d[i + 1]), d[i + 1] - 1));
  }

  // radiological mirrors left and right in axial and coronal; nose left mirrors sagittal
  // 1.0 isSagittalNoseLeft null follows isRadiological
  get_display_flip(plane) {
    const nv = this.instance;
    const radiological = this.v1 ? nv.isRadiological : nv.opts.isRadiologicalConvention;
    const noseLeft = this.v1 ? (nv.isSagittalNoseLeft ?? radiological) : nv.opts.sagittalNoseLeft;
    return { x: !!(plane === 2 ? noseLeft : radiological), y: false };
  }

  // cb(location) on every crosshair move; location.vox is in RAS voxels, axCorSag the clicked panel
  on_location_change(cb) {
    const nv = this.instance;
    if (this.v1) {
      nv.addEventListener('locationChange', e => cb(e.detail));
    } else {
      const previous = nv.onLocationChange;
      nv.onLocationChange = function(loc) {
        if (previous) previous.apply(this, arguments);
        cb(loc);
      };
    }
  }

  get_image(from_canvas) {

    if (Util.is_defined(from_canvas)) {

      // raw voxels of the current slice; in multiplanar the panel clicked last
      const v = this.instance.volumes[0];
      const d = v.dimsRAS;
      const plane = this.get_plane();
      const start = [0, 0, 0];
      const end = [d[1] - 1, d[2] - 1, d[3] - 1];
      const axis = 2 - plane; // axial slices z, coronal y, sagittal x
      start[axis] = end[axis] = this.get_crosshair_vox()[axis];
      const [data, dims] = volume_data(v, start, end);
      const [width, height] = plane == 1 ? [dims[0], dims[2]] : plane == 2 ? [dims[1], dims[2]] : [dims[0], dims[1]];
      return {'data': data, 'width': width, 'height': height};

    }

    const nv = this.instance;

    if (this.v1) {

      // getCanvasImage renders and copies in one task (WebGL2 and WebGPU), top-left origin
      const old_width = nv.crosshairWidth;
      nv.crosshairWidth = 0;
      const image = nv.getCanvasImage();
      nv.crosshairWidth = old_width;
      if (!image) throw "NiiVue could not capture the canvas.";
      // the capture covers only this instance's bounds; remember where so set_image can put it back
      this.capture = {x: Math.max(0, nv.view.boundsOffsetX), y: Math.max(0, nv.view.boundsOffsetY), width: image.width, height: image.height};
      return {'data': Util.rgba_to_grayscale(image.data), 'width': image.width, 'height': image.height};

    }

    let old_crosshaircolor = nv.opts.crosshairColor;
    let old_crosshairwidth = nv.opts.crosshairWidth;

    nv.setCrosshairColor([0,0,0,0]);
    nv.opts.crosshairWidth=0;
    nv.updateGLVolume();

    let ctx = nv.gl;
    let width = ctx.drawingBufferWidth;
    let height = ctx.drawingBufferHeight;

    let pixels = new Uint8Array(width * height * 4);
    ctx.readPixels(0, 0, width, height, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);

    // restore crosshairs
    nv.setCrosshairColor(old_crosshaircolor);
    nv.opts.crosshairWidth = old_crosshairwidth;

    return {'data': Util.rgba_to_grayscale(pixels), 'width': width, 'height': height};

  }

  get_subvolume(start, end) {
    const [data, dims] = volume_data(this.instance.volumes[0], start, end);
    return { data, dims };
  }

  get_dims(){
    const d = this.instance.volumes[0].dimsRAS;
    const plane = this.get_plane();
    if (plane == 1) return [d[1], d[3], 1]; // coronal
    if (plane == 2) return [d[2], d[3], 1]; // sagittal
    return [d[1], d[2], 1]; // axial
  }

  /**
   * Sets the NiiVue.js image.
   * 
   * If is_rgba==true, we do *not* convert to RGBA before setting on canvas.
   **/
  set_image(new_pixels, is_rgba, no_flip) {

    // TODO this is hacky since we dont work with the real volume yet
    // create new canvas
    // put pixels on canvas
    // show canvas
    // hide on click

    let originalcanvas = this.instance.canvas;

    let newcanvas = window.document.createElement('canvas');
    newcanvas.width = originalcanvas.width;
    newcanvas.height = originalcanvas.height;

    // put new_pixels down
    let ctx = newcanvas.getContext('2d');

    let new_pixels_rgba = null;

    if (Util.is_defined(is_rgba)) {

      new_pixels_rgba = new_pixels;

    } else {

      new_pixels_rgba = Util.grayscale_to_rgba(new_pixels);


    }

    let new_pixels_clamped = new Uint8ClampedArray(new_pixels_rgba);

    const rect = (this.v1 && this.capture) || {x: 0, y: 0, width: newcanvas.width, height: newcanvas.height};
    ctx.putImageData(new ImageData(new_pixels_clamped, rect.width, rect.height), rect.x, rect.y);

    if (!Util.is_defined(no_flip) && !this.v1) {
      // some flipping action
      ctx.save();
      ctx.scale(1, -1);
      ctx.drawImage(newcanvas, 0, -newcanvas.height);
      ctx.restore();
    }


    newcanvas.onclick = function() {

      // on click, we will restore the nv canvas
      newcanvas.parentNode.replaceChild(originalcanvas, newcanvas);

    }

    // replace nv canvas with new one
    // originalcanvas.parentNode.replaceChild(newcanvas, originalcanvas);
    newcanvas.style.width = originalcanvas.clientWidth+'px';
    newcanvas.style.height = originalcanvas.clientHeight+'px';
    originalcanvas.parentNode.replaceChild(newcanvas, originalcanvas);

  }

  set_mask(new_mask) {

    // merge image + mask
    // and then call set_image with that information

    let image = this.get_image(true);

    // TODO here we need to flip one more time, this is until
    // we use the official niivue infrastructure for adding
    // a segmentation layer
    let originalcanvas = this.instance.canvas;

    let newcanvas = window.document.createElement('canvas');
    newcanvas.width = originalcanvas.width;
    newcanvas.height = originalcanvas.height;
    // put new_pixels down
    let ctx = newcanvas.getContext('2d');
    let imageclamped = new Uint8ClampedArray(image.data);
    let imagedata = new ImageData(imageclamped, image.width, image.height);
    ctx.putImageData(imagedata, 0, 0);
    ctx.save();
    ctx.scale(1, -1);
    ctx.drawImage(newcanvas, 0, -newcanvas.height);
    ctx.restore();
    image = ctx.getImageData(0, 0, newcanvas.width, newcanvas.height);
    // end of flip

    let masked_image = Util.harden_mask(image.data, new_mask);

    this.set_image(masked_image, true, true); // rgba data, no flip


  }

  select_box(callback) {
    return this.canvasFallback.select_box(callback);

  }

}