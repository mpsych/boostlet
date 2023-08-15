import {Util} from './util.js';

export class Framework {

  constructor(instance) {

    this.name = 'generic';
    this.instance = instance;

    this.flip_on_png = false;

  }

  get_current_image() {

    throw "Missing Implementation.";

  }

  select_box(callback) {

    throw "Missing Implementation.";

  }

  convert_to_png(uint8array, width, height) {

    return Util.convert_to_png(uint8array, width, height, this.flip_on_png);

  }

}
