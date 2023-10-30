script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";
script.onload = run;
document.head.appendChild(script);
eval(script);

async function run() {
    Boostlet.init();
  
    (async() => {
        await request()
    })
  }

const request = async function() {
        
    const API_url = "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large"
    const API_TOKEN = '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'
    const data = Boostlet.get_image();
  
    try {
      const response = await fetch(API_url, {
        headers: { Authorization: `Bearer ${API_TOKEN}` },
        method: "POST",
        body: data,
      });
  
      if (!response.ok) {
        console.error('Network response was not ok', response);
        return;
      }
  
      const resultData = await response.json();
      console.log(resultData);
    } catch (error) {
      console.error('There has been a problem with your fetch operation:', error);
    }
}