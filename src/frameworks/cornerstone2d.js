import {Framework} from '../framework.js';

import {Util} from '../util.js';

import {CanvasFallback} from './canvasFallback.js';

export class Cornerstone2D extends Framework {
  
  constructor(instance) {

    super(instance);
    this.name = 'cornerstone2D';
    this.canvasFallback = new CanvasFallback();

    this.cornerstonetools_instance = null;

    if (typeof window.cornerstoneTools != 'undefined') {

      // TODO probably not too robust
      this.cornerstonetools_instance = window.cornerstoneTools;

    }

    this.flip_on_png = false;

  }

  get_image(from_canvas) {

    let element = this.instance.getEnabledElements()[0];
    let pixels = null;
    let width = null;
    let height = null;

    if (typeof from_canvas != 'undefined') {

      // TODO this is hacky going through the canvas
      // later should grab the real volume data

      let canvas = element.canvas;
      width = canvas.width;
      height = canvas.height;

      let  ctx = canvas.getContext('2d');

      let imagedata = ctx.getImageData(0, 0, width, height);
      pixels = imagedata.data;

    } else {

      // this is the real image slice data
      let imagedata = element.image;
      pixels = imagedata.getPixelData();
      width = imagedata.width;
      height = imagedata.height;

    }

    return {'data':pixels, 'width':width, 'height':height};

  }

  set_image(new_pixels) {

    let element = this.instance.getEnabledElements()[0];
    let pixels = element.image.getPixelData();

    // Set the new pixel values
    pixels.set(new_pixels);

    // Re-render the current slice
    cornerstone.renderGrayscaleImage(element, true);

  }

  set_mask(new_mask) {

    return this.canvasFallback.set_mask(new_mask);
    
  }

  select_box(callback) {

    // this.cornerstonetools_instance.setToolActive('RectangleRoi', { mouseButtonMask: 1 })

    // let element = this.instance.getEnabledElements()[0];
    // let canvas = element.canvas;

    // canvas.onmouseup = function() {

    //   let state = this.cornerstonetools_instance.globalImageIdSpecificToolStateManager.saveToolState();

    //   let topleft = state[Object.keys(state).pop()].RectangleRoi.data[0].handles.start;
    //   let bottomright = state[Object.keys(state).pop()].RectangleRoi.data[0].handles.end;

    //   let topleft_c = this.instance.pixelToCanvas(element.element, topleft);
    //   let bottomright_c = this.instance.pixelToCanvas(element.element, bottomright);

    //   this.cornerstonetools_instance.clearToolState(element.element, 'RectangleRoi');
    //   this.instance.renderGrayscaleImage(element, true);

    //   callback(topleft_c, bottomright_c);

    // }.bind(this);


    if(this.cornerstonetools_instance.RectangleRoiTool === undefined) {
      console.log("Using Boxcraft library to handle box selection.");
      let element = this.instance.getEnabledElements()[0];
      let canvas = element.canvas;
      // Disable the Wwwc tool
      cornerstoneTools.setToolDisabled("Wwwc");

      BoxCraft.createDraggableBBox(canvas, function (topleft, bottomright) {
        callback(topleft, bottomright);
      });

      // BoxCraft.createResizableBBox(canvas, function(topleft, bottomright) {
      //   console.log("Inside Draggable BBox",topleft, bottomright);
      //   callback(topleft, bottomright);
      // });
    }
    else{
      console.log("Using Cornerstonetools to handle box selection.");
      this.cornerstonetools_instance.setToolActive("RectangleRoi", {
        mouseButtonMask: 1,
      });

      let element = this.instance.getEnabledElements()[0];
      let canvas = element.canvas;

      canvas.onmouseup = function () {
        let state =
          this.cornerstonetools_instance.globalImageIdSpecificToolStateManager.saveToolState();

        let topleft =
          state[Object.keys(state).pop()].RectangleRoi.data[0].handles.start;
        let bottomright =
          state[Object.keys(state).pop()].RectangleRoi.data[0].handles.end;

        let topleft_c = this.instance.pixelToCanvas(element.element, topleft);
        let bottomright_c = this.instance.pixelToCanvas(
          element.element,
          bottomright
        );

        this.cornerstonetools_instance.clearToolState(
          element.element,
          "RectangleRoi"
        );
        this.instance.renderGrayscaleImage(element, true);
        callback(topleft_c, bottomright_c);
      }.bind(this);
    }

  }

}