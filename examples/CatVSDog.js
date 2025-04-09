
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
  Boostlet.load_script('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js', async function() {

	  // TF available
	  model = await tf.loadLayersModel("https://fly.cs.umb.edu/data/X/catdog/model.json");
	    
	  width = nv.volumes[0].dimsRAS[1]
	  height = nv.volumes[0].dimsRAS[2]

	  // GRAB DATA
	  const imageData = new ImageData(new Uint8ClampedArray(nv.volumes[0].img), width, height);

	  // RESHAPE
	  tensor = tf.browser.fromPixels(imageData).resizeNearestNeighbor([150, 150]) 
	  							.div(tf.scalar(255)) // normalize
	  							.expandDims();

	  // INFERENCE
	  prediction = await model.predict(tensor).dataSync();


	  if (prediction < 0.5) {

	  	// its a cat
	  	text = "MEOW " + Math.round((1-prediction)*100,2) + "% !";

	  } else {

	  	// WOOF
	  	text = "WOOF " + Math.round(prediction*100,2) + "% !";

	  }
	 

		const topText = document.createElement('div');
		topText.innerText = text;
		topText.style.position = 'absolute';
		topText.style.top = '0';
		topText.style.left = '0';
		topText.style.width = '100%';
		topText.style.textAlign = 'center';
		topText.style.padding = '40px';
		topText.style.fontSize = '48px';
		topText.style.fontWeight = 'bold';
		topText.style.fontFamily = 'sans-serif';
		topText.style.zIndex = 31337;
		document.body.appendChild(topText);


	  console.log(prediction);

  });


}




