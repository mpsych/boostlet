import {Framework} from '../framework.js';

import {Util} from '../util.js';

export class OpenSeaDragon extends Framework {
    constructor(instance) {
        super(instance);
        this.name = 'opensedragon';

    }

    get_image(from_canvas) {
    

        // TODO needs to be generic and executed with Boostlet.init
        let canvas = viewer.canvas.children[0];
        let ctx = canvas.getContext("2d");

        let image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let rgba_image = Util.rgba_to_grayscale(image.data);

        return {'data':rgba_image, 'width':image.width, 'height':image.height};

    }

    set_image(new_pixels) {

        let canvas = viewer.canvas.children[0];
        let ctx = canvas.getContext("2d");
        let new_image = new ImageData(new Uint8ClampedArray(Util.grayscale_to_rgba(new_pixels)), image.width, image.height);

        ctx.putImageData(new_image, 0, 0);

    }

    set_mask(new_mask) {

    }

    select_box(callback) {

    }

}
  