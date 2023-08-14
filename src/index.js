
import {Boostlet} from "./boostlet.js"

// register global namespace with a new boostlet instance
// later we might want to support multiple active boostlets
window.Boostlet = new Boostlet();
