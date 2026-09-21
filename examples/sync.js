;(function () {
  if (window.__boostlet_sync_injected) return
  window.__boostlet_sync_injected = true

  // ===== config =====

  const BOOSTLET_URL = 'https://boostlet.org/dist/boostlet.min.js'
  const PUSHER_KEY = '1a1ef7128331ff9bbc00'
  const PUSHER_CLUSTER = 'us2'
  const PUSHER_AUTH_URL = 'https://boostlet-pusher-auth.bronsdonayden.workers.dev'
  const ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
  const DROPBOX_APP_KEY = '4ugn042y7wktv7t'
  const DROPBOX_REDIRECT = 'https://bronsdonayden.github.io/boostlet/dropbox-callback.html'

  // ===== state =====

  const state = {
    nv: null, pusher: null, channel: null,
    peers: new Map(), selfId: null, myHash: null,
    applyingRemote: false, rafId: null, pollId: null,
    dropboxToken: null, roomCode: null
  }

  // ===== latency measurement state =====

  const _pendingPings = new Map() // id -> callback(rtt)
  let _pingCounter = 0

  // ===== public api =====

  window.__sync_send = function (msg) { broadcast(msg) }

  // Measure round-trip latency to all connected peers.
  // Usage (in console): window.__sync_measureLatency(100).then(console.table)
  // Returns a promise resolving to [{peerId, n, mean, std, min, max}]
  window.__sync_measureLatency = function (nSamples) {
    nSamples = nSamples || 100
    const openPeers = [...state.peers.entries()].filter(([, p]) => p.channel?.readyState === 'open')
    if (!openPeers.length) { console.warn('[sync] no open peers'); return Promise.resolve([]) }
    return Promise.all(openPeers.map(([peerId, peer]) => new Promise(resolve => {
      const samples = []
      function next () {
        const id = `${peerId}_${_pingCounter++}`
        _pendingPings.set(id, rtt => {
          samples.push(rtt)
          if (samples.length === nSamples) {
            const mean = samples.reduce((a, b) => a + b, 0) / nSamples
            const std  = Math.sqrt(samples.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0) / nSamples)
            resolve({ peerId, n: nSamples, mean: +mean.toFixed(2), std: +std.toFixed(2), min: +Math.min(...samples).toFixed(2), max: +Math.max(...samples).toFixed(2) })
          } else next()
        })
        try { peer.channel.send(JSON.stringify({ type: 'latency-ping', id, t: performance.now() })) }
        catch (e) { _pendingPings.delete(id); resolve(null) }
      }
      next()
    })))
  }

  // Pretty-print a latency report to the console.
  // Usage: window.__sync_latencyReport(100)
  window.__sync_latencyReport = function (nSamples) {
    return window.__sync_measureLatency(nSamples || 100).then(results => {
      const valid = results.filter(Boolean)
      if (!valid.length) { console.warn('[sync] no peers connected'); return results }
      console.log(`[sync] latency report — ${valid.length} peer(s), ${valid[0]?.n} samples each`)
      console.table(valid.map(r => ({
        peerId: r.peerId,
        'mean (ms)': r.mean,
        'std (ms)': r.std,
        'min (ms)': r.min,
        'max (ms)': r.max
      })))
      return results
    })
  }

  window.__boostlet_sync_destroy = function () {
    if (state.pollId) clearInterval(state.pollId)
    if (state.rafId) cancelAnimationFrame(state.rafId)
    if (state.channel) state.channel.unbind_all()
    if (state.pusher) state.pusher.disconnect()
    state.peers.forEach(peer => { peer.channel?.close(); peer.conn.close() })
    state.peers.clear()
    document.getElementById('__sync_panel')?.remove()
    window.__boostlet_sync_injected = false
  }

  // ===== bootstrap =====

  function loadScript(url, cb) {
    const s = document.createElement('script')
    s.src = url; s.onload = cb
    document.head.appendChild(s)
  }

  if (window.Boostlet) waitForNv()
  else loadScript(BOOSTLET_URL, waitForNv)

  function waitForNv() {
    state.pollId = setInterval(() => {
      try {
        Boostlet.init()
        if (Boostlet.framework.name !== 'niivue') return
        const nv = Boostlet.framework.instance
        if (!nv?.volumes) return
        clearInterval(state.pollId); state.pollId = null
        if (window.Pusher) start(nv)
        else loadScript('https://js.pusher.com/8.4.0/pusher.min.js', () => start(nv))
      } catch (e) {}
    }, 300)
  }

  function start(nv) {
    state.nv = nv
    const code = new URLSearchParams(location.search).get('sync')
    if (code) joinScene(code)
    else { showPanel(); hostScene() }
  }

  // ===== scene =====

  async function hashVolume() {
    if (state.myHash) return state.myHash
    const img = state.nv.volumes?.[0]?.img
    if (!img) return null
    const buf = await crypto.subtle.digest('SHA-256', img)
    state.myHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
    return state.myHash
  }

  function readScene(full) {
    const nv = state.nv
    const vol = nv.volumes?.[0]
    const snap = {
      crosshairPos: nv.scene ? Array.from(nv.scene.crosshairPos) : [0.5, 0.5, 0.5],
      sliceType: nv.opts?.sliceType ?? 0,
      colormap: vol?.colormap ?? null,
      cal_min: vol?.cal_min ?? null,
      cal_max: vol?.cal_max ?? null
    }
    if (!full) return snap
    return {
      originUrl: location.href,
      volumeUrl: vol?.url && !vol.url.startsWith('blob:') ? vol.url : null,
      activeBoostlets: (window.__boostlet_active || []).map(({ name, url }) => ({ name, url })),
      ...snap
    }
  }

  function applyDiff(diff) {
    const nv = state.nv
    if (diff.crosshairPos) { nv.scene.crosshairPos = new Float32Array(diff.crosshairPos); nv.drawScene?.() }
    if (diff.sliceType !== undefined && nv.opts.sliceType !== diff.sliceType) nv.setSliceType?.(diff.sliceType)
    const vol = nv.volumes?.[0]
    if (!vol) return
    let dirty = false
    if (diff.colormap && diff.colormap !== vol.colormap) { nv.setColormap?.(vol.id, diff.colormap); dirty = true }
    if (diff.cal_min != null) { vol.cal_min = diff.cal_min; dirty = true }
    if (diff.cal_max != null) { vol.cal_max = diff.cal_max; dirty = true }
    if (dirty) nv.updateGLVolume?.()
  }

  function isDropboxUrl(url) {
    return url && (url.includes('dropboxusercontent.com') || url.includes('dropbox.com'))
  }

  async function applyScene(scene) {
    const nv = state.nv
    // always load from dropbox even if a volume is already present
    // a dropbox url means the host explicitly shared a modified volume
    if (scene.volumeUrl && (isDropboxUrl(scene.volumeUrl) || !nv.volumes?.length)) {
      Boostlet.hint('loading volume from dropbox', 3000)
      try { await nv.loadVolumes([{ url: scene.volumeUrl }]) }
      catch (e) { Boostlet.hint('could not load volume from url', 4000) }
    }
    if (nv.volumes?.length) applyDiff(scene)
    else if (!scene.volumeUrl) Boostlet.hint('waiting for host to share volume via dropbox', 4000)
  }

  // ===== host and join =====

  async function hostScene() {
    const code = makeCode()
    state.roomCode = code
    const params = new URLSearchParams(location.search)
    params.set('sync', code)
    history.replaceState(null, '', `${location.pathname}?${params}${location.hash}`)
    updatePanel(code)
    connectToRoom(code)
    await publishScene(code, readScene(true))
  }

  async function joinScene(code) {
    state.roomCode = code
    let scene
    try {
      const res = await fetch(`${PUSHER_AUTH_URL}/scene/${code}`)
      if (res.ok) {
        const { sceneUrl } = await res.json()
        if (sceneUrl) scene = await fetch(sceneUrl).then(r => r.json())
      }
    } catch (e) {}

    if (!scene) { updatePanel(code); connectToRoom(code); return }

    if (scene.originUrl && !isSamePage(scene.originUrl, location.href)) {
      const target = new URL(scene.originUrl)
      target.searchParams.set('sync', code)
      location.href = target.toString()
      return
    }

    await applyScene(scene)
    updatePanel(code)
    if (scene.activeBoostlets?.length) promptBoostlets(scene.activeBoostlets)
    connectToRoom(code)
  }

  async function publishScene(code, scene) {
    const sceneUrl = await dropboxUpload(`/scenes/${code}_${Date.now()}.json`, new TextEncoder().encode(JSON.stringify(scene)))
    if (!sceneUrl) return
    await fetch(`${PUSHER_AUTH_URL}/scene`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, sceneUrl })
    }).catch(() => {})
  }

  function makeCode() { return Math.random().toString(36).slice(2, 7) }

  // ===== dropbox =====

  async function dropboxUpload(path, data) {
    const token = await dropboxAuth()
    if (!token) return null
    try {
      const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', autorename: false }),
          'Content-Type': 'application/octet-stream'
        },
        body: data
      })
      if (!res.ok) return null
      const { id } = await res.json()
      return dropboxSharedUrl(token, id)
    } catch (e) { return null }
  }

  async function dropboxSharedUrl(token, fileId) {
    const headers = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
    let linkData = null
    try {
      const res = await fetch('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
        method: 'POST', headers,
        body: JSON.stringify({ path: fileId, settings: { requested_visibility: 'public', audience: 'public' } })
      })
      if (res.status === 409) {
        const ex = await fetch('https://api.dropboxapi.com/2/sharing/list_shared_links', {
          method: 'POST', headers,
          body: JSON.stringify({ path: fileId, direct_only: true })
        })
        linkData = (await ex.json()).links?.[0]
      } else if (res.ok) {
        linkData = await res.json()
      }
    } catch (e) { return null }
    return linkData?.url ? directDropboxUrl(linkData.url) : null
  }

  function directDropboxUrl(url) {
    let u = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com')
    return u.includes('dl=0') ? u.replace('dl=0', 'dl=1') : u + (u.includes('?') ? '&' : '?') + 'dl=1'
  }

  async function uploadVolumeToDropbox() {
    const vol = state.nv.volumes?.[0]
    if (!vol?.img) { Boostlet.hint('no volume to upload', 3000); return }

    const nifti = buildNifti1({
      dims: Array.from(vol.hdr.dims), pixDims: Array.from(vol.hdr.pixDims),
      datatypeCode: vol.hdr.datatypeCode, numBitsPerVoxel: vol.hdr.numBitsPerVoxel,
      scl_slope: vol.hdr.scl_slope, scl_inter: vol.hdr.scl_inter,
      sform_code: vol.hdr.sform_code, qform_code: vol.hdr.qform_code,
      affine: vol.hdr.affine
    }, vol.img)

    Boostlet.hint('uploading to dropbox', 3000)
    const url = await dropboxUpload('/volume_' + Date.now() + '.nii', nifti)
    if (!url) { Boostlet.hint('dropbox upload failed', 4000); return }

    if (state.roomCode) {
      const scene = readScene(true)
      scene.volumeUrl = url
      await publishScene(state.roomCode, scene)
    }

    Boostlet.hint('volume uploaded to dropbox', 3000)
    broadcast({ type: 'volume-ready', volumeUrl: url, scene: readScene(false) })
  }

  // ===== dropbox oauth =====

  async function dropboxAuth() {
    if (state.dropboxToken) return state.dropboxToken

    const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    const authUrl = 'https://www.dropbox.com/oauth2/authorize'
      + '?client_id=' + DROPBOX_APP_KEY
      + '&response_type=code&code_challenge=' + challenge
      + '&code_challenge_method=S256&redirect_uri=' + encodeURIComponent(DROPBOX_REDIRECT)
      + '&token_access_type=online'

    const popup = window.open(authUrl, 'dropbox_auth', 'width=500,height=700')
    if (!popup) { Boostlet.hint('popup blocked by browser', 4000); return null }

    const authCode = await new Promise(resolve => {
      const onMsg = e => { if (e.data?.type === 'dropbox-auth') { window.removeEventListener('message', onMsg); resolve(e.data.code) } }
      window.addEventListener('message', onMsg)
      const t = setInterval(() => {
        try { if (popup.closed) { clearInterval(t); window.removeEventListener('message', onMsg); resolve(null) } }
        catch (e) { clearInterval(t); window.removeEventListener('message', onMsg); resolve(null) }
      }, 500)
    })

    if (!authCode) { Boostlet.hint('dropbox auth cancelled', 3000); return null }

    try {
      const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code: authCode, grant_type: 'authorization_code', code_verifier: verifier, client_id: DROPBOX_APP_KEY, redirect_uri: DROPBOX_REDIRECT })
      })
      const data = await res.json()
      if (!data.access_token) { Boostlet.hint('dropbox auth failed', 4000); return null }
      state.dropboxToken = data.access_token
      return state.dropboxToken
    } catch (e) { Boostlet.hint('dropbox auth failed', 4000); return null }
  }

  // ===== nifti builder =====

  function buildNifti1(meta, voxelData) {
    const hdr = new ArrayBuffer(352)
    const d = new DataView(hdr)
    d.setInt32(0, 348, true)
    for (let i = 0; i < 8; i++) d.setInt16(40 + i * 2, meta.dims[i] || 0, true)
    d.setInt16(70, meta.datatypeCode || 16, true)
    d.setInt16(72, meta.numBitsPerVoxel || 32, true)
    for (let i = 0; i < 8; i++) d.setFloat32(76 + i * 4, meta.pixDims[i] || 1, true)
    d.setFloat32(108, 352, true)
    d.setFloat32(112, meta.scl_slope || 1, true)
    d.setFloat32(116, meta.scl_inter || 0, true)
    d.setInt16(252, meta.qform_code || 1, true)
    d.setInt16(254, meta.sform_code || 1, true)
    if (meta.affine) {
      let k = 0
      for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) d.setFloat32(280 + (k++) * 4, meta.affine[i][j] || 0, true)
    }
    const bytes = new Uint8Array(hdr)
    bytes[344] = 110; bytes[345] = 43; bytes[346] = 49; bytes[347] = 0
    const out = new Uint8Array(352 + voxelData.byteLength)
    out.set(bytes)
    out.set(new Uint8Array(voxelData.buffer, voxelData.byteOffset, voxelData.byteLength), 352)
    return out
  }

  // ===== pusher + webrtc =====

  function connectToRoom(code) {
    const pusher = new Pusher(PUSHER_KEY, {
      cluster: PUSHER_CLUSTER,
      authEndpoint: PUSHER_AUTH_URL,
      auth: { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    })
    state.pusher = pusher
    const channel = pusher.subscribe(`presence-boostlet-${code}`)
    state.channel = channel

    channel.bind('pusher:subscription_succeeded', members => {
      state.selfId = members.me.id
      members.each(m => {
        if (m.id === state.selfId) return
        if (parseFloat(state.selfId) > parseFloat(m.id)) makeOffer(m.id)
        else getPeer(m.id, false)
      })
    })

    channel.bind('pusher:subscription_error', () => Boostlet.hint('could not join sync room', 4000))
    channel.bind('pusher:member_added', m => {
      if (parseFloat(state.selfId) > parseFloat(m.id)) makeOffer(m.id)
      else getPeer(m.id, false)
    })
    channel.bind('pusher:member_removed', m => removePeer(m.id))
    channel.bind('client-offer', d => { if (d.to === state.selfId) handleOffer(d.from, d.payload) })
    channel.bind('client-answer', d => { if (d.to === state.selfId) handleAnswer(d.from, d.payload) })
    channel.bind('client-ice', d => { if (d.to === state.selfId) handleIce(d.from, d.payload) })

    startBroadcasting()
  }

  function sendSignal(type, to, payload) {
    state.channel?.trigger(`client-${type}`, { from: state.selfId, to, payload })
  }

  function startBroadcasting() {
    let last = {}
    let lastCrosshairBroadcast = 0
    const tick = () => {
      state.rafId = requestAnimationFrame(tick)
      if (state.applyingRemote) return
      const cur = readScene(false)
      const now = Date.now()
      const patch = {}
      const crosshairChanged = cur.crosshairPos && (!last.crosshairPos || cur.crosshairPos.some((v, i) => v !== last.crosshairPos[i]))
      if (crosshairChanged && now - lastCrosshairBroadcast >= 33) { patch.crosshairPos = cur.crosshairPos; last.crosshairPos = cur.crosshairPos; lastCrosshairBroadcast = now }
      if (cur.sliceType !== last.sliceType) { patch.sliceType = cur.sliceType; last.sliceType = cur.sliceType }
      if (cur.colormap !== last.colormap) { patch.colormap = cur.colormap; last.colormap = cur.colormap }
      if (cur.cal_min !== last.cal_min || cur.cal_max !== last.cal_max) { patch.cal_min = cur.cal_min; patch.cal_max = cur.cal_max; last.cal_min = cur.cal_min; last.cal_max = cur.cal_max }
      if (Object.keys(patch).length) broadcast({ type: 'scene-patch', patch })
    }
    state.rafId = requestAnimationFrame(tick)
  }

  async function makeOffer(peerId) {
    if (!peerId || peerId === state.selfId) return
    if (parseFloat(state.selfId) < parseFloat(peerId)) return
    const peer = getPeer(peerId, true)
    if (peer.conn.signalingState !== 'stable') return
    const offer = await peer.conn.createOffer()
    await peer.conn.setLocalDescription(offer)
    sendSignal('offer', peerId, offer)
  }

  async function handleOffer(peerId, offer) {
    const peer = getPeer(peerId, false)
    await peer.conn.setRemoteDescription(offer)
    peer.remoteDescSet = true
    await flushCandidates(peer)
    const answer = await peer.conn.createAnswer()
    await peer.conn.setLocalDescription(answer)
    sendSignal('answer', peerId, answer)
  }

  async function handleAnswer(peerId, answer) {
    const peer = state.peers.get(peerId)
    if (!peer) return
    await peer.conn.setRemoteDescription(answer)
    peer.remoteDescSet = true
    await flushCandidates(peer)
  }

  async function handleIce(peerId, candidate) {
    if (!candidate) return
    const peer = state.peers.get(peerId)
    if (!peer) return
    if (peer.remoteDescSet) await peer.conn.addIceCandidate(candidate)
    else peer.pendingCandidates.push(candidate)
  }

  async function flushCandidates(peer) {
    for (const c of peer.pendingCandidates) await peer.conn.addIceCandidate(c)
    peer.pendingCandidates = []
  }

  function getPeer(peerId, createChannel) {
    if (state.peers.has(peerId)) return state.peers.get(peerId)
    const conn = new RTCPeerConnection(ICE_CONFIG)
    const peer = { conn, channel: null, pendingCandidates: [], remoteDescSet: false }
    state.peers.set(peerId, peer)
    conn.onicecandidate = e => { if (e.candidate) sendSignal('ice', peerId, e.candidate) }
    conn.ondatachannel = e => wireChannel(peerId, e.channel)
    conn.onconnectionstatechange = () => { if (conn.connectionState === 'failed' || conn.connectionState === 'closed') removePeer(peerId) }
    if (createChannel) wireChannel(peerId, conn.createDataChannel('boostlet-sync'))
    return peer
  }

  function wireChannel(peerId, channel) {
    const peer = state.peers.get(peerId)
    if (!peer) { channel.close(); return }
    peer.channel = channel

    channel.onopen = async () => {
      const hash = await hashVolume()
      try { channel.send(JSON.stringify({ type: 'hash-hello', hash })) } catch (e) {}
    }

    channel.onmessage = e => {
      if (typeof e.data !== 'string') return
      let msg; try { msg = JSON.parse(e.data) } catch { return }

      if (msg.type === 'hash-hello') {
        hashVolume().then(localHash => {
          const match = localHash === msg.hash || (!localHash && !msg.hash)
          try { channel.send(JSON.stringify({ type: 'hash-ack', match })) } catch (e) {}
          Boostlet.hint(match ? 'peer connected' : 'volumes differ — use dropbox to share', match ? 2000 : 6000)
        })
        return
      }
      if (msg.type === 'hash-ack') {
        Boostlet.hint(msg.match ? 'peer connected' : 'volumes differ — use dropbox to share', msg.match ? 2000 : 6000)
        return
      }
      if (msg.type === 'latency-ping') {
        try { channel.send(JSON.stringify({ type: 'latency-pong', id: msg.id, origT: msg.t })) } catch (e) {}
        return
      }
      if (msg.type === 'latency-pong') {
        const cb = _pendingPings.get(msg.id)
        if (cb) { _pendingPings.delete(msg.id); cb(performance.now() - msg.origT) }
        return
      }
      if (msg.type === 'scene-patch') {
        state.applyingRemote = true
        applyDiff(msg.patch)
        setTimeout(() => { state.applyingRemote = false }, 0)
        return
      }
      if (msg.type === 'volume-ready' && msg.volumeUrl) {
        // always load the dropbox volume regardless of whether a volume is already present
        Boostlet.hint('loading volume from dropbox', 3000)
        state.nv.loadVolumes([{ url: msg.volumeUrl }]).then(() => {
          if (msg.scene) { state.applyingRemote = true; applyDiff(msg.scene); setTimeout(() => { state.applyingRemote = false }, 0) }
        }).catch(() => Boostlet.hint('could not load volume from dropbox', 4000))
        return
      }
      routeMessage(msg)
    }

    channel.onclose = () => { if (peer.channel === channel) peer.channel = null }
  }

  function broadcast(msg) {
    const str = JSON.stringify(msg)
    state.peers.forEach(peer => { if (peer.channel?.readyState === 'open') try { peer.channel.send(str) } catch (e) {} })
  }

  function removePeer(peerId) {
    const peer = state.peers.get(peerId)
    if (!peer) return
    peer.channel?.close(); peer.conn.close()
    state.peers.delete(peerId)
    // cancel any in-flight pings to this peer
    _pendingPings.forEach((cb, id) => { if (id.startsWith(peerId + '_')) { _pendingPings.delete(id); cb(Infinity) } })
    Boostlet.hint('peer disconnected', 2000)
  }

  // =====  hop on the boostlet bus =====

  window.__boostlet_active = window.__boostlet_active || []
  window.registerBoostletSync = function (entry) {
    const idx = window.__boostlet_active.findIndex(e => e.name === entry.name)
    if (idx !== -1) window.__boostlet_active[idx] = entry
    else window.__boostlet_active.push(entry)
  }
  function routeMessage(msg) {
    if (!msg?.type) return
    for (const entry of window.__boostlet_active) if (typeof entry.onMessage === 'function') entry.onMessage(msg)
  }

  // ===== ui =====

  const PANEL = 'position:fixed;bottom:20px;right:20px;z-index:2147483647;background:#111;border:1.5px solid #444;border-radius:8px;padding:10px 12px;font-family:monospace;font-size:12px;color:#ccc;box-shadow:0 4px 16px rgba(0,0,0,.6);min-width:180px'
  const BTN = 'border:none;border-radius:4px;padding:3px 10px;cursor:pointer;font-family:monospace;font-size:11px'

  function el(tag, css, text) {
    const e = document.createElement(tag)
    if (css) e.style.cssText = css
    if (text) e.textContent = text
    return e
  }

  function showPanel() {
    if (document.getElementById('__sync_panel')) return
    const panel = el('div', PANEL)
    panel.id = '__sync_panel'
    const close = el('button', 'position:absolute;top:6px;right:8px;background:none;border:none;color:#666;font-size:14px;cursor:pointer', '×')
    close.onclick = () => panel.remove()
    const status = el('div', 'font-size:11px;color:#666', 'starting...')
    status.id = '__sync_status'
    const input = el('input', 'background:#222;color:#fff;border:1px solid #444;border-radius:4px;padding:4px 6px;font-family:monospace;font-size:12px;width:70px;outline:none')
    input.placeholder = 'xxxxx'; input.maxLength = 8
    const joinBtn = el('button', `${BTN};background:#1a3a6a;color:#fff`, 'join')
    joinBtn.onclick = () => {
      const code = input.value.trim().toLowerCase()
      if (!code) return
      joinBtn.disabled = true
      joinScene(code).catch(() => { joinBtn.disabled = false })
    }
    input.onkeydown = e => { if (e.key === 'Enter') joinBtn.click() }
    const row = el('div', 'display:flex;gap:6px')
    row.append(input, joinBtn)
    panel.append(close, el('div', 'font-size:11px;color:#888;letter-spacing:.05em', 'boostlet sync'), status, el('div', 'border-top:1px solid #333;margin:2px 0'), el('div', 'font-size:11px;color:#888', 'join with code'), row)
    document.body.appendChild(panel)
  }

  function updatePanel(code) {
    const status = document.getElementById('__sync_status')
    if (!status) return
    const shareUrl = `${location.origin}${location.pathname}?sync=${code}`
    const copyBtn = el('button', `${BTN};background:#1a3a1a;color:#8c8;border:1px solid #4a4`, 'copy link')
    copyBtn.onclick = () => navigator.clipboard.writeText(shareUrl).then(() => { copyBtn.textContent = 'copied'; setTimeout(() => { copyBtn.textContent = 'copy link' }, 1500) })
    const codeRow = el('div', 'display:flex;align-items:center;gap:8px')
    codeRow.append(el('span', 'color:#4a4;letter-spacing:.1em;font-size:13px', code), copyBtn)
    const row = el('div', 'display:flex;flex-direction:column;gap:6px')
    row.append(codeRow)
    if (DROPBOX_APP_KEY) {
      const btn = el('button', `${BTN};background:#0061fe;color:#fff;margin-top:2px`, 'save volume to dropbox')
      btn.onclick = async () => { btn.disabled = true; btn.textContent = 'uploading...'; await uploadVolumeToDropbox(); btn.disabled = false; btn.textContent = 'save volume to dropbox' }
      row.append(btn)
    }
    status.replaceWith(row)
  }

  function promptBoostlets(boostlets) {
    const missing = boostlets.filter(b => !(window.__boostlet_active || []).find(a => a.name === b.name))
    if (!missing.length) return
    const prompt = el('div', 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#111;border:1.5px solid #444;border-radius:8px;padding:12px 16px;font-family:monospace;font-size:12px;color:#ccc;box-shadow:0 4px 16px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:8px;max-width:320px')
    prompt.append(el('div', 'font-size:11px;color:#888', 'host has these boostlets active'))
    for (const b of missing) {
      const btn = el('button', `${BTN};background:#1a3a6a;color:#fff`, 'load')
      btn.onclick = () => { Boostlet.load_script(b.url, () => {}); btn.textContent = 'loaded'; btn.disabled = true }
      const row = el('div', 'display:flex;justify-content:space-between;align-items:center;gap:12px')
      row.append(el('span', null, b.name), btn)
      prompt.appendChild(row)
    }
    const dismiss = el('button', `${BTN};background:none;border:1px solid #444;color:#666;align-self:flex-end`, 'dismiss')
    dismiss.onclick = () => prompt.remove()
    prompt.appendChild(dismiss)
    document.body.appendChild(prompt)
    setTimeout(() => prompt.remove(), 15000)
  }

  // ===== utils =====

  function isSamePage(a, b) {
    try { const ua = new URL(a), ub = new URL(b); return ua.origin + ua.pathname === ub.origin + ub.pathname } catch { return false }
  }

})() //
