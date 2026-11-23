// Runs examples/<name>.js against this checkout: every https://boostlet.org/ URL in it (dist, helper
// examples) is rewritten to the local server, so test pages don't exercise production.
// Use <script src="js/local_example.js" data-example="sobel"></script>, or call loadLocalExample(name).
// Waits for window.nv to hold a volume so the example never runs on a loading screen.
async function loadLocalExample(name) {
  while (!window.nv?.volumes?.length) await new Promise(r => setTimeout(r, 100))
  const source = await fetch(`/examples/${name}.js`).then(r => r.text())
  const script = document.createElement('script')
  script.src = URL.createObjectURL(new Blob([source.replaceAll('https://boostlet.org/', location.origin + '/')]))
  document.head.appendChild(script)
}
if (document.currentScript?.dataset.example) loadLocalExample(document.currentScript.dataset.example)
