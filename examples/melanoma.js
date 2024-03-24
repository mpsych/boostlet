let boostletLoaded = false;
let tfscriptLoaded = false;

function tryRun() {
  if (boostletLoaded && tfscriptLoaded) {
    run();
  }
}

script = document.createElement("script");
script.type = "text/javascript";

script.src = "https://boostlet.org/dist/boostlet.min.js";
// script.src = "http://localhost:5500/dist/boostlet.min.js";
// script.src = "https://gaiborjosue.github.io/boostlet/dist/boostlet.min.js"
script.onload = function() {
  boostletLoaded = true;
  tryRun();
}
document.head.appendChild(script);


tfscript = document.createElement("script");
tfscript.type = "text/javascript";
tfscript.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest";
tfscript.onload = function() {
  tfscriptLoaded = true;
  tryRun();
}
document.head.appendChild(tfscript);


async function run() {
  
  // detect visualization framework
  Boostlet.init();

  getImage();


}


// Deep Learning
async function predict(file) {
  // Load model
  const model = await tf.loadLayersModel(
    "https://raw.githubusercontent.com/mpsych/melanoma/main/weights/model.json"
  );

  // Get the image
  const img = new Image();
  img.src = URL.createObjectURL(file);

  img.onload = async function () {
    let tensor = tf.browser.fromPixels(img).resizeNearestNeighbor([150, 150]).toFloat().expandDims();

    let prediction = await model.predict(tensor).dataSync();
    
    // Log if it is a melanoma or not, index 0 is not melanoma, index 1 is melanoma, the veredict is the highest value, the log should say the probability of the prediction
    if (prediction[0] > prediction[1]) {
      Boostlet.hint("The image is not a melanoma with a probability of: " + prediction[0]);
    } else {
      Boostlet.hint("The image is a melanoma with a probability of: " + prediction[1]);
    }

    BoostletHint.onclick = function () {
      // destroy on click
      window.document.body.removeChild(BoostletHint);
    }
  }
}

// Get an image from the current page
function getImage() {
  // Add a div element on the top corner of the screen for a drag and drop area
  const div = document.createElement("div");

  div.id = "dropzone";
  div.style.width = "200px";
  div.style.height = "100px";
  div.style.border = "2px dashed #aaa";
  div.style.position = "fixed";
  div.style.top = "19px";
  div.style.right = "10px";
  div.innerHTML = "Drop an image here!";
  div.style.zIndex = "99999";
  div.style.backgroundColor = "#fff";
  div.style.textAlign = "center";
  div.style.fontSize = "20px";
  

  document.body.appendChild(div);

  const dropzone = document.getElementById("dropzone");
      dropzone.ondragover = (event) => {
        event.preventDefault();
        dropzone.style.backgroundColor = "#eee";
      };
      dropzone.ondragleave = () => {
        dropzone.style.backgroundColor = "#fff";
      };
      dropzone.ondrop = (event) => {
        event.preventDefault();
        dropzone.style.backgroundColor = "#fff";

        const file = event.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) {
          predict(file);
        }
      };
}