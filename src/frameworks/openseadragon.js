import {Framework} from '../framework.js';

import {Util} from '../util.js';

import {CanvasFallback} from './canvasFallback.js';

export class OpenSeaDragon extends Framework {
    constructor(instance) {
        super(instance);
        this.name = 'opensedragon';
        this.canvasFallback = new CanvasFallback();

    }

    get_image(from_canvas) {
        return this.canvasFallback.get_image(from_canvas);
    }

    set_image(new_pixels) {
        return this.canvasFallback.set_image(new_pixels);
    }

    set_mask(new_mask) {
        // return this.canvasFallback.set_mask(new_mask);

        let viewer = null;
        let vs = this.instance._viewers;
        vs.forEach(function (e) {
          if (e.id == "viewer") {
            viewer = e;
          }
        });

        if (!viewer) {
          throw "OpenSeaDragon viewer not found.";
        }

        let canvas = viewer.canvas.children[0];
        width = canvas.width;
        height = canvas.height;

        let ctx = canvas.getContext("2d");
        let imagedata = ctx.getImageData(0, 0, width, height);
        let pixels = imagedata.data;

        let masked_image = Util.harden_mask(pixels, new_mask);
        let masked_image_as_imagedata = new ImageData(masked_image, width, height);
        ctx.putImageData(masked_image_as_imagedata, 0, 0);
    }

    select_box(callback) {

      console.log("Using Boxcraft library to handle box selection.");
      let viewer = null;
      let vs = this.instance._viewers;
      vs.forEach(function (e) {
        if (e.id == "viewer") {
          viewer = e;
        }
      });

      if (!viewer) {
        throw "OpenSeaDragon viewer not found.";
      }

      let canvas = viewer.canvas;

      BoxCraft.createDraggableBBox(canvas, function (topleft, bottomright) {
        callback(topleft, bottomright);
      });

    }

    

}
  
