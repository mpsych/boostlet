script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";
script.onload = run;
document.head.appendChild(script);
eval(script);


const API_url = "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large"
const API_TOKEN = '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'


function run() {

  Boostlet.init();

  data = Boostlet.get_image();

  const response = await fetch(
        API_url,
        {
            headers: { Authorization: `Bearer ${API_TOKEN}` },
            method: "POST",
            body: data,
        }
    );

    const result = await response.json();


}


