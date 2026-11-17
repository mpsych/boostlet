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

// text the editor starts with so an untouched editor can be told from an edited one
let defaultCode = ''
let lastEditor = 'you'
// name of the peer whose change to the script has not been approved here yet
let unapproved = ''
// true while the approval bar is showing a run request from a peer
let pendingRun = false
// hash of the script this page ran last so a peer undo only reverts that same run
let lastRunHash = null

const peerName = id => 'peer ' + String(id || '?').slice(-4)
const editorText = () => window._numpyEditor.getValue()
const send = msg => window.__sync_send?.(msg)

// sha 256 of the script with line endings normalised so both sides hash the same text
async function hashCode(code) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code.replace(/\r\n/g, '\n')))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// notes go in as plain text because they can contain a peer id
function say(text) {
  const out = document.getElementById('nb-output')
  if (out) out.textContent = text
}

// redraws the status line and shows the approval bar when there is a question to ask
function refresh(question) {
  const status = document.getElementById('nb-status')
  if (!status) return
  status.textContent = unapproved ? 'changed by ' + unapproved + ' and not approved yet' : 'last edit by ' + lastEditor
  document.getElementById('nb-approve').style.display = question ? 'flex' : 'none'
  if (question) document.getElementById('nb-approve-text').textContent = question
  else pendingRun = false
}

// run button and ctrl enter land here
// a script that a peer changed is never run without asking first
function requestRun() {
  if (unapproved) refresh('this script was changed by ' + unapproved + '. read it then approve')
  else runCode(true)
}

// any edit here or from a peer closes the bar first
// so the text on screen is the text that was asked about
function approveRun() {
  const fromPeer = pendingRun
  unapproved = ''
  refresh()
  runCode(!fromPeer)
}

function applyRemoteCode(code) {
  const cursor = window._numpyEditor.getCursorPosition()
  remoteEdit = true
  window._numpyEditor.setValue(code, -1)
  window._numpyEditor.moveCursorToPosition(cursor)
  setTimeout(() => { remoteEdit = false }, 0)
}

// register with sync so peers know this boostlet is active
// and so incoming messages get routed here with the id of the peer that sent them
const syncEntry = {
  name: 'numpyBoostlet',
  url: 'https://boostlet.org/examples/numpyBoostlet.js',
  onMessage: async function(msg, peerId) {
    const who = peerName(peerId)
    // sync raises this when a peer connects so a late joiner can ask for the script
    if (msg.type === 'sync-peer-open') send({ type: 'numpy-hello' })
    if (!window._numpyEditor) return

    // answer with our script unless the editor was never touched
    if (msg.type === 'numpy-hello' && editorText() !== defaultCode) {
      send({ type: 'numpy-edit', code: editorText(), joining: true })
    }

    if (msg.type === 'numpy-edit' && typeof msg.code === 'string' && msg.code !== editorText()) {
      // a script sent on join only lands in an untouched editor
      if (msg.joining && editorText() !== defaultCode) return say(who + ' has a different script in their editor')
      applyRemoteCode(msg.code)
      unapproved = lastEditor = who
      refresh()
    }

    if (msg.type === 'numpy-run') {
      // run what is in the local editor only and never code from the message
      // the hash proves both editors hold the same script
      const code = editorText()
      if (msg.hash !== await hashCode(code)) return say(who + ' ran a different script than the one in this editor so nothing was run here')
      if (!unapproved) return runCode(false, code)
      pendingRun = true
      refresh(who + ' asked to run this script. it was changed by ' + unapproved + '. read it then approve')
    }

    // only undo the run this page also executed
    if (msg.type === 'numpy-undo' && msg.hash && msg.hash === lastRunHash) undoCode(false)
  }
}

if (typeof window.registerBoostletSync === 'function') {
  window.registerBoostletSync(syncEntry)
} else {
  ;(window.__boostlet_active = window.__boostlet_active || []).push(syncEntry)
}

