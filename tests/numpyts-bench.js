// table 1 benchmark, numpy-ts vs plain js loops
// paste into the console on a niivue page with a volume loaded
// load the numpyBoostlet first so np and Boostlet.nv exist
// results go to window.__npbench and the latex rows get copied
(async () => {
const RUNS = 30
const WARMUP = 5
const NUMPY_TS_URL = 'https://cdn.jsdelivr.net/npm/numpy-ts@1.3.0/dist/numpy-ts.browser.js'

const nv = window.Boostlet?.nv || window.Boostlet?.framework?.instance || window.nv
if (!nv?.volumes?.length) { console.warn('[npbench] no niivue volume found'); return }
const np = window.np || await import(NUMPY_TS_URL)
const vol = nv.volumes[0]
const X = vol.hdr.dims[1], Y = vol.hdr.dims[2], Z = vol.hdr.dims[3]
const slope = vol.hdr.scl_slope || 1
const inter = vol.hdr.scl_inter || 0

// ---------- slice extraction ----------
// middle slice along one axis, in display units
function getSlice(axis) {
  const img = vol.img
  let H, W, idx
  if (axis === 2) { H = Y; W = X; const k = Z >> 1; idx = (r, c) => c + r * X + k * X * Y }
  if (axis === 1) { H = Z; W = X; const j = Y >> 1; idx = (r, c) => c + j * X + r * X * Y }
  if (axis === 0) { H = Z; W = Y; const i = X >> 1; idx = (r, c) => i + c * X + r * X * Y }
  const out = new Float32Array(H * W)
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) out[r * W + c] = img[idx(r, c)] * slope + inter
  return { data: out, H, W, label: `axis ${axis} (${H}x${W})` }
}

// ---------- kernels ----------
// both versions use the same kernel weights and repeat edge pixels
function makeTaps(K, k) {
  const r = k >> 1, taps = []
  for (let a = 0; a < k; a++)
    for (let b = 0; b < k; b++)
      if (K[a * k + b] !== 0) taps.push({ dy: a - r, dx: b - r, w: K[a * k + b] })
  return { taps, r }
}
const G1 = [1, 4, 6, 4, 1]
const GK = []
for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) GK.push(G1[a] * G1[b] / 256)
const GAUSS = makeTaps(GK, 5)
const SHARP = makeTaps([0, -1, 0, -1, 5, -1, 0, -1, 0], 3)

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v

// ----- plain js loops -----
function convLoop(src, H, W, { taps }) {
  const out = new Float32Array(H * W)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0
      for (let t = 0; t < taps.length; t++) {
        const { dy, dx, w } = taps[t]
        s += w * src[clamp(y + dy, 0, H - 1) * W + clamp(x + dx, 0, W - 1)]
      }
      out[y * W + x] = s
    }
  }
  return out
}

function medianLoop(src, H, W) {
  const out = new Float32Array(H * W), win = new Float32Array(9)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let n = 0
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          win[n++] = src[clamp(y + dy, 0, H - 1) * W + clamp(x + dx, 0, W - 1)]
      // sort the 9 values
      for (let i = 1; i < 9; i++) {
        const v = win[i]; let j = i - 1
        while (j >= 0 && win[j] > v) { win[j + 1] = win[j]; j-- }
        win[j + 1] = v
      }
      out[y * W + x] = win[4]
    }
  }
  return out
}

// ----- numpy-ts -----
// free arrays after every run so numpy-ts memory doesnt fill up
// (when it fills up it quietly switches to slower js arrays)
const owned = []
const keep = a => { if (a && typeof a.dispose === 'function') owned.push(a); return a }
const freeAll = () => { for (const a of owned) { try { a.dispose() } catch (e) {} } owned.length = 0 }
const sc = v => typeof v === 'number' ? v : v?.tolist ? Number(v.tolist()) : Number(v)

