const script = document.createElement("script");
script.type = "text/javascript";
script.src = "http://localhost:8000/dist/boostlet.min.js";
//script.src = "https://mpsych.github.io/boostlet/dist/boostlet.min.js";
script.onload = run;
document.head.appendChild(script);
eval(script);


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