// load boostlet once then wait for niivue with a loaded volume
if (window.Boostlet) {
  waitForViewer();
} else {
  const boostletScript = document.createElement('script');
  boostletScript.src = 'https://boostlet.org/dist/boostlet.min.js';
  boostletScript.onload = waitForViewer;
  document.head.appendChild(boostletScript);
}

function waitForViewer() {
  let tries = 0;
  const poll = setInterval(function() {
    try { Boostlet.init(); } catch(e) {}
    const fw = Boostlet.framework;
    const ready = fw && fw.name === 'niivue' && fw.instance.volumes && fw.instance.volumes.length;
    if (!ready && ++tries <= 40) return;
    clearInterval(poll);
    if (ready) {
      // numpy-ts and the editor take a few seconds so say something right away
      Boostlet.hint('NumPy Boostlet loading', 2000);
      setup().catch(() => {
        delete window._NumpyBoostletLoaded;
        Boostlet.hint('NumPy Boostlet could not load numpy-ts', 5000);
      });
      return;
    }
    // init falls back to a plain canvas so no niivue after 12 seconds means there is none
    // clearing the flag lets the bookmark be clicked again
    delete window._NumpyBoostletLoaded;
    Boostlet.hint('NumPy Boostlet found no NiiVue viewer with a loaded volume', 5000);
  }, 300);
}

