script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";
script.onload = run;
document.head.appendChild(script);
eval(script);

const API_URL = 'https://api.openai.com/v1/chat/completions';
const API_TOKEN = ''

async function run() {

    // detect visualization framework
    Boostlet.init();

    const requestData = await request();
    console.log(requestData);

    requestDataText = requestData[0]['generated_text']
    // display the image captioning text
    displayText(requestDataText);

  }

async function request() {

  image = Boostlet.get_image(true); // grab image from canvas
  pixels = image.data;
  width = image.width;
  height = image.height;
  png_image = Boostlet.convert_to_png(pixels, width, height);

  const data = {
    model: "gpt-4-vision-preview",
    messages: [
      {
        "role": "user",
        "content": [
          {"type": "text", "text": "What’s in this image?"},
          {"type": "image", "data": png_image},
        ],
      },
    ],
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data),
  });

  return await response.json();

}

function displayText(captionText) {

    const windowContainer = window.document.createElement('div');
    windowContainer.classList.add('window');

    const container = window.document.createElement('div');
    container.id = 'ImageCaptioningDiv';
    container.style.width = '400px';
    container.style.height = '100px';

    const textElement = window.document.createElement('p');
    textElement.textContent =  captionText;
    textElement.style.textAlign = 'center';
    container.appendChild(textElement);
    windowContainer.appendChild(container);

    container.onclick = function () {
        // destroy on click
        window.document.body.removeChild(container);
    }
    window.document.body.appendChild(container);

}