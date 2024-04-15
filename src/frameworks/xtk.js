import { Framework } from "../framework.js";

import { Util } from "../util.js";

import { CanvasFallback } from "./canvasFallback.js";

export class Xtk extends Framework {
  constructor(instance) {
    super(instance);
    this.name = "xtk";
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
    return this.canvasFallback.select_box(callback);
  }
}
