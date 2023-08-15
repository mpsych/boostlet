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

  // load ONNX.js
  Boostlet.load_script('https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js');

  // grab the embedding
  setup_segment_anything();

  // setup interaction and trigger segmentation
  Boostlet.select_box( segment_box );

}

function setup_segment_anything() {

  url = 'https://model-zoo.metademolab.com/predictions/segment_everything_box_model';
  image = Boostlet.get_current_image(true); // grab image from canvas
  pixels = image.data;
  width = image.width;
  height = image.height;
  png_image = Boostlet.convert_to_png(pixels, width, height);

  embedding = null;
  Boostlet.send_http_post( url, png_image, function(result) {
    
    embedding = JSON.parse(result);

  } );

}

async function segment_box(topleft, bottomright) {
  
  console.log(topleft, bottomright);

  session = await ort.InferenceSession.create('https://cs666.org/onnx/sam.onnx');

  input = {};

  uint8arr = Uint8Array.from(atob(embedding[0]), (c) => c.charCodeAt(0));
  embedding = new ort.Tensor("float32", new Float32Array(uint8arr.buffer), [1, 256, 64, 64]);
  input['low_res_embedding'] = embedding;


  // TODO

};




