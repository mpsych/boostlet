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
      let currentSlice = this.instance.opts.sliceType;
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
      else if(currentSlice == 2){
        // sagittal, slice along X
        let x_index = Math.floor(currentCrossHairPos[0] * v.dims[1]);
        width = v.dims[2];
        height = v.dims[3];
        start = [x_index, 0, 0];
        end = [x_index + 1, v.dims[2], v.dims[3]];
      }
      else {
        // multiplanar (sliceType 3), no single slice to extract,
        // return the full volume
        width = v.dims[1];
        height = v.dims[2];
      }

      pixels = v.getVolumeData(start, end)[0];

    }

    return {'data':pixels, 'width':width, 'height':height};

  }



  get_subvolume(start, end) {
    const v = this.instance.volumes[0];
    // getVolumeData returns nothing if a coord is negative
    const last = [v.dims[1] - 1, v.dims[2] - 1, v.dims[3] - 1];
    const clamp = (p, i) => Math.min(Math.max(0, Math.round(p)), last[i]);
    const [data, dims] = v.getVolumeData(start.map(clamp), end.map(clamp));
    return { data, dims };
  }

  get_dims(){
    const v = this.instance.volumes[0];
    const currentSlice = this.instance.opts.sliceType;

    if(currentSlice == 0) return [v.dims[1], v.dims[2], 1]; //axial
    if(currentSlice == 1 ) return [v.dims[1], v.dims[3], 1 ]; // coronal
    if(currentSlice == 2) return [v.dims[2], v.dims[3], 1 ]; // saggital
    return [v.dims[1], v.dims[2], 1]; // multiplanar fallback
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