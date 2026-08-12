const CATEGORY = "Utility";

// guard so clicking the bookmarklet twice doesnt break anything
if (typeof window._NumpyBoostletLoaded === 'undefined') {
window._NumpyBoostletLoaded = true;

(function() {

const NUMPY_TS_URL = 'https://cdn.jsdelivr.net/npm/numpy-ts@1.3.0/dist/numpy-ts.browser.js';
const ACE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/ace/1.33.0/ace.js';

// flag to suppress broadcasting when a change came from a remote peer
// prevents the echo loop where remote edits bounce back and forth
let remoteEdit = false

// register with sync so peers know this boostlet is active
// and so incoming messages get routed here
function applyRemoteCode(code) {
  if (!window._numpyEditor) return
  const cursor = window._numpyEditor.getCursorPosition()
  remoteEdit = true
  window._numpyEditor.setValue(code, -1)
  window._numpyEditor.moveCursorToPosition(cursor)
  setTimeout(() => { remoteEdit = false }, 0)
}

const syncEntry = {
  name: 'numpyBoostlet',
  url: 'https://boostlet.org/examples/numpyBoostlet.js',
  onMessage: function(msg) {
    if (msg.type === 'numpy-edit' && msg.code !== window._numpyEditor?.getValue()) {
      applyRemoteCode(msg.code)
    }
    if (msg.type === 'numpy-run') {
      applyRemoteCode(msg.code)
      runCode(false)
    }
    if (msg.type === 'numpy-undo') {
      undoCode(false)
    }
  }
}

if (typeof window.registerBoostletSync === 'function') {
  window.registerBoostletSync(syncEntry)
} else {
  ;(window.__boostlet_active = window.__boostlet_active || []).push(syncEntry)
}

// load boostlet first then poll until niivue is detected
const boostletScript = document.createElement('script');
boostletScript.type = 'text/javascript';
boostletScript.src = 'https://boostlet.org/dist/boostlet.min.js';
boostletScript.onload = function() {
  var poll = setInterval(function() {
    try {
      Boostlet.init();
      clearInterval(poll);
      setup();
    } catch(e) {}
  }, 300);
};
document.head.appendChild(boostletScript);

async function setup() {
  if (Boostlet.framework.name !== 'niivue') {
    alert('numpyBoostlet only supports niivue');
    return;
  }

  // shortcut so user code can write Boostlet.nv instead of Boostlet.framework.instance
  Boostlet.nv = Boostlet.framework.instance;

  // load numpyts and expose it globally
  window.np = await import(NUMPY_TS_URL);

  // wraps the full volume typed array into a numpyts ndarray
  // no slope or intercept applied here
  Boostlet.to_np = function() {
    const img = Boostlet.nv.volumes[0].img;
    return np.array(Array.from(img), 'float32');
  };

  // writes a numpyts ndarray or plain typed array back into vol.img and renders
  Boostlet.from_np = function(arr) {
    const vol = Boostlet.nv.volumes[0];
    const src = (arr && arr.data) ? arr.data : arr;
    vol.img.set(src);
    Boostlet.nv.updateGLVolume();
  };

  // load ace then build the editor panel
  const aceScript = document.createElement('script');
  aceScript.src = ACE_URL;
  aceScript.onload = function() { plot(); };
  document.head.appendChild(aceScript);
}

// snapshot of vol.img saved before each run so undo can restore it
window._numpySnapshot = null;

// broadcast controls whether this run is sent to peers
// set to false when we are applying a remote run to avoid echo
function runCode(broadcastRun) {
  if (broadcastRun === undefined) broadcastRun = true;
  const outputDiv = document.getElementById('nb-output');
  const vol = Boostlet.nv.volumes[0];

  // save current state before running
  window._numpySnapshot = vol.img.slice();
  outputDiv.innerHTML = '';

  // redirect console.log to the output div for this run
  const origLog = console.log;
  console.log = function(msg) { outputDiv.innerHTML += msg + '<br>'; };

  // wrap in async so user code can await if needed
  const code = window._numpyEditor.getValue();
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  new AsyncFunction(code)().then(() => {
    console.log = origLog;
    if (broadcastRun && typeof window.__sync_send === 'function') {
      window.__sync_send({ type: 'numpy-run', code })
    }
  }).catch(err => {
    outputDiv.innerHTML += '<span style="color:#f77">' + err.toString() + '</span>';
    console.log = origLog;
  });
}

function undoCode(broadcastUndo) {
  if (broadcastUndo === undefined) broadcastUndo = true;
  if (!window._numpySnapshot) return;
  Boostlet.nv.volumes[0].img.set(window._numpySnapshot);
  Boostlet.nv.updateGLVolume();
  window._numpySnapshot = null;
  document.getElementById('nb-output').innerHTML = '<span style="color:#aaa">undo applied</span>';
  if (broadcastUndo && typeof window.__sync_send === 'function') {
    window.__sync_send({ type: 'numpy-undo' })
  }
}

function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    #nb-panel {
      position: fixed; top: 40px; left: 40px; z-index: 2147483647;
      width: 600px; height: 500px; min-width: 300px; min-height: 200px; font-family: monospace;
      background: #1a1a1a; border: 1px solid #444; border-radius: 6px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.6);
      resize: both; overflow: hidden;
      display: flex; flex-direction: column;
    }
    #nb-titlebar {
      padding: 8px 12px; background: #111;
      border-radius: 6px 6px 0 0; border-bottom: 1px solid #333;
      display: flex; align-items: center; justify-content: space-between;
      user-select: none; cursor: move;
    }
    #nb-titlebar span { color: #aaa; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
    #nb-titlebar span em { color: #555; font-style: normal; }
    #nb-sync-indicator {
      font-size: 10px; color: #555; letter-spacing: 0.05em;
    }
    #nb-sync-indicator.active { color: #4a4; }
    #nb-close { color: #666; cursor: pointer; font-size: 16px; }
    #nb-editor-div { width: 100%; flex: 1; min-height: 100px; overflow: hidden; }
    #nb-toolbar {
      padding: 6px 10px; background: #111; border-top: 1px solid #333;
      display: flex; align-items: center; gap: 8px;
    }
    #nb-toolbar span { color: #555; font-size: 11px; }
    #nb-run-btn, #nb-undo-btn {
      border: none; border-radius: 4px;
      padding: 5px 16px; font-family: monospace; font-size: 13px; cursor: pointer;
    }
    #nb-run-btn { background: #2a6; color: #fff; }
    #nb-undo-btn { background: #333; color: #aaa; border: 1px solid #555; }
    #nb-output {
      padding: 8px 12px; min-height: 32px; max-height: 120px; overflow-y: auto;
      color: #7cf; font-size: 12px; border-top: 1px solid #333;
      background: #0d0d0d; border-radius: 0 0 6px 6px;
    }
  `;
  document.head.appendChild(style);
}

function plot() {
  const existing = document.getElementById('nb-panel');
  if (existing) existing.remove();

  injectStyles();

  const div = document.createElement('div');
  div.id = 'nb-panel';
  div.innerHTML = `
    <div id="nb-titlebar">
      <span>numpy boostlet &nbsp;<em>Boostlet.nv &bull; Boostlet.to_np() &bull; Boostlet.from_np(arr) &bull; np</em></span>
      <span id="nb-sync-indicator">sync off</span>
      <span id="nb-close">&#x2715;</span>
    </div>
    <div id="nb-editor-div"></div>
    <div id="nb-toolbar">
      <button id="nb-run-btn">run</button>
      <button id="nb-undo-btn">undo</button>
      <span>ctrl+enter</span>
    </div>
    <div id="nb-output"></div>
  `;
  document.body.appendChild(div);

  const editor = ace.edit('nb-editor-div');
  editor.setTheme('ace/theme/monokai');
  editor.session.setMode('ace/mode/javascript');
  editor.setFontSize(13);
  editor.setOption('wrap', true);
  editor.setValue(
`// Available API:
//   Boostlet.nv          — the live NiiVue instance
//   Boostlet.to_np()     — wraps vol.img into a numpyts ndarray
//   Boostlet.from_np(arr)— writes an ndarray or typed array back and re-renders
//   np                   — numpyts, loaded globally