function reshape2(a, H, W) {
  try { return a.reshape(H, W) } catch (e) { return a.reshape([H, W]) }
}
// the browser build has no 'edge' pad mode
// so copy the border rows and columns by hand instead
let PAD_EDGE_OK = null
function padEdge(a, r) {
  if (PAD_EDGE_OK !== false) {
    try { const p = np.pad(a, r, 'edge'); PAD_EDGE_OK = true; return p }
    catch (e) { PAD_EDGE_OK = false }
  }
  const [H, W] = a.shape
  const top = a.slice('0:1', ':'), bot = a.slice(`${H - 1}:${H}`, ':')
  const rows = keep(np.concatenate([...Array(r).fill(top), a, ...Array(r).fill(bot)], 0))
  const left = rows.slice(':', '0:1'), right = rows.slice(':', `${W - 1}:${W}`)
  return np.concatenate([...Array(r).fill(left), rows, ...Array(r).fill(right)], 1)
}

// copy the slice into numpy-ts
function inNp(src, H, W) {
  let a
  try { a = np.array(src, 'float32') } catch (e) { a = np.array(Array.from(src), 'float32') }
  keep(a)
  return keep(reshape2(a, H, W))
}
// the slower copy Boostlet.to_np() uses
function inNpArrayFrom(src, H, W) {
  return keep(reshape2(keep(np.array(Array.from(src), 'float32')), H, W))
}
// fast copy back out, used for timing
function outNp(nd) {
  const n = nd.size ?? nd.shape.reduce((p, q) => p * q, 1)
  const d = nd.data, o = nd.offset || 0
  if (d && d.subarray && d.length - o >= n) return Float32Array.from(d.subarray(o, o + n))
  return outNpSafe(nd)
}
// slow copy back out, only used to check outNp
function outNpSafe(nd) {
  return Float32Array.from(nd.toArray().flat(Infinity))
}

// filter by shifting the image and adding it up, once per kernel weight
function convNp(a, H, W, { taps, r }) {
  const p = keep(padEdge(a, r))
  let acc = null
  for (const { dy, dx, w } of taps) {
    const v = p.slice(`${dy + r}:${dy + r + H}`, `${dx + r}:${dx + r + W}`)
    const t = keep(v.multiply(w))
    acc = acc ? keep(acc.add(t)) : t
  }
  return acc
}

function medianNp(a, H, W) {
  const p = keep(padEdge(a, 1))
  const views = []
  for (let dy = 0; dy < 3; dy++)
    for (let dx = 0; dx < 3; dx++)
      views.push(p.slice(`${dy}:${dy + H}`, `${dx}:${dx + W}`))
  const st = keep(np.stack(views, 0))
  try {
    return keep(np.median(st, 0))
  } catch (e) {
    const s = keep(np.sort(st, 0))
    return keep(s.slice('4').copy())
  }
}

// threshold at 25% of the slice range, same as the figure 3 script
let THR = 0
function thresholdLoop(src) {
  const out = new Float32Array(src.length)
  for (let i = 0; i < src.length; i++) out[i] = src[i] > THR ? src[i] : 0
  return out
}
function thresholdNp(a) {
  const mask = keep(np.greater(a, keep(np.array([THR], 'float32'))))
  return keep(np.multiply(a, mask))
}
// same but compares to the number directly, the fixed version
function thresholdNpFixed(a) {
  const mask = keep(np.greater(a, THR))
  return keep(np.multiply(a, mask))
}

const OPS = [
  { name: 'Gaussian blur ($5 \\times 5$)',  loop: (s, H, W) => convLoop(s, H, W, GAUSS), np: (a, H, W) => convNp(a, H, W, GAUSS) },
  { name: 'Median filter ($3 \\times 3$)', loop: (s, H, W) => medianLoop(s, H, W),     np: (a, H, W) => medianNp(a, H, W) },
  { name: 'Sharpen ($3 \\times 3$)',        loop: (s, H, W) => convLoop(s, H, W, SHARP), np: (a, H, W) => convNp(a, H, W, SHARP) },
  { name: 'Threshold',                      loop: (s) => thresholdLoop(s),              np: (a) => thresholdNp(a) },
  { name: 'Threshold (fixed)',              loop: (s) => thresholdLoop(s),              np: (a) => thresholdNpFixed(a) },
]

