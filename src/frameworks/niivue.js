import {Framework} from '../framework.js';

import {Util} from '../util.js';

export class NiiVue extends Framework {
  
  constructor(instance) {

    super(instance);
    this.name = 'niivue';

    this.flip_on_png = true;

    this.onMouseDown = false;
    this.x1 = null;
    this.y1 = null;
    this.x2 = null;
    this.y2 = null;

  }

  get_image(from_canvas) {

    let element = this.instance.canvas;
    let pixels = null;
    let width = null;
    let height = null;


    // TODO this is hacky going through the canvas
    // later should grab the real volume data

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

    if (!Util.is_defined(from_canvas)) {

      // convert rgba pixels to grayscale
      pixels = Util.rgba_to_grayscale(pixels);

      console.log('to grayscale')

    } else {

      // TODO
      // not easily possible yet
      // we could hack it using 
      // nv.back.get_value(x,y,z)
      // based on the dimensions
      // nv.back.dims.slice(1);
      // but devs promised easy access in the future

    }


    return {'data':pixels, 'width':width, 'height':height};

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
      console.log('RAW', new_pixels_rgba)

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
    originalcanvas.parentNode.replaceChild(newcanvas, originalcanvas);


  }

  set_mask(new_mask) {

    // merge image + mask
    // and then call set_image with that information

    let image = this.get_image();

    let masked_image = Util.harden_mask(image.data, new_mask);

    this.set_image(masked_image, true);


  }

  select_box(callback) {

    // TODO also hacky until official API supports this

    let canvas = this.instance.canvas;


    canvas.addEventListener('mousedown', function (e) {
      this.isMouseDown = true;
      this.x1=e.x;
      this.y1=e.y;
    }.bind(this));

    canvas.addEventListener('mousemove', function (e) {
      if (this.isMouseDown) {
        this.x2 = e.x;
        this.y2 = e.y;
        this.instance.drawSelectionBox([this.x1, this.y1, this.x2-this.x1, this.y2-this.y1]);
      }
    }.bind(this));


    canvas.addEventListener('mouseup', function (e) {
      this.x2 = e.x;
      this.y2 = e.y;
      this.isMouseDown = false;

      let topleft = {x: this.x1, y: this.y1};
      let bottomright = {x: this.x2, y: this.y2};

      callback(topleft, bottomright);

    }.bind(this));

  }

}