async function setup() {
  // shortcut so user code can write Boostlet.nv instead of Boostlet.framework.instance
  Boostlet.nv = Boostlet.framework.instance;

  // load numpyts and expose it globally
  window.np = await import(NUMPY_TS_URL);

  // wraps the full volume typed array into a numpyts ndarray
  // no slope or intercept applied here so values are raw voxel units
  Boostlet.to_np = function() {
    const img = Boostlet.nv.volumes[0].img;
    return np.array(img, 'float32');
  };

  // writes a numpyts ndarray or plain typed array back into vol.img and renders
  // integer volumes wrap around on overflow so values are clamped to the stored type
  Boostlet.from_np = function(arr) {
    const img = Boostlet.nv.volumes[0].img;
    const src = (arr && arr.data) ? arr.data : arr;
    const type = img.constructor.name;
    if (type.startsWith('Float') || src.length !== img.length) {
      img.set(src);
    } else {
      const signed = type.startsWith('Int');
      const bits = 8 * img.BYTES_PER_ELEMENT - (signed ? 1 : 0);
      const hi = 2 ** bits - 1, lo = signed ? -hi - 1 : 0;
      for (let i = 0; i < img.length; i++) img[i] = Math.min(hi, Math.max(lo, src[i]));
    }
    Boostlet.nv.updateGLVolume();
  };

  // load ace then build the editor panel
  const aceScript = document.createElement('script');
  aceScript.src = ACE_URL;
  aceScript.onerror = function() {
    delete window._NumpyBoostletLoaded;
    Boostlet.hint('NumPy Boostlet could not load the editor', 5000);
  };
  aceScript.onload = function() {
    plot();
    Boostlet.hint('NumPy Boostlet loaded', 2500);

    // ===== benchmark =====
    // Measure wall time for core operations over the loaded volume.
    // Usage (in console): window.__numpy_benchmark(20).then(r => console.table(r.table))
    // nRuns: number of repetitions per operation (default 20; threshold capped at 5)
    window.__numpy_benchmark = async function (nRuns) {
      nRuns = nRuns || 20
      const vol = Boostlet.nv?.volumes?.[0]
      if (!vol) { console.warn('[numpy-bench] no volume loaded'); return null }

      const dims = Array.from(vol.hdr.dims).slice(1, 4)
      const nVoxels = dims.reduce((a, b) => a * b, 1)
      const mbF32 = (nVoxels * 4 / 1024 / 1024).toFixed(1)
      console.log(`[numpy-bench] ${dims.join('×')}  ${nVoxels.toLocaleString()} voxels  ${mbF32} MB float32`)

      function stats (arr) {
        const n = arr.length
        const mean = arr.reduce((a, b) => a + b, 0) / n
        const std  = Math.sqrt(arr.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0) / n)
        return { n, mean: +mean.toFixed(2), std: +std.toFixed(2), min: +Math.min(...arr).toFixed(2), max: +Math.max(...arr).toFixed(2) }
      }

      // warm up so JIT doesnt skew the first sample
      { const _a = Boostlet.to_np(); Boostlet.from_np(_a); _a.dispose?.() }

      // 1. to_np: copy vol.img into numpy-ts ndarray
      const toNpTimes = []
      for (let i = 0; i < nRuns; i++) {
        const t0 = performance.now(); const a = Boostlet.to_np(); toNpTimes.push(performance.now() - t0)
        // free it so numpy-ts memory doesnt fill up
        a.dispose?.()
      }

      // 2. from_np + render: write ndarray back (identity, no change)
      const _arr = Boostlet.to_np()
      const fromNpTimes = []
      for (let i = 0; i < nRuns; i++) {
        const t0 = performance.now(); Boostlet.from_np(_arr); fromNpTimes.push(performance.now() - t0)
      }
      _arr.dispose?.()

      // 3. snapshot: vol.img.slice() (saved before every run for undo)
      const snapshotTimes = []
      for (let i = 0; i < nRuns; i++) {
        const t0 = performance.now(); vol.img.slice(); snapshotTimes.push(performance.now() - t0)
      }

      // 4. undo: vol.img.set() + updateGLVolume
      const _snap = vol.img.slice()
      const undoTimes = []
      for (let i = 0; i < nRuns; i++) {
        const t0 = performance.now(); vol.img.set(_snap); Boostlet.nv.updateGLVolume(); undoTimes.push(performance.now() - t0)
      }

      // 5. threshold script from figure 3, max 5 runs, restores volume each time
      const _orig = vol.img.slice()
      const thresholdScript = `
        const vol = Boostlet.nv.volumes[0]
        const slope = vol.hdr.scl_slope || 1
        const inter = vol.hdr.scl_inter || 0
        const displayThresh = 360
        const rawThresh = (displayThresh - inter) / slope
        const rawZero = Math.round((0 - inter) / slope)
        const arr = Boostlet.to_np()
        const mask = np.greater(arr, rawThresh)
        const a = np.subtract(arr, rawZero), b = np.multiply(a, mask)
        const out = np.add(b, rawZero)
        Boostlet.from_np(out)
        for (const x of [arr, mask, a, b, out]) x.dispose?.()
      `
      const AsyncFn = Object.getPrototypeOf(async function () {}).constructor
      const threshTimes = []
      for (let i = 0; i < Math.min(nRuns, 5); i++) {
        vol.img.set(_orig)
        const t0 = performance.now()
        await new AsyncFn(thresholdScript)()
        threshTimes.push(performance.now() - t0)
      }
      vol.img.set(_orig); Boostlet.nv.updateGLVolume()

      const table = {
        'to_np':            stats(toNpTimes),
        'from_np + render': stats(fromNpTimes),
        'snapshot':         stats(snapshotTimes),
        'undo':             stats(undoTimes),
        'threshold script': stats(threshTimes)
      }

      console.log(`[numpy-bench] results (ms):`)
      console.table(Object.fromEntries(Object.entries(table).map(([k, v]) =>
        [k, `${v.mean} ± ${v.std}  (min ${v.min}, max ${v.max}, n=${v.n})`]
      )))

      return { dims, nVoxels, mbF32: +mbF32, table }
    }
  };
  document.head.appendChild(aceScript);
}

// snapshot of vol.img saved before each run so undo can restore it
window._numpySnapshot = null;

