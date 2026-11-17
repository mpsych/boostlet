script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";
script.onload = run;
script.onerror = function() { alert('Brainchop could not load Boostlet'); };
document.head.appendChild(script);
eval(script);

CATEGORY = "ML";

function run() {
  
  // detect visualization framework
  Boostlet.init();

  if (Boostlet.framework.name != 'niivue') {
    Boostlet.hint('Brainchop found no NiiVue viewer', 5000);
    return;
  }

  // JS MODULE HACK
  const moduleScript = document.createElement("script");
  moduleScript.type = "module";
  moduleScript.src = "https://boostlet.org/examples/brainchop_runner.js";  
  moduleScript.onerror = function() { Boostlet.hint('Brainchop could not load its runner', 5000); };
  document.head.appendChild(moduleScript);
  Boostlet.hint('Brainchop running, this can take a minute', 5000);

};
