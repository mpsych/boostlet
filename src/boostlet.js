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

    this.framework = 'niivue';

  }

  /**
   * Let's the user select a region of interest box.
   */
  wait_for_box() {

    throw "Missing Implementation.";

  }

  /**
   * Let's the user select (multiple) seeds.
   */
  wait_for_seed(howmany) {

    throw "Missing Implementation.";

  }

}
