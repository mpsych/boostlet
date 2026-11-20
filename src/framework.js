import {Util} from './util.js';

export class Framework {

  constructor(instance) {

    this.name = 'generic';
    this.instance = instance;

    this.flip_on_png = false;

  }

  get_image(from_canvas) {

    throw "Missing Implementation.";

  }

  set_image(new_pixels) {

    throw "Missing Implementation.";

  }

  set_mask(new_mask) {

    throw "Missing Implementation.";
    
  }

  select_box(callback) {

    throw "Missing Implementation.";

  }

  get_plane(loc) {

    throw "Missing Implementation.";

  }

  // the voxel methods below work in ras order so a plugin gets the same patch on any viewer

  // true once the viewer shows a volume
  has_volume() {

    return false;

  }

  // display value is raw times slope plus inter
  // cal_min and cal_max are the display window
  get_scaling() {

    throw "Missing Implementation.";

  }

  // ras voxel under the crosshair
  get_crosshair_vox() {

    throw "Missing Implementation.";

  }

  // call cb with a location object holding vox in ras and axCorSag on every crosshair move
  on_location_change(cb) {

    throw "Missing Implementation.";

  }

  // how the viewer draws a plane compared with ras
  // x true means the first in plane axis runs right to left on screen
  // y true means the second runs top to bottom
  // default is neurological with the nose to the right in sagittal
  get_display_flip(plane) {

    return { x: false, y: false };

  }

  // raw voxel values between two ras corners with x fastest
  get_subvolume(start, end) {

    throw "Missing Implementation.";

  }

  convert_to_png(uint8array, width, height) {

    return Util.convert_to_png(uint8array, width, height, this.flip_on_png);

  }

}
