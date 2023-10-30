script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";
script.onload = run;
document.head.appendChild(script);
eval(script);

function run() {
    Boostlet.init();
    
    console.log("Started")
    console.log(request())
    console.log("finished")
  }

async function request() {
        
    const API_url = "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large"
    const API_TOKEN = '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'
    
    const data = Boostlet.get_image();
  
    try {
      const response = await fetch(API_url, {
        headers: { Authorization: `Bearer ${API_TOKEN}` },
        method: "POST",
        body: data,
      });
  
       const data = await response.json();

    } catch (error) {

    }

    return data;
}