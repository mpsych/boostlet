// 0. LOAD BOOSTLET LIBRARY
const script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://mpsych.github.io/boostlet/dist/boostlet.min.js";
document.head.appendChild(script);
eval(script);


// 1. SETUP
Boostlet.init();

// 2. GET ONNX.JS LIBRARY
Boostlet.load_script('https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js');

// 3. QUERY FOR EMBEDDING
let url = 'https://model-zoo.metademolab.com/predictions/segment_everything_box_model';
let image = Boostlet.get_current_image();
let embedding = Boostlet.send_http_post( url, image );




// 4. ENABLE USER INTERACTION
await Boostlet.select_box();

// 5. SEGMENT

