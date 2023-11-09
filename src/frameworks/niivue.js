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
    // console.log('aaa',originalcanvas.clientWidth+'px');
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

    // TODO also hacky until official API supports this

    let canvas = this.instance.canvas;


    canvas.addEventListener('mousedown', function (e) {
      this.isMouseDown = true;

      var rect = e.currentTarget.getBoundingClientRect(),
      offsetX = e.clientX - rect.left,
      offsetY = e.clientY - rect.top;

      this.x1 = offsetX;
      this.y1 = offsetY;
    }.bind(this));

    canvas.addEventListener('mousemove', function (e) {
      if (this.isMouseDown) {

        var rect = e.currentTarget.getBoundingClientRect(),
        offsetX = e.clientX - rect.left,
        offsetY = e.clientY - rect.top;

        this.x2 = offsetX;
        this.y2 = offsetY;
        this.instance.drawSelectionBox([this.x1, this.y1, this.x2-this.x1, this.y2-this.y1]);
      }
    }.bind(this));


    canvas.addEventListener('mouseup', function (e) {
      var rect = e.currentTarget.getBoundingClientRect(),
      offsetX = e.clientX - rect.left,
      offsetY = e.clientY - rect.top;
      
      this.x2 = offsetX;
      this.y2 = offsetY;
      this.isMouseDown = false;

      let topleft = {x: this.x1, y: this.y1};
      let bottomright = {x: this.x2, y: this.y2};

      callback(topleft, bottomright);

    }.bind(this));

  }

}
