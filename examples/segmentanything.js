script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";

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
  image = Boostlet.get_image(true); // grab image from canvas
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

  session = await ort.InferenceSession.create('https://cs666.org/onnx/sam.onnx');

  input = {};

  uint8arr = Uint8Array.from(atob(embedding[0]), (c) => c.charCodeAt(0));
  embedding = new ort.Tensor("float32", new Float32Array(uint8arr.buffer), [1, 256, 64, 64]);
  input['low_res_embedding'] = embedding;

  let x1 = topleft.x;
  let y1 = topleft.y;
  let x2 = bottomright.x;
  let y2 = bottomright.y;

  input['point_coords'] = new ort.Tensor("float32", new Float32Array([x1,y1,x2,y2]), [1, 2, 2]);


  // 2 and 3 mean top-left-bottom-right box
  input['point_labels'] = new ort.Tensor("float32", new Float32Array([2,3]), [1, 2]);

  // original image size
  input['image_size'] = new ort.Tensor("float32", new Float32Array([height, width]));

  // empty mask
  input['last_pred_mask'] = new ort.Tensor("float32", new Float32Array(256 * 256), [1, 1, 256, 256]);
  input['has_last_pred'] = new ort.Tensor("float32", new Float32Array([0]));

  return session.run( input ).then( result => {

    Boostlet.set_mask(result.output.data);

  }).catch(err => {

    console.error(err);

  });

};




