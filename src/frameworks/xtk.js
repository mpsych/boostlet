import {Framework} from '../framework.js';

import {Util} from '../util.js';

export class Xtk extends Framework {
    constructor(instance) {
        super(instance);
        this.name = 'xtk';
    
    }

    get_image(from_canvas) {
        let imageData = this.instance.K; // change to .J for slicedrop
        let width = this.instance.dimensions[2];
        let height = this.instance.dimensions[1];

        return {'data':imageData, 'width':width, 'height':height};
        // return {'data':pixels, 'width':image.width, 'height':image.height};
    }

    set_image(new_pixels) {
        let imageData = this.instance.K; // change to .J for slicedrop
        let width = this.instance.dimensions[2];
        let height = this.instance.dimensions[1];

        imageData = new_pixels;
        imageData.width = width;
        imageData.height = height;

        window.r.render();
    }
}
  