// --- Example 1: plain typed-array manipulation (no np needed) ---
const vol = Boostlet.nv.volumes[0];
const img = vol.img;

// clamp every voxel to half its current value
for (let i = 0; i < img.length; i++) {
  img[i] = img[i] * 0.5;
}
Boostlet.nv.updateGLVolume();

// --- Example 2: using numpyts ---
// const arr = Boostlet.to_np();
// const scaled = np.multiply(arr, np.array([2.0], 'float32'));
// Boostlet.from_np(scaled);`,
    -1
  );
  window._numpyEditor = editor;

  // update sync indicator based on whether sync is active
  const indicator = document.getElementById('nb-sync-indicator');
  function refreshIndicator() {
    const hasPeers = typeof window.__sync_send === 'function'
    indicator.textContent = hasPeers ? 'sync on' : 'sync off'
    indicator.className = hasPeers ? 'active' : ''
  }
  refreshIndicator()
  setInterval(refreshIndicator, 2000)

  // broadcast code edits to peers for live typing sync
  // skips broadcast if the change came from a remote peer to prevent echo loop
  let editBroadcastTimer = null
  editor.session.on('change', () => {
    if (remoteEdit) return
    if (typeof window.__sync_send !== 'function') return
    clearTimeout(editBroadcastTimer)
    // debounce slightly so we dont flood the channel on every keystroke
    editBroadcastTimer = setTimeout(() => {
      window.__sync_send({ type: 'numpy-edit', code: editor.getValue() })
    }, 80)
  })

  // keep ace redrawn when the panel is resized
  new ResizeObserver(() => editor.resize()).observe(document.getElementById('nb-editor-div'));

  editor.commands.addCommand({
    name: 'run',
    bindKey: { win: 'Ctrl-Enter', mac: 'Cmd-Enter' },
    exec: () => runCode(true)
  });

  document.getElementById('nb-run-btn').addEventListener('click', () => runCode(true));
  document.getElementById('nb-undo-btn').addEventListener('click', undoCode);
  document.getElementById('nb-close').addEventListener('click', () => div.remove());

  // drag is bound to the titlebar only so the editor stays interactive
  const titlebar = document.getElementById('nb-titlebar');
  titlebar.addEventListener('mousedown', function(e) {
    if (e.target.id === 'nb-close') return;
    const startX = e.clientX, startY = e.clientY;
    const startLeft = div.offsetLeft, startTop = div.offsetTop;
    function onMove(e) {
      div.style.left = (startLeft + e.clientX - startX) + 'px';
      div.style.top  = (startTop  + e.clientY - startY) + 'px';
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

})();
}
