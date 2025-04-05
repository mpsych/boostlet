script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";
script.onload = run;
document.head.appendChild(script);
eval(script);

CATEGORY = "ML";

function run() {
  
  // detect visualization framework
  Boostlet.init();

  if (Boostlet.framework.name != 'niivue') {
    alert('Only niivue is supported right now :(');
    return;
  }

  import { runInference } from "http://haehn.github.io/brainchop/brainchop-mainthread.js";
  import { inferenceModelsList, brainChopOpts } from "http://haehn.github.io/brainchop/brainchop-parameters.js";
  import { isChrome, localSystemDetails } from "http://haehn.github.io/brainchop/brainchop-diagnostics.js";
  import MyWorker from "http://haehn.github.io/brainchop/brainchop-webworker.js?worker";

};
