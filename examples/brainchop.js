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

  // JS MODULE HACK
  const moduleScript = document.createElement("script");
  moduleScript.type = "module";
  moduleScript.src = "https://boostlet.org/examples/brainchop_runner.js";  
  document.head.appendChild(moduleScript);

};
