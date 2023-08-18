import {Framework} from './framework.js';
import {Cornerstone2D} from './frameworks/cornerstone2d.js';
import {NiiVue} from './frameworks/niivue.js';

export class Util {
  
  static detect_framework() {

    let framework = null;

    if (typeof window.nv != 'undefined') {
    
      framework = new NiiVue(window.nv);
    
    } else if (typeof window.niivue != 'undefined') {
      
      framework = new NiiVue(window.niivue);

    } else if (typeof window.cornerstone != 'undefined') {

      framework = new Cornerstone2D(window.cornerstone);

    }

    // TODO: fallback to general canvas or webgl framework

    return framework;

  }

  static async load_script(url, callback) {

    const script = window.document.createElement("script")
    script.type = "text/javascript"
    script.src = url;

    if (typeof callback != 'undefined') {
      script.onload = callback;
    }

    window.document.head.appendChild(script);
    eval(script);
    
  }

  static async send_http_post(url, data, callback) {

    let xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        // request done
        callback( xhr.response );

        return;

      }
    }

    xhr.send(data)

  }

  static convert_to_png(uint8array, width, height, flip) {

    // we are using an offscreen canvas for this
    let offscreen = window.document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    window.document.body.append(offscreen);

    let offscreen_ctx = offscreen.getContext('2d');

    let imgdata = offscreen_ctx.createImageData(offscreen.width, offscreen.height);
    let pxdata = imgdata.data;

    for (var i =0; i<pxdata.length;i++) {
        
      pxdata[i] = uint8array[i];

    }
      // update canvas with new data
    offscreen_ctx.putImageData(imgdata, 0, 0);
    offscreen_ctx.save();

    if (typeof flip != 'undefined') {
      offscreen_ctx.scale(1, -1); // Flip vertically
    }
    
    let c_height = height;

    if (typeof flip != 'undefined') {
      c_height = -height;
    }

    offscreen_ctx.drawImage(offscreen, 0, c_height); 
    offscreen_ctx.restore();

    let base64 = offscreen.toDataURL('image/png')
    base64 = base64.replace("data:image/png;base64,","")
    let pngpixels = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    return pngpixels;

  }

  static filter(pixels, width, height, kernel) {

    const kernelSize = Math.sqrt(kernel.length);
    const halfKernelSize = Math.floor(kernelSize / 2);

    const new_pixels = pixels.slice();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dstIndex = y * width + x;

        let newValue = 0;
        for (let ky = 0; ky < kernelSize; ky++) {
          for (let kx = 0; kx < kernelSize; kx++) {
            const srcX = x + kx - halfKernelSize;
            const srcY = y + ky - halfKernelSize;
            const srcIndex = srcY * width + srcX;

            const kernelValue = kernel[ky * kernelSize + kx];
            newValue += pixels[srcIndex] * kernelValue;
          }
        }

        new_pixels[dstIndex] = newValue;

      }
    }

    return new_pixels;

  }

  static grayscale_to_rgba(grayscale) {

    const rgba = new Uint8Array(grayscale.length * 4);

    for (let i = 0; i < grayscale.length; i++) {
      const g = grayscale[i];
      const index = i * 4;

      rgba[index] = g;
      rgba[index + 1] = g;
      rgba[index + 2] = g;
      rgba[index + 3] = 255; 
    }

    return rgba;

  }

  static rgba_to_grayscale(rgba) {

    const grayscale = new Uint8Array(rgba.length / 4);

    for (let i = 0; i < rgba.length; i += 4) {

      grayscale[i / 4] = rgba[i];

    }

    return grayscale;

  }

}