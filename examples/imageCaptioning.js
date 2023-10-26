import { HfInference } from "@huggingface/inference";

script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";
script.onload = run;
document.head.appendChild(script);
eval(script);


function run() {

  // detect visualization framework
  Boostlet.init();

  image = Boostlet.get_image();

  const inference = new HfInference('');

  await inference.imageToText({
    data: await (await fetch(image)).blob(),
    model: 'Salesforce/blip-image-captioning-base',
  })

}