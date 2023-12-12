import { Framework } from "../framework.js";

import { Util } from "../util.js";

export class Xtk extends Framework {
  constructor(instance) {
    super(instance);
    this.name = "xtk";
  }

  get_image(from_canvas) {
    let canvas = this.instance.ca;
    let ctx = canvas.getContext("2d");

    let image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let rgba_image = Util.rgba_to_grayscale(image.data);

    return { data: rgba_image, width: image.width, height: image.height };
    // return {'data':pixels, 'width':image.width, 'height':image.height};
  }

  set_image(new_pixels) {
    let originalcanvas = this.instance.ca;

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
    let image = this.get_image();

    // TODO here we need to flip one more time, this is until
    // we use the official niivue infrastructure for adding
    // a segmentation layer
    let originalcanvas = this.instance.ca;

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

    this.set_image(masked_image); // rgba data, no flip
  }

  select_box(callback) {
    // alert("Click on top left and bottom rght coordinated of the desired selection box.")
    let isFirstClick = true;
    let x1, y1, x2, y2;

    // Function to handle the mouse click event
    function handleClick(event) {
      if (isFirstClick) {
        // Capture x1 and y1 on the first click
        x1 = event.clientX;
        y1 = event.clientY;
        console.log(`First click: (X1: ${x1}, Y1: ${y1})`);
        isFirstClick = false;
      } else {
        // Capture x2 and y2 on the second click
        x2 = event.clientX;
        y2 = event.clientY;
        console.log(`Second click: (X2: ${x2}, Y2: ${y2})`);
        isFirstClick = true;

        let topleft = { x: x1, y: y1 };
        let bottomright = { x: x2, y: y2 };

        callback(topleft, bottomright);
      }

      // let topleft = {x: 529, y: 480};
      // let bottomright = {x: 667, y: 588};
      // callback(topleft, bottomright);
    }

    // Add a click event listener to the document
    document.addEventListener("click", handleClick);
  }
}
