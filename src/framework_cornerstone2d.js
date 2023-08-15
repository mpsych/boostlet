import {Framework} from './framework.js';

export class Cornerstone2D extends Framework {
  
  constructor(instance) {

    super(instance);
    this.name = 'cornerstone2D';

    this.cornerstonetools_instance = null;

    if (typeof window.cornerstoneTools != 'undefined') {

      // TODO probably not too robust
      this.cornerstonetools_instance = window.cornerstoneTools;

    }

    this.flip_on_png = false;

  }

  get_current_image() {

    // TODO this is hacky going through the canvas
    // later should grab the real volume data

    let element = this.instance.getEnabledElements()[0];
    let canvas = element.canvas;
    let height = canvas.height;
    let width = canvas.width;

    let  ctx = canvas.getContext('2d');

    let pixels = ctx.getImageData(0, 0, width, height);

    return pixels;

  }

  select_box(callback) {

    this.cornerstonetools_instance.setToolActive('RectangleRoi', { mouseButtonMask: 1 })

    let element = this.instance.getEnabledElements()[0];
    let canvas = element.canvas;

    canvas.onmouseup = function() {

      let state = this.cornerstonetools_instance.globalImageIdSpecificToolStateManager.saveToolState();

      let topleft = state[Object.keys(state).pop()].RectangleRoi.data[0].handles.start;
      let bottomright = state[Object.keys(state).pop()].RectangleRoi.data[0].handles.end;

      let topleft_c = this.instance.pixelToCanvas(element.element, topleft);
      let bottomright_c = this.instance.pixelToCanvas(element.element, bottomright);

      this.cornerstonetools_instance.clearToolState(element.element, 'RectangleRoi');
      this.instance.renderGrayscaleImage(element, true);

      callback(topleft_c, bottomright_c);

    }.bind(this);

  }

}
