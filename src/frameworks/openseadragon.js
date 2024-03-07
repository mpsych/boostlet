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
        return this.canvasFallback.set_mask(new_mask);
    }

    select_box(callback) {
        
      Boostlet.hint("Click on top left and bottom right coordinated of the desired selection box.")

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

            let topleft = {x: x1, y: y1};
            let bottomright = {x: x2, y: y2};

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
  
