import {Framework} from './framework.js';
import {NiiVue} from './framework_niivue.js';

export class Boostlet {

  constructor() {

    this.framework = null;

  }

  init() {

    // detect which framework is available and pick the first one

    this.framework = 'niivue';

  }

  wait_for_box() {

    throw "Missing Implementation.";

  }

  wait_for_seed() {

    throw "Missing Implementation.";

  }

}
