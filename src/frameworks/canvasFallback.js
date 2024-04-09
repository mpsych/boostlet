import { Framework } from "../framework.js";

import { Util } from "../util.js";



export class CanvasFallback extends Framework {
  constructor() {
    super();
    this.name = "canvasFallback";
  }

  get_canvas() {
    let canvases = document.querySelectorAll('canvas');
    let largestCanvas = canvases[0];
    let largestArea = largestCanvas.width * largestCanvas.height;

    for (let i = 1; i < canvases.length; i++) {
        let area = canvases[i].width * canvases[i].height;
        if (area > largestArea) {
            largestCanvas = canvases[i];
            largestArea = area;
        }
    }

    return largestCanvas;
  }

  get_image(from_canvas) {

    let canvas = this.get_canvas();

    let ctx = canvas.getContext("2d");

    let image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let rgba_image = Util.rgba_to_grayscale(image.data);

    if (from_canvas) {
      return { data: image.data, width: image.width, height: image.height };
    } else {
      return { data: rgba_image, width: image.width, height: image.height };
    }
  }

  set_image(new_pixels) {
    let originalcanvas = this.get_canvas();

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

  set_mask(new_mask) {
    let image = this.get_image(true);

    let originalcanvas = this.get_canvas();

    let newcanvas = window.document.createElement('canvas');

    newcanvas.width = originalcanvas.width;
    newcanvas.height = originalcanvas.height;

    let ctx = newcanvas.getContext('2d');

    let imageclamped = new Uint8ClampedArray(image.data);

    let newImageData = new ImageData(
      imageclamped,
      newcanvas.width,
      newcanvas.height
    );

    // Draw the new image data onto the canvas
    ctx.putImageData(newImageData, 0, 0);

    image = ctx.getImageData(0, 0, newcanvas.width, newcanvas.height);

    let masked_image = Util.harden_mask(image.data, new_mask);

    let masked_image_as_imagedata = new ImageData(
      masked_image,
      newcanvas.width,
      newcanvas.height
    );

    ctx.putImageData(masked_image_as_imagedata, 0, 0);

    originalcanvas.parentNode.replaceChild(newcanvas, originalcanvas);
  }

  select_box(callback) {
    let scriptBoxCraft = document.createElement("script");
    scriptBoxCraft.type = "text/javascript";
    // scriptBoxCraft.src = "https://shrutivarade.github.io/BoxCraft/dist/boxCraft.min.js";
    // scriptBoxCraft.src = "http://localhost:8888/dist/boxcraft.min.js";
    scriptBoxCraft.src = "http://localhost:8000/submodule/BoxCraft/dist/boxcraft.min.js";
    let canvas = this.get_canvas();
    document.head.appendChild(scriptBoxCraft);

    scriptBoxCraft.onload = function() {

      BoxCraft.createDraggableBBox(canvas, function (topleft, bottomright) {
        console.log("Inside Draggable BBox", topleft, bottomright);
        callback(topleft, bottomright);
      });
    }

  }

}