// ---------- timing ----------
// the browser timer is only accurate to about 0.1 ms
// so fast operations get repeated and averaged
const MIN_SAMPLE_MS = 5
function time(fn, cleanup) {
  let single = Infinity
  for (let i = 0; i < WARMUP; i++) {
    const t0 = performance.now(); fn(); single = Math.min(single, performance.now() - t0)
    cleanup && cleanup()
  }
  const reps = Math.max(1, Math.ceil(MIN_SAMPLE_MS / Math.max(single, 0.01)))
  const t = []
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now()
    for (let k = 0; k < reps; k++) fn()
    t.push((performance.now() - t0) / reps)
    cleanup && cleanup()
  }
  t.sort((a, b) => a - b)
  const q = p => t[Math.min(t.length - 1, Math.floor(p * t.length))]
  return { med: q(0.5), q1: q(0.25), q3: q(0.75), reps }
}

function maxRelDiff(a, b) {
  if (a.length !== b.length) return `length ${a.length} vs ${b.length}`
  let mn = Infinity, mx = -Infinity, d = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] < mn) mn = a[i]; if (a[i] > mx) mx = a[i]
    const e = Math.abs(a[i] - b[i]); if (e > d) d = e
  }
  return d / ((mx - mn) || 1)
}

// ---------- environment ----------
let env = {
  userAgent: navigator.userAgent,
  cores: navigator.hardwareConcurrency,
  deviceMemoryGB: navigator.deviceMemory,
  crossOriginIsolated: window.crossOriginIsolated,
  numpyTs: NUMPY_TS_URL.match(/numpy-ts@([\d.]+)/)[1],
  volumeDims: [X, Y, Z],
  sclSlope: slope, sclInter: inter,
}
try {
  const h = await navigator.userAgentData?.getHighEntropyValues(['platform', 'platformVersion', 'architecture', 'fullVersionList'])
  if (h) env = { ...env, platform: h.platform, platformVersion: h.platformVersion, arch: h.architecture,
    browser: h.fullVersionList?.map(b => `${b.brand} ${b.version}`).join(', ') }
} catch (e) {}
// measure how accurate the timer is
{ let r = Infinity, last = performance.now()
  for (let i = 0; i < 1e5; i++) { const n = performance.now(); if (n > last) { r = Math.min(r, n - last); last = n } }
  env.timerResolutionMs = +r.toFixed(4) }
console.log('[npbench] environment', env)

// ---------- run ----------
const results = []
for (const axis of [2, 1, 0]) {
  const { data: src, H, W, label } = getSlice(axis)
  { let mn = Infinity, mx = -Infinity
    for (const v of src) { if (v < mn) mn = v; if (v > mx) mx = v }
    THR = mn + 0.25 * (mx - mn) }
  console.log(`[npbench] ${label} ...`)

  // time the copy on its own
  const convIn = time(() => inNp(src, H, W), freeAll)
  const convInArrayFrom = time(() => inNpArrayFrom(src, H, W), freeAll)
  const aPre = inNp(src, H, W)
  owned.length = 0 // keep aPre for the runs without copying

  for (const op of OPS) {
    const row = { slice: label, op: op.name.replace(/\$/g, '').replace(/\\times/g, 'x') }
    try {
      // check both give the same answer before timing
      const ref = op.loop(src, H, W)
      const res = op.np(inNp(src, H, W), H, W)
      const safe = outNpSafe(res), fast = outNp(res)
      freeAll()
      const fmt = v => typeof v === 'number' ? +v.toExponential(2) : v
      row.maxRelDiff = fmt(maxRelDiff(ref, safe))
      const rb = maxRelDiff(safe, fast)
      if (rb !== 0) row.readbackMismatch = fmt(rb)

      const loop = time(() => op.loop(src, H, W))
      const e2e = time(() => outNp(op.np(inNp(src, H, W), H, W)), freeAll)
      const kern = time(() => op.np(aPre, H, W), freeAll)

      Object.assign(row, {
        loopMs: +loop.med.toFixed(3),
        numpyMs: +e2e.med.toFixed(3),
        numpyKernelMs: +kern.med.toFixed(3),
        ratio: +(e2e.med / loop.med).toFixed(2),
        loopReps: loop.reps,
        loopIQR: `${loop.q1.toFixed(3)}-${loop.q3.toFixed(3)}`,
        numpyIQR: `${e2e.q1.toFixed(2)}-${e2e.q3.toFixed(2)}`,
        convInMs: +convIn.med.toFixed(3),
        convInArrayFromMs: +convInArrayFrom.med.toFixed(3),
        _name: op.name, _px: H * W,
      })
    } catch (e) {
      row.error = e.message
      freeAll()
    }
    results.push(row)
  }
  try { aPre.dispose() } catch (e) {}
}

