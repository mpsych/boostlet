script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";
script.onload = run;
document.head.appendChild(script);
eval(script);

CATEGORY = "ML"

function run() {
  
  // detect visualization framework
  Boostlet.init();

  // load TF.js
  Boostlet.load_script('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js', function() {

    // TF available
    model = await tf.loadLayersModel("https://fly.cs.umb.edu/data/X/catdog/model.json");
    
    width = nv.volumes[0].dimsRAS[1]
height = nv.volumes[0].dimsRAS[2]

const imageData = new ImageData(new Uint8ClampedArray(nv.volumes[0].img), width, height);

tensor = tf.browser.fromPixels(imageData).resizeNearestNeighbor([150, 150]) // resize
  							.div(tf.scalar(255)) // normalize
  							.expandDims();

prediction = await model.predict(tensor).dataSync();

console.log(prediction);



  });


}



