script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";
script.onload = run;
script.onerror = function() { alert('Sobel could not load Boostlet'); };
document.head.appendChild(script);
eval(script);

CATEGORY = "Filter"

// say whether the filter ran or why it did not
function run() {
  try {
    apply();
    Boostlet.hint('Sobel applied', 2500);
  } catch (e) {
    Boostlet.hint('Sobel failed: ' + e.message, 5000);
  }
}

function apply() {
  
  // detect visualization framework
  Boostlet.init();

  image = Boostlet.get_image();


  kernel = [
    -1, 0, 1,
    -2, 0, 2,
    -1, 0, 1
  ];

  filtered = Boostlet.filter(image.data, image.width, image.height, kernel);

  Boostlet.set_image( filtered );

}