console.table(results.map(({ _name, _px, ...r }) => r))

// ---------- per-call cost ----------
// time single operations on the largest slice to explain the table
// whole array vs a slice of it (what the filters use) vs a plain js loop
const perCall = {}
{
  const big = [2, 1, 0].map(getSlice).sort((p, q) => q.H * q.W - p.H * p.W)[0]
  const { data: src, H, W } = big
  const a = inNp(src, H, W)
  const p = keep(padEdge(a, 2))
  owned.length = 0 // keep a and p around
  const view = p.slice(`1:${H + 1}`, `1:${W + 1}`)
  const jsMul = time(() => { const o = new Float32Array(src.length); for (let i = 0; i < src.length; i++) o[i] = src[i] * 0.5; return o })
  const contig = time(() => keep(a.multiply(0.5)), freeAll)
  const strided = time(() => keep(view.multiply(0.5)), freeAll)
  const addArr = time(() => keep(a.add(a)), freeAll)
  // check which of the two threshold calls is slow
  const thrArr = keep(np.array([THR], 'float32'))
  const boolMask = keep(np.greater(a, THR))
  const floatMask = keep(boolMask.astype('float32'))
  owned.length = 0
  const gtScalar = time(() => keep(np.greater(a, THR)), freeAll)
  const gtArray1 = time(() => keep(np.greater(a, thrArr)), freeAll)
  const mulBool = time(() => keep(np.multiply(a, boolMask)), freeAll)
  const mulFloat = time(() => keep(np.multiply(a, floatMask)), freeAll)
  Object.assign(perCall, {
    slice: big.label,
    jsLoopMultiplyMs: +jsMul.med.toFixed(4),
    npMultiplyContiguousMs: +contig.med.toFixed(4),
    npMultiplyStridedViewMs: +strided.med.toFixed(4),
    npAddContiguousMs: +addArr.med.toFixed(4),
    npGreaterScalarMs: +gtScalar.med.toFixed(4),
    npGreaterOneElemArrayMs: +gtArray1.med.toFixed(4),
    npMultiplyBoolMaskMs: +mulBool.med.toFixed(4),
    npMultiplyFloatMaskMs: +mulFloat.med.toFixed(4),
  })
  console.log('[npbench] per-call cost (ms, median)')
  console.table(perCall)
  for (const x of [a, p, thrArr, boolMask, floatMask]) { try { x.dispose() } catch (e) {} }
}

// latex rows for the largest slice
const maxPx = Math.max(...results.filter(r => r._px).map(r => r._px))
const rows = results.filter(r => r._px === maxPx)
const f = v => v < 1 ? v.toFixed(3) : v < 10 ? v.toFixed(2) : v.toFixed(1)
const latex = rows.map(r => `${r._name.padEnd(32)} & ${f(r.loopMs)} & ${f(r.numpyMs)} & ${r.ratio.toFixed(1)}$\\times$ \\\\`).join('\n')
console.log(`[npbench] latex rows for ${rows[0]?.slice}:\n` + latex)
try { copy(latex); console.log('[npbench] latex copied to clipboard') } catch (e) {}

window.__npbench = { env, results, perCall, latex }
})()