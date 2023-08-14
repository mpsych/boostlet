import {Framework} from './framework.js';
import {NiiVue} from './framework_niivue.js';

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
   * TODO: We also want to have a force mode where the developer
   * can specify which framework to use as a bypass of the detection.
   * 
   */
  init() {

    // TODO: detect which framework is available and pick the first one

    if (typeof window.nv != 'undefined') {
    
      this.framework = new NiiVue(window.nv);
    
    } else if (typeof window.niivue != 'undefined') {
      
      this.framework = new NiiVue(window.niivue);

    }

    if (this.framework) {

      console.log('Found', this.framework, '!')
    
    } else {

      // TODO: fallback to general canvas or webgl framework
      throw "Framework Not Found.";

    }

  }

  /**
   * Let's the user select a region of interest box.
   */
  async select_box() {

    throw "Missing Implementation.";

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
  load_script(url) {

    const script = window.document.createElement("script")
    script.type = "text/javascript"
    script.src = url;
    window.document.head.appendChild(script);
    eval(script);

  }

  /**
   * Sends a HTTP POST request to a url with some data.
   */
  async send_http_post(url, data) {

    xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        // request done
        return xhr.response;
      }
    }

    xhr.send(data)

  }

  /**
   * Gets the current image (2D).
   */
  get_current_image() {

    return this.framework.get_current_image();

  }

  /**
   * Encode raw image data to PNG.
   * 
   * TODO: Make flipping optional and dependent on framework.
   */
  convert_to_png(uint8array, width, height) {

    // we are using an offscreen canvas for this
    let offscreen = window.document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    window.document.body.append(offscreen);

    let offscreen_ctx = offscreen.getContext('2d');

    imgdata = offscreen_ctx.createImageData(offscreen.width, offscreen.height);
    pxdata = imgdata.data;

    for (var i =0; i<pxdata.length;i++) {
        
      pxdata[i] = pixels[i];

    }
      // update canvas with new data
    offscreen_ctx.putImageData(imgdata, 0, 0);
    offscreen_ctx.save();
    offscreen_ctx.scale(1, -1); // Flip vertically
    offscreen_ctx.drawImage(offscreen, 0, -c.height); // Draw with flipped coordinates
    offscreen_ctx.restore();

    base64 = offscreen.toDataURL('image/png')
    base64 = base64.replace("data:image/png;base64,","")
    pngpixels = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    return pngpixels;

  }

}
