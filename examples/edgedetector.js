script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";
script.onload = run;
document.head.appendChild(script);
eval(script);

CATEGORY = "Filter"

function run() {
  
  // detect visualization framework
  Boostlet.init();

  image = Boostlet.get_image();

  kernel = [
  -1, -2, -2, -1,
   0,  0,  0,  0,
   1,  2,  2,  1,
   0,  0,  0,  0
  ];

  filtered = Boostlet.filter(image.data, image.width, image.height, kernel);

  Boostlet.set_image( filtered );

}
