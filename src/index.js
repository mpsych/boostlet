
import {Boostlet} from "./boostlet.js"

window.console.log('BOOSTLET VERSION 0.1-beta');

// register global namespace with a new boostlet instance
// later we might want to support multiple active boostlets
window.Boostlet = new Boostlet();
