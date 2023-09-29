import {Framework} from '../framework.js';

import {Util} from '../util.js';

export class OpenSeaDragon extends Framework {
    constructor(instance) {
        super(instance);
        this.name = 'opensedragon';

    }

    get_image(from_canvas) {
    

        // TODO needs to be generic and executed with Boostlet.init

        let viewer = null;
        let vs = this.instance._viewers;
        vs.forEach(function(e) { 
            if (e.id == 'viewer') {
            viewer = e;
            }
        });

        if (!viewer) {
            throw "OpenSeaDragon viewer not found.";
        }

        let canvas = viewer.canvas.children[0];
        let ctx = canvas.getContext("2d");

        let image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let rgba_image = Util.rgba_to_grayscale(image.data);
        // let pixels = image.data;


        return {'data':rgba_image, 'width':image.width, 'height':image.height};
        // return {'data':pixels, 'width':image.width, 'height':image.height};

    }

    set_image(new_pixels) {

        let viewer = null;
        let vs = this.instance._viewers;
        vs.forEach(function(e) { 
            if (e.id == 'viewer') {
            viewer = e;
            }
        });

        if (!viewer) {
            throw "OpenSeaDragon viewer not found.";
        }

        let canvas = viewer.canvas.children[0];
        let ctx = canvas.getContext("2d");
        let new_image = new ImageData(new Uint8ClampedArray(Util.grayscale_to_rgba(new_pixels)), image.width, image.height);

        ctx.putImageData(new_image, 0, 0);

    }

    set_mask(new_mask) {

        let viewer = null;
        let vs = this.instance._viewers;
        vs.forEach(function(e) { 
            if (e.id == 'viewer') {
            viewer = e;
            }
        });

        if (!viewer) {
            throw "OpenSeaDragon viewer not found.";
        }

        let canvas = viewer.canvas.children[0];
        width = canvas.width;
        height = canvas.height;

        let ctx = canvas.getContext('2d');
        let imagedata = ctx.getImageData(0, 0, width, height);
        let pixels = imagedata.data;

        let masked_image = Util.harden_mask(pixels, new_mask);

        console.log(masked_image);

        let masked_image_as_imagedata = new ImageData(masked_image, width, height);

        console.log(masked_image_as_imagedata);

        ctx.putImageData(masked_image_as_imagedata, 0, 0);


    }

    select_box(callback) {

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

            let topleft = {x: this.x1, y: this.y1};
            let bottomright = {x: this.x2, y: this.y2};

            callback(topleft, bottomright);
        }

        // let topleft = {x: 529, y: 480};
        // let bottomright = {x: 667, y: 588};
        // callback(topleft, bottomright);

      }
    
      
      // Add a click event listener to the document
      document.addEventListener("click", handleClick);

    // let topleft = {x: this.x1, y: this.y1};
    // let bottomright = {x: this.x2, y: this.y2};
    // callback(topleft, bottomright);

    }

    

}
  
