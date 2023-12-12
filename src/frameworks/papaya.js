import { Framework } from "../framework.js";

import { Util } from "../util.js";

export class Papaya extends Framework {
  constructor(instance) {
    super(instance);
    this.name = "papaya";
  }

  get_image(from_canvas) {
    let canvas = this.instance[0].viewer.canvas;
    let ctx = canvas.getContext("2d");

    let image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let rgba_image = Util.rgba_to_grayscale(image.data)

    return { data: rgba_image, width: image.width, height: image.height };
    // return {'data':pixels, 'width':image.width, 'height':image.height};
  }

  set_image(new_pixels) {
    let originalcanvas = this.instance[0].viewer.canvas;

    let newcanvas = window.document.createElement("canvas");
    newcanvas.width = originalcanvas.width;
    newcanvas.height = originalcanvas.height;

    let ctx = newcanvas.getContext("2d");

    let newPixelsRgba = Util.grayscale_to_rgba(new_pixels);

    let newPixelsClamped = new Uint8ClampedArray(newPixelsRgba);

    let newImageData = new ImageData(
      newPixelsClamped,
      newcanvas.width,
      newcanvas.height
    );

    // Draw the new image data onto the canvas
    ctx.putImageData(newImageData, 0, 0);

    newcanvas.onclick = function () {
      // on click, we will restore the nv canvas
      newcanvas.parentNode.replaceChild(originalcanvas, newcanvas);
    };

    // replace nv canvas with new one
    originalcanvas.parentNode.replaceChild(newcanvas, originalcanvas);
  }
}
