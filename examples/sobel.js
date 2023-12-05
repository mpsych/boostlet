script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://gaiborjosue.github.io/boostlet/dist/boostlet.min.js"
// script.src = "http://127.0.0.1:5500/boostlet-edward/dist/boostlet.min.js"

script.onload = run;
document.head.appendChild(script);
eval(script);


function run() {
  
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
