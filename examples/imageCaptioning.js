script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";
script.onload = run;
document.head.appendChild(script);
eval(script);


const API_url = "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large"
const API_TOKEN = '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'


async function run() {
    Boostlet.init();
    
    console.log("Started")
    
    // Call request function and wait for it to finish
    const requestData = await request();
    
    console.log(requestData);

    console.log("finished")
  }

async function request() {
  image = Boostlet.get_image(true); // grab image from canvas
  pixels = image.data;
  width = image.width;
  height = image.height;
  png_image = Boostlet.convert_to_png(pixels, width, height);

  const response = await fetch(API_url, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
    method: "POST",
    body: png_image,
  });

  console.log("Fetched data")

  const requestdata = await response.json();
  return requestdata;
}