CATEGORY = "Hidden"

script = document.createElement("script");
script.type = "text/javascript";
script.src = "https://boostlet.org/dist/boostlet.min.js";

script.onload = run;
script.onerror = function() { alert('Image Captioning could not load Boostlet'); };
// Hugging Face's OpenAI-compatible router. BLIP (the old captioner) has no inference provider any
// more, so ask a served vision-language model instead.
// var not const so loading this twice on one page does not throw
var API_url = "https://router.huggingface.co/v1/chat/completions"
var MODEL = "google/gemma-4-31B-it"
var API_TOKEN = null // asked at run time; never commit a token

// skip loading boostlet again when the page already has it
if (window.Boostlet) run(); else document.head.appendChild(script);

async function run() {

  // detect visualization framework
  Boostlet.init();

  displayText(await request().catch(e => `Captioning failed: ${e.message ?? e}`));

}

async function request() {

  API_TOKEN = API_TOKEN || prompt('This sends the current view to Hugging Face (and its inference providers) for captioning.\nHugging Face access token (huggingface.co/settings/tokens):');
  if (!API_TOKEN) return 'Captioning cancelled';

  // the displayed view as RGBA: canvas pixels, except on NiiVue where get_image(true) means raw
  // voxels and get_image() is the rendered view in grayscale
  let rgba, image;
  if (Boostlet.framework.name === 'niivue') {
    image = Boostlet.get_image();
    rgba = new Uint8Array(image.data.length * 4).fill(255);
    for (let i = 0; i < image.data.length; i++) rgba[4 * i] = rgba[4 * i + 1] = rgba[4 * i + 2] = image.data[i];
  } else {
    image = Boostlet.get_image(true);
    rgba = image.data;
  }
  const png = Boostlet.convert_to_png(rgba, image.width, image.height);
  const dataUrl = await new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(new Blob([png], { type: 'image/png' }));
  });

  const response = await fetch(API_url, {
    headers: { Authorization: `Bearer ${API_TOKEN}`, 'Content-Type': 'application/json' },
    method: "POST",
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 80,
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Describe this image in one short sentence.' },
        { type: 'image_url', image_url: { url: dataUrl } }
      ] }]
    }),
  });
  const result = await response.json();
  return result.choices?.[0]?.message?.content ?? `Captioning failed: ${result.error?.message ?? result.error ?? response.status}`;

}

function displayText(captionText) {

  Boostlet.hint(captionText);

  BoostletHint.onclick = function () {
    // destroy on click
    window.document.body.removeChild(BoostletHint);
  }

}