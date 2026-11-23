import {Framework} from './framework.js';
import {Cornerstone2D} from './frameworks/cornerstone2d.js';
import {NiiVue} from './frameworks/niivue.js';
import { OpenSeaDragon } from './frameworks/openseadragon.js';
import { Xtk } from './frameworks/xtk.js';
import { Papaya } from './frameworks/papaya.js';
import { CanvasFallback } from './frameworks/canvasFallback.js';

export class Util {

  // check if an object resembles a niivue instance
  // instanceof breaks since boostlet loads its own copy of the module
  static looks_like_niivue(obj) {
    if (!obj || typeof obj !== 'object') return false
    if (!Array.isArray(obj.volumes)) return false
    if (typeof obj.getCanvasImage === 'function') return true // NiiVue 1.0
    if (!obj.scene || typeof obj.scene !== 'object') return false
    if (!obj.opts || obj.opts.sliceType === undefined) return false
    if (typeof obj.updateGLVolume !== 'function') return false
    return true
  }

  // scan all window properties for anything that looks like a niivue instance
  // runs only if the known name checks above miss
  static scan_window_for_niivue() {
    const seen = new Set()
    for (const key of Object.getOwnPropertyNames(window)) {
      let val
      try {
        val = window[key]
      } catch (e) {
        // some globals throw SecurityError on access which is annoying
        continue
      }
      if (!val || typeof val !== 'object') continue
      if (seen.has(val)) continue
      seen.add(val)
      if (Util.looks_like_niivue(val)) return val
    }
    return null
  }
  
  static detect_framework() {

    let framework = null;

    // known names, then NiiVue web components (they expose the instance even on ES module pages),
    // then the slow scan of window for anything that structurally matches niivue
    const element = window.document.querySelector('niivue-viewer, niivue-scene');
    const element_nv = element && (element.nv ?? element.scene?.getNiivue(0));
    const found = [window.nv, window.niivue, element_nv].find(Util.looks_like_niivue) || Util.scan_window_for_niivue();

    if (found) {

      framework = new NiiVue(found);

    } else if (Util.is_defined(window.cornerstone)) {

      framework = new Cornerstone2D(window.cornerstone);

    } else if (Util.is_defined(window.r)) {

      framework = new Xtk(window.r);

    } else if (Util.is_defined(window.OpenSeadragon)) {

      framework = new OpenSeaDragon(window.OpenSeadragon);

    } else if (Util.is_defined(window.papayaContainers)) {

      framework = new Papaya(window.papayaContainers)

    } else {

      framework = new CanvasFallback();

    }

    return framework;

  }

  static async load_script(url, callback) {

    // some libraries (e.g. on openneuro) expect a free `global`
    window.global ??= window;

    const script = window.document.createElement("script")
    script.type = "text/javascript"
    script.src = url;

    if (Util.is_defined(callback)) {
      script.onload = callback;
    }

    window.document.head.appendChild(script);

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

    let offscreen_ctx = offscreen.getContext('2d');

    let imgdata = offscreen_ctx.createImageData(offscreen.width, offscreen.height);
    imgdata.data.set(uint8array);
      // update canvas with new data
    offscreen_ctx.putImageData(imgdata, 0, 0);
    

    if (flip) {

      offscreen_ctx.save();
      offscreen_ctx.scale(1, -1); // Flip vertically
      offscreen_ctx.drawImage(offscreen, 0, -height); 
      offscreen_ctx.restore();

    }

    let base64 = offscreen.toDataURL('image/png');

    base64 = base64.replace("data:image/png;base64,","");

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

  /**
   * Harden a mask into a grayscale pixel array.
   * 
   * pixels needs to be RGBA
   * 
   * and mask binary.
   * 
   * maskcolor is optional and falls back to blue.
   * 
   **/
  static harden_mask(pixels, mask, maskcolor) {

    // Modified from: https://github.com/facebookresearch/segment-anything/blob/40df6e4046d8b07ab8c4519e083408289eb43032/demo/src/components/helpers/maskUtils.tsx
    // Copyright (c) Meta Platforms, Inc. and affiliates.
    // All rights reserved.


    let maskcolor_ = [0, 114, 189, 255];

    if (Util.is_defined(maskcolor)) {
      
      maskcolor_ = maskcolor;
      
    } 

    for (var i = 0; i < mask.length; i++) {

      if (mask[i] > 0.0) {
        pixels[4 * i + 0] = maskcolor_[0];
        pixels[4 * i + 1] = maskcolor_[1];
        pixels[4 * i + 2] = maskcolor_[2];
        pixels[4 * i + 3] = maskcolor_[3];
      }

    }

    return pixels;

  }

  static is_defined(variable) {

    return (typeof variable != 'undefined');

  }
  
  // "Boostlet Tooltips" - This is a hint mechanism that allows to display a message for a certain amount of time (ms).
  static hint(message, duration) {

    let hint = window.document.createElement('div');
    hint.id = 'BoostletHint';

    hint.style.position = 'fixed';
    hint.style.left = '10px';
    hint.style.top = '10px';
    hint.style.padding = '10px';
    hint.style.background = '#fff';
    hint.style.color = '#000';
    hint.style.zIndex = '100000';
    hint.style.border = '1px solid #007ec6';
    hint.style.borderRadius = '5px';
    hint.style.boxShadow = '0px 0px 20px 5px rgba(0,0,0, 0.3)';
    hint.style.fontSize = '14px';
    hint.style.fontWeight = 'bold';
    hint.style.textAlign = 'center';

    hint.textContent = message;
    
    window.document.body.appendChild(hint);

    if (typeof duration === 'number' && duration > 0) {
      setTimeout(function() {
        hint.remove();
      }, duration);
    }

  }

}