// broadcastRun controls whether this run is sent to peers
// it is false when we are applying a remote run to avoid echo
// code is passed in when the text was already read for an approval or a hash check
function runCode(broadcastRun, code) {
  if (broadcastRun === undefined) broadcastRun = true;
  if (code === undefined) code = window._numpyEditor.getValue();
  const outputDiv = document.getElementById('nb-output');
  const vol = Boostlet.nv.volumes[0];

  // save current state before running
  window._numpySnapshot = vol.img.slice();
  outputDiv.textContent = '';

  // redirect console.log to the output div for this run
  // text nodes only so logged strings never become html
  const origLog = console.log;
  console.log = function(msg) {
    outputDiv.appendChild(document.createTextNode(String(msg)));
    outputDiv.appendChild(document.createElement('br'));
  };

  // wrap in async so user code can await if needed
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  new AsyncFunction(code)().then(async () => {
    console.log = origLog;
    // the hash lets peers check they hold the same script before they run it
    lastRunHash = await hashCode(code);
    if (broadcastRun) send({ type: 'numpy-run', hash: lastRunHash })
  }).catch(err => {
    const errSpan = document.createElement('span');
    errSpan.style.color = '#f77';
    errSpan.textContent = err.toString();
    outputDiv.appendChild(errSpan);
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
  if (broadcastUndo) send({ type: 'numpy-undo', hash: lastRunHash })
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
    #nb-approve {
      display: none; align-items: center; gap: 8px;
      padding: 6px 10px; background: #2a2410; border-top: 1px solid #554;
    }
    #nb-approve span { color: #fc6; font-size: 11px; flex: 1; }
    #nb-approve button {
      border: none; border-radius: 4px; padding: 4px 10px;
      font-family: monospace; font-size: 12px; cursor: pointer;
    }
    #nb-approve-yes { background: #a80; color: #fff; }
    #nb-approve-no { background: #333; color: #aaa; }
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
      <span id="nb-status"></span>
    </div>
    <div id="nb-approve">
      <span id="nb-approve-text"></span>
      <button id="nb-approve-yes">approve and run</button>
      <button id="nb-approve-no">ignore</button>
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
`// Boostlet.nv           live niivue instance
// Boostlet.to_np()      vol.img as float32 ndarray (raw voxel values)
// Boostlet.from_np(arr) write ndarray back and rerender
// np                    numpyts

// numpyts arrays live in wasm memory and are not garbage collected
// dispose them after from_np or memory fills up after a few runs

// example 1 threshold in display space
// stored values are raw so the cutoff is converted with the nifti slope and intercept
// the cutoff is the middle of the display window so it works on any volume
const vol = Boostlet.nv.volumes[0]
const slope = vol.hdr.scl_slope || 1
const inter = vol.hdr.scl_inter || 0
const displayThresh = (vol.cal_min + vol.cal_max) / 2
const rawThresh = (displayThresh - inter) / slope
const rawZero = Math.round((0 - inter) / slope)
const arr = Boostlet.to_np()
const mask = np.greater(arr, rawThresh)
const a = np.subtract(arr, rawZero), b = np.multiply(a, mask)
const out = np.add(b, rawZero)
Boostlet.from_np(out)
for (const x of [arr, mask, a, b, out]) x.dispose?.()

// example 2 scale the raw values
// from_np clamps to the stored integer type so large values saturate
// const arr = Boostlet.to_np()
// const out = np.multiply(arr, 2.0)
// Boostlet.from_np(out)
// for (const x of [arr, out]) x.dispose?.()`,
    -1
  );
  window._numpyEditor = editor;
  defaultCode = editor.getValue();
  refresh();

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
    lastEditor = 'you'
    refresh()
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
    exec: () => requestRun()
  });

  document.getElementById('nb-run-btn').addEventListener('click', () => requestRun());
  document.getElementById('nb-undo-btn').addEventListener('click', () => undoCode(true));
  document.getElementById('nb-approve-yes').addEventListener('click', () => approveRun());
  document.getElementById('nb-approve-no').addEventListener('click', () => refresh());

  // ask peers that are already connected for their script
  send({ type: 'numpy-hello' });
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