import {Util} from './util.js';

import {Framework} from './framework.js';

export class Boostlet {

  constructor() {

    this.framework = null;

  }

  /**
   * Initializes the Boostlet.
   * 
   * This includes several steps such as identifying the 
   * visualization/rendering framework that is available. 
   * 
   * TODO: Later we want to have fallbacks in place if the framework
   * is not detected.
   * 
   */
  init(name, instance) {

    if (typeof name != 'undefined' && typeof instance != 'undefined') {

      console.log('Framework forced by user!');
      throw "Forced Framework Not Implemented.";
      // TODO

    } else {

      this.framework = Util.detect_framework();

    }

    if (this.framework) {

      console.log('Found', this.framework, '!')
    
    } else {

      throw "Framework Not Found.";

    }

  }

  /**
   * Let's the user select a region of interest box.
   */
  async select_box(callback) {

    this.framework.select_box(callback);

  }

  /**
   * Let's the user select (multiple) seeds.
   */
  async select_seed(howmany) {

    throw "Missing Implementation.";

  }

  /**
   * Loads an external javascript file asynchronously. 
   */
  async load_script(url) {

    Util.load_script(url);

  }

  /**
   * Sends a HTTP POST request to a url with some data.
   */
  async send_http_post(url, data, callback) {

    Util.send_http_post(url, data, callback);

  }

  /**
   * Gets the current image (2D).
   * 
   * TODO: Optional bounding box should be supported.
   * 
   */
  get_current_image() {

    return this.framework.get_current_image();

  }

  /**
   * Encode raw image data to PNG.
   */
  convert_to_png(uint8array, width, height) {

    return this.framework.convert_to_png(uint8array, width, height);

  }

}
