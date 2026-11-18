import {Framework} from '../framework.js';

import {Util} from '../util.js';
import {CanvasFallback} from './canvasFallback.js';

export class NiiVue extends Framework {
  
  constructor(instance) {

    super(instance);
    this.name = 'niivue';
    this.canvasFallback = new CanvasFallback();

    this.flip_on_png = true;

    this.onMouseDown = false;
    this.x1 = null;
    this.y1 = null;
    this.x2 = null;
    this.y2 = null;

    // remember which panel was clicked last so multiplanar has a current plane
    // kept on the niivue instance because every Boostlet.init makes a new adapter
    if (instance.__boostletPlane === undefined) {
      instance.__boostletPlane = 0;
      const previous = instance.onLocationChange;
      instance.onLocationChange = function(loc) {
        if (loc && (loc.axCorSag === 0 || loc.axCorSag === 1 || loc.axCorSag === 2)) {
          instance.__boostletPlane = loc.axCorSag;
        }
        if (previous) return previous.apply(this, arguments);
      };
    }

  }

  // plane the user is working in as 0 axial 1 coronal 2 sagittal
  // a single plane view is its own answer
  // in multiplanar it is the panel that was clicked last
  // pass the location event when there is one so the answer is current
  get_plane(loc) {
    const nv = this.instance;
    const view = nv.opts.sliceType;
    if (view === 0 || view === 1 || view === 2) {
      nv.__boostletPlane = view;
    } else if (loc && (loc.axCorSag === 0 || loc.axCorSag === 1 || loc.axCorSag === 2)) {
      nv.__boostletPlane = loc.axCorSag;
    }
    return nv.__boostletPlane;
  }

  get_image(from_canvas) {

    
    let pixels = null;
    let width = null;
    let height = null;

    if (!Util.is_defined(from_canvas)) {

      // use the canvas

      let element = this.instance.canvas;

      let old_crosshaircolor = this.instance.opts.crosshairColor;
      let old_crosshairwidth = this.instance.opts.crosshairWidth;

      this.instance.setCrosshairColor([0,0,0,0]);
      this.instance.opts.crosshairWidth=0;
      this.instance.updateGLVolume();


      let ctx = this.instance.gl;

      
      width = ctx.drawingBufferWidth;
      height = ctx.drawingBufferHeight;

      pixels = new Uint8Array(width * height * 4);
      ctx.readPixels(
        0, 
        0, 
        width, 
        height, 
        ctx.RGBA, 
        ctx.UNSIGNED_BYTE, 
        pixels);

      // restore crosshairs
      this.instance.setCrosshairColor(old_crosshaircolor);
      this.instance.opts.crosshairWidth = old_crosshairwidth;


      // convert rgba pixels to grayscale
      pixels = Util.rgba_to_grayscale(pixels);


    } else {

      // grab the real pixels of the current slice and return it
      // set width and height accordingly

      let v =  this.instance.volumes[0];
      // in multiplanar this is the last clicked panel
      let currentSlice = this.get_plane();
      let currentCrossHairPos = this.instance.scene.crosshairPos;
      
      
      // Default to full volume
      let start = [0, 0, 0];
      let end = [v.dims[1], v.dims[2], v.dims[3]];

      if(currentSlice == 0){
        // axial, slice along Z
        let z_index = Math.floor(currentCrossHairPos[2] * v.dims[3]);
        width = v.dims[1];
        height = v.dims[2];
        start = [0, 0, z_index];
        end = [v.dims[1], v.dims[2], z_index + 1];
      }
      else if(currentSlice == 1){
        // coronal, slice along Y
        let y_index = Math.floor(currentCrossHairPos[1] * v.dims[2]);
        width = v.dims[1];
        height = v.dims[3];
        start = [0, y_index, 0];
        end = [v.dims[1], y_index + 1 , v.dims[3]];
      }
      else {
        // sagittal, slice along X
        let x_index = Math.floor(currentCrossHairPos[0] * v.dims[1]);
        width = v.dims[2];
        height = v.dims[3];
        start = [x_index, 0, 0];
        end = [x_index + 1, v.dims[2], v.dims[3]];
      }

      pixels = v.getVolumeData(start, end)[0];

    }

    return {'data':pixels, 'width':width, 'height':height};

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
      cal_min: v.cal_min,
      cal_max: v.cal_max
    };
  }

  // crosshairPos is a fraction along the ras axes
  // floor matches how niivue maps it to a voxel
  get_crosshair_vox() {
    const pos = this.instance.scene.crosshairPos;
    const v = this.instance.volumes[0];
    const d = v.dimsRAS || v.dims;
    return [0, 1, 2].map(i => Math.min(Math.floor(pos[i] * d[i + 1]), d[i + 1] - 1));
  }

  // radiological view mirrors left and right in axial and coronal
  // sagittalNoseLeft mirrors sagittal
  get_display_flip(plane) {
    const o = this.instance.opts || {};
    if (plane === 2) return { x: !!o.sagittalNoseLeft, y: false };
    return { x: !!o.isRadiologicalConvention, y: false };
  }

  // niivue already sends vox in ras and the clicked panel as axCorSag
  // the handler that was there keeps running first
  on_location_change(cb) {
    const nv = this.instance;
    const previous = nv.onLocationChange;
    nv.onLocationChange = function(loc) {
      if (previous) previous.apply(this, arguments);
      cb(loc);
    };
  }

  get_subvolume(start, end) {
    const v = this.instance.volumes[0];
    // getVolumeData returns nothing if a coord is negative
    // coords are in ras order so clamp to the ras dims not the stored ones
    const d = v.dimsRAS || v.dims;
    const last = [d[1] - 1, d[2] - 1, d[3] - 1];
    const clamp = (p, i) => Math.min(Math.max(0, Math.round(p)), last[i]);
    const [data, dims] = v.getVolumeData(start.map(clamp), end.map(clamp));
    return { data, dims };
  }

  get_dims(){
    const v = this.instance.volumes[0];
    const currentSlice = this.get_plane();

    if(currentSlice == 0) return [v.dims[1], v.dims[2], 1]; //axial
    if(currentSlice == 1 ) return [v.dims[1], v.dims[3], 1 ]; // coronal
    return [v.dims[2], v.dims[3], 1 ]; // saggital
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

    let new_image_data = new ImageData(new_pixels_clamped, newcanvas.width, newcanvas.height);
    

    ctx.putImageData(new_image_data, 0, 0);

    if (!Util.is_defined(no_flip)) {
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