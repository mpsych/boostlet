CATEGORY = "Hidden"

var script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://mpsych.github.io/powerboost/dist/powerboost.min.js";
script.onerror = function() { alert('PowerBoost could not load'); };
document.head.appendChild(script);
