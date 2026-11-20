CATEGORY = "Collaboration"
;(function () {
  if (window.__boostlet_sync_injected) return
  window.__boostlet_sync_injected = true

  // ===== config =====

  const BOOSTLET_URL = 'https://boostlet.org/dist/boostlet.min.js'
  const PUSHER_KEY = '831ed99bd7a1e904c749'
  const PUSHER_CLUSTER = 'us2'
  const PUSHER_AUTH_URL = 'https://boostlet-sync.mpsych.workers.dev'
  const ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
  const DROPBOX_APP_KEY = '3iucmciu34krlh9'
  const DROPBOX_REDIRECT = 'https://boostlet.org/dropbox-callback.html'

  // ===== state =====

  const state = {
    nv: null, pusher: null, channel: null,
    peers: new Map(), selfId: null,
    last: {}, rafId: null, pollId: null,
    dropboxToken: null, roomCode: null, sceneToken: null,
    isHost: false
  }

  // time of the last failed send warning so hints dont pile up
  let lastSendWarning = 0

  // ===== latency measurement state =====

  const _pendingPings = new Map() // id -> callback(rtt)
  let _pingCounter = 0

  // ===== public api =====

  window.__sync_send = function (msg) { broadcast(msg) }

  // Measure round-trip latency to all connected peers.
  // Usage (in console): window.__sync_measureLatency(100).then(console.table)
  // lost pings count as timeouts
  window.__sync_measureLatency = function (nSamples, timeoutMs) {
    nSamples = nSamples || 100
    timeoutMs = timeoutMs || 2000
    const openPeers = [...state.peers.entries()].filter(([, p]) => p.channel?.readyState === 'open')
    if (!openPeers.length) { console.warn('[sync] no open peers'); return Promise.resolve([]) }
    return Promise.all(openPeers.map(([peerId, peer]) => new Promise(resolve => {
      const samples = []
      let sent = 0, timeouts = 0
      function finish () {
        if (!samples.length) { resolve({ peerId, n: 0, timeouts }); return }
        const n = samples.length
        const sorted = [...samples].sort((a, b) => a - b)
        const mean = samples.reduce((a, b) => a + b, 0) / n
        const std  = Math.sqrt(samples.map(x => (x - mean) ** 2).reduce((a, b) => a + b, 0) / n)
        resolve({ peerId, n, timeouts, median: +sorted[Math.floor(n / 2)].toFixed(2), mean: +mean.toFixed(2), std: +std.toFixed(2), min: +sorted[0].toFixed(2), max: +sorted[n - 1].toFixed(2) })
      }
      function next () {
        if (sent === nSamples) { finish(); return }
        sent++
        const id = `${peerId}_${_pingCounter++}`
        const timer = setTimeout(() => { _pendingPings.delete(id); timeouts++; next() }, timeoutMs)
        _pendingPings.set(id, rtt => {
          clearTimeout(timer)
          // Infinity means the peer dropped
          if (Number.isFinite(rtt)) samples.push(rtt)
          else timeouts++
          next()
        })
        try { peer.channel.send(JSON.stringify({ type: 'latency-ping', id, t: performance.now() })) }
        catch (e) { clearTimeout(timer); _pendingPings.delete(id); timeouts++; next() }
      }
      next()
    })))
  }

  // Pretty-print a latency report to the console.
  // Usage: window.__sync_latencyReport(100)
  window.__sync_latencyReport = function (nSamples) {
    return window.__sync_measureLatency(nSamples || 100).then(results => {
      const valid = results.filter(r => r && r.n)
      if (!valid.length) { console.warn('[sync] no peers connected'); return results }
      console.log(`[sync] latency report, ${valid.length} peer(s), ${valid[0]?.n} samples each`)
      console.table(valid.map(r => ({
        peerId: r.peerId,
        n: r.n,
        timeouts: r.timeouts,
        'median (ms)': r.median,
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
    leaveRoom()
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

  // give up after 12 seconds like the other boostlets so a page without niivue says so
  function waitForNv() {
    let tries = 0
    state.pollId = setInterval(() => {
      let nv = null
      try {
        Boostlet.init()
        if (Boostlet.framework.name === 'niivue' && Boostlet.framework.instance?.volumes) nv = Boostlet.framework.instance
      } catch (e) {}
      if (!nv && ++tries <= 40) return
      clearInterval(state.pollId); state.pollId = null
      if (!nv) {
        window.__boostlet_sync_injected = false
        Boostlet.hint('Sync found no NiiVue viewer with a loaded volume', 5000)
        return
      }
      if (window.Pusher) start(nv)
      else loadScript('https://js.pusher.com/8.4.0/pusher.min.js', () => start(nv))
    }, 300)
  }

  function start(nv) {
    state.nv = nv
    Boostlet.hint('Sync loaded', 2500)
    const code = new URLSearchParams(location.search).get('sync')
    // everyone gets the panel and a share link joins right away
    showPanel()
    if (code) joinScene(code)
  }

  // ===== scene =====

  // not cached, the volume can change after hosting (dropbox load, numpy run)
  // and this only runs when a peer connects
  async function hashVolume() {
    const img = state.nv.volumes?.[0]?.img
    if (!img) return null
    const buf = await crypto.subtle.digest('SHA-256', img)
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  function readScene(full) {
    const nv = state.nv
    const vol = nv.volumes?.[0]
    // index explicitly, after loadDocument crosshairPos is a plain object
    // like {0: .5, 1: .5, 2: .5} and Array.from would turn it into []
    const pos = nv.scene?.crosshairPos
    const snap = {
      crosshairPos: pos ? [0, 1, 2].map(i => pos[i]) : [0.5, 0.5, 0.5],
      sliceType: nv.opts?.sliceType ?? 0,
      colormap: vol?.colormap ?? null,
      cal_min: vol?.cal_min ?? null,
      cal_max: vol?.cal_max ?? null,
      // 3d camera as azimuth elevation zoom and the three clip plane values
      camera: [nv.scene?.renderAzimuth, nv.scene?.renderElevation, nv.scene?.volScaleMultiplier, ...(nv.scene?.clipPlaneDepthAziElev || [])]
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
    // an empty or partial crosshair blanks every slice, so ignore it
    if (diff.crosshairPos?.length === 3 && diff.crosshairPos.every(Number.isFinite)) {
      nv.scene.crosshairPos = new Float32Array(diff.crosshairPos)
      nv.drawScene?.()
      // so other boostlets see the move
      nv.createOnLocationChange?.()
    }
    if (diff.sliceType !== undefined && nv.opts.sliceType !== diff.sliceType) nv.setSliceType?.(diff.sliceType)
    // a partial or broken camera is ignored like a broken crosshair
    if (diff.camera?.length === 6 && diff.camera.every(Number.isFinite)) {
      const [azimuth, elevation, zoom, ...clip] = diff.camera
      nv.setRenderAzimuthElevation?.(azimuth, elevation)
      nv.setScale?.(zoom)
      nv.setClipPlane?.(clip)
    }
    const vol = nv.volumes?.[0]
    if (vol) {
      let dirty = false
      if (diff.colormap && diff.colormap !== vol.colormap) { nv.setColormap?.(vol.id, diff.colormap); dirty = true }
      if (diff.cal_min != null) { vol.cal_min = diff.cal_min; dirty = true }
      if (diff.cal_max != null) { vol.cal_max = diff.cal_max; dirty = true }
      if (dirty) nv.updateGLVolume?.()
    }
    // mark what we just applied as already seen so the broadcast loop
    // doesnt send it straight back to the peer (that echo caused the shaking)
    const cur = readScene(false)
    for (const k of Object.keys(diff)) if (k in cur) state.last[k] = cur[k]
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

  // runs from the host button click and must reach the dropbox popup without an await
  // so the popup still counts as part of the click
  async function hostScene() {
    leaveRoom()
    const code = makeCode()
    state.roomCode = code
    state.isHost = true
    setSyncParam(code)
    updatePanel(code)
    connectToRoom(code)
    await publishScene(code, readScene(true))
  }

  async function joinScene(code) {
    leaveRoom()
    state.roomCode = code
    // show the code now so the host button is gone while the scene loads
    updatePanel(code)
    let scene
    try {
      const res = await fetch(`${PUSHER_AUTH_URL}/scene/${code}`)
      if (res.ok) {
        const { sceneUrl } = await res.json()
        if (sceneUrl) scene = await fetch(sceneUrl).then(r => r.json())
      }
    } catch (e) {}

    if (!scene) { setSyncParam(code); updatePanel(code); connectToRoom(code); return }

    // only follow https pages so a scene cant send a javascript url
    if (scene.originUrl && !isSamePage(scene.originUrl, location.href)) {
      let target
      try { target = new URL(scene.originUrl) } catch (e) { target = null }
      if (!target || target.protocol !== 'https:') { Boostlet.hint('scene has an invalid page url', 4000); return }
      target.searchParams.set('sync', code)
      location.href = target.toString()
      return
    }

    await applyScene(scene)
    setSyncParam(code)
    updatePanel(code)
    if (scene.activeBoostlets?.length) promptBoostlets(scene.activeBoostlets)
    connectToRoom(code)
  }

  async function publishScene(code, scene) {
    const sceneUrl = await dropboxUpload(`/scenes/${code}_${Date.now()}.json`, new TextEncoder().encode(JSON.stringify(scene)))
    if (!sceneUrl) return
    // the worker hands back a token on first publish, only that token can update the room
    try {
      const res = await fetch(`${PUSHER_AUTH_URL}/scene`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, sceneUrl, token: state.sceneToken })
      })
      const data = await res.json()
      if (data.token) state.sceneToken = data.token
    } catch (e) {}
  }

  // leave the current room before hosting or joining another so only one stays open
  function leaveRoom() {
    if (state.rafId) cancelAnimationFrame(state.rafId)
    if (state.channel) state.channel.unbind_all()
    if (state.pusher) state.pusher.disconnect()
    state.peers.forEach(peer => { peer.channel?.close(); peer.conn.close() })
    state.peers.clear()
    state.rafId = state.pusher = state.channel = state.selfId = state.sceneToken = null
    state.isHost = false
  }

  // keep the room code in the address bar so the page address is the share link
  function setSyncParam(code) {
    const params = new URLSearchParams(location.search)
    params.set('sync', code)
    history.replaceState(null, '', `${location.pathname}?${params}${location.hash}`)
  }

  // 10 chars from a crypto source so room codes cant be guessed
  function makeCode() {
    return Array.from(crypto.getRandomValues(new Uint8Array(10)), b => (b % 36).toString(36)).join('')
  }

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

    // open the popup before any await so it still belongs to the click
    // safari blocks a popup that opens after the click handler returned
    const popup = window.open('about:blank', 'dropbox_auth', 'width=500,height=700')
    if (!popup) { Boostlet.hint('popup blocked by browser', 4000); return null }

    const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
    const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    const authUrl = 'https://www.dropbox.com/oauth2/authorize'
      + '?client_id=' + DROPBOX_APP_KEY
      + '&response_type=code&code_challenge=' + challenge
      + '&code_challenge_method=S256&redirect_uri=' + encodeURIComponent(DROPBOX_REDIRECT)
      + '&token_access_type=online'

    popup.location.href = authUrl

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
    // only the sform rows are written below so the file must not claim a qform
    d.setInt16(252, 0, true)
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
    // pusher adds the real sender id on presence channels so a peer cant sign as someone else
    const senderOf = (d, meta) => meta?.user_id || d.from
    channel.bind('client-offer', (d, meta) => { if (d.to === state.selfId) handleOffer(senderOf(d, meta), d.payload) })
    channel.bind('client-answer', (d, meta) => { if (d.to === state.selfId) handleAnswer(senderOf(d, meta), d.payload) })
    channel.bind('client-ice', (d, meta) => { if (d.to === state.selfId) handleIce(senderOf(d, meta), d.payload) })

    startBroadcasting()
  }

  function sendSignal(type, to, payload) {
    state.channel?.trigger(`client-${type}`, { from: state.selfId, to, payload })
  }

  function startBroadcasting() {
    const last = state.last
    let lastCrosshairBroadcast = 0
    let lastCameraBroadcast = 0
    const tick = () => {
      state.rafId = requestAnimationFrame(tick)
      const cur = readScene(false)
      const now = Date.now()
      const patch = {}
      const crosshairChanged = cur.crosshairPos && (!last.crosshairPos || cur.crosshairPos.some((v, i) => v !== last.crosshairPos[i]))
      if (crosshairChanged && now - lastCrosshairBroadcast >= 33) { patch.crosshairPos = cur.crosshairPos; last.crosshairPos = cur.crosshairPos; lastCrosshairBroadcast = now }
      const cameraChanged = !last.camera || cur.camera.some((v, i) => v !== last.camera[i])
      if (cameraChanged && now - lastCameraBroadcast >= 33) { patch.camera = cur.camera; last.camera = cur.camera; lastCameraBroadcast = now }
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
      // the host sends its whole view once so a late joiner starts where the host is
      // after that only changes are sent
      if (state.isHost) {
        try { channel.send(JSON.stringify({ type: 'scene-patch', patch: readScene(false) })) } catch (e) {}
      }
      const hash = await hashVolume()
      try { channel.send(JSON.stringify({ type: 'hash-hello', hash })) } catch (e) {}
      // lets boostlets exchange their own state with the new peer
      routeMessage({ type: 'sync-peer-open' }, peerId)
    }

    channel.onmessage = e => {
      if (typeof e.data !== 'string') return
      let msg; try { msg = JSON.parse(e.data) } catch { return }

      if (msg.type === 'hash-hello') {
        hashVolume().then(localHash => {
          const match = localHash === msg.hash || (!localHash && !msg.hash)
          try { channel.send(JSON.stringify({ type: 'hash-ack', match })) } catch (e) {}
          Boostlet.hint(match ? 'peer connected' : 'volumes differ, use dropbox to share', match ? 2000 : 6000)
        })
        return
      }
      if (msg.type === 'hash-ack') {
        Boostlet.hint(msg.match ? 'peer connected' : 'volumes differ, use dropbox to share', msg.match ? 2000 : 6000)
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
        applyDiff(msg.patch)
        return
      }
      if (msg.type === 'volume-ready' && msg.volumeUrl) {
        // only load volumes shared through dropbox
        let host = ''
        try { host = new URL(msg.volumeUrl).hostname } catch (e) {}
        if (!/(^|\.)dropbox(usercontent)?\.com$/.test(host)) return
        // always load the dropbox volume regardless of whether a volume is already present
        Boostlet.hint('loading volume from dropbox', 3000)
        state.nv.loadVolumes([{ url: msg.volumeUrl }]).then(() => {
          if (msg.scene) applyDiff(msg.scene)
        }).catch(() => Boostlet.hint('could not load volume from dropbox', 4000))
        return
      }
      // this name is only ever raised locally when a channel opens
      if (msg.type === 'sync-peer-open') return
      routeMessage(msg, peerId)
    }

    channel.onclose = () => { if (peer.channel === channel) peer.channel = null }
  }

  function broadcast(msg) {
    const str = JSON.stringify(msg)
    let failed = 0
    state.peers.forEach(peer => {
      if (peer.channel?.readyState !== 'open') { failed++; return }
      try { peer.channel.send(str) } catch (e) { failed++ }
    })
    // viewer moves repeat many times a second so only boostlet messages warn
    if (failed && msg.type !== 'scene-patch' && Date.now() - lastSendWarning > 3000) {
      lastSendWarning = Date.now()
      Boostlet.hint(`sync could not reach ${failed} of ${state.peers.size} peers`, 3000)
    }
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
  // peerId is the connection the message arrived on
  function routeMessage(msg, peerId) {
    if (!msg?.type) return
    for (const entry of window.__boostlet_active) if (typeof entry.onMessage === 'function') entry.onMessage(msg, peerId)
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
    // the host button sits where the room code goes and is replaced by it
    // hosting opens the dropbox sign in so it has to start from this click
    const status = el('div', 'font-size:11px;color:#666')
    status.id = '__sync_status'
    const hostBtn = el('button', `${BTN};background:#1a3a1a;color:#8c8;border:1px solid #4a4`, 'host')
    hostBtn.onclick = () => { hostBtn.disabled = true; hostScene() }
    status.append(hostBtn)
    const input = el('input', 'background:#222;color:#fff;border:1px solid #444;border-radius:4px;padding:4px 6px;font-family:monospace;font-size:12px;width:100px;outline:none')
    input.placeholder = 'room code'; input.maxLength = 10
    const joinBtn = el('button', `${BTN};background:#1a3a6a;color:#fff`, 'join')
    joinBtn.onclick = () => {
      const code = input.value.trim().toLowerCase()
      if (!code) return
      joinBtn.disabled = true
      joinScene(code).finally(() => { joinBtn.disabled = false })
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
    // the full address keeps the page state in the query so the link opens the same view
    const shareUrl = location.href
    const copyBtn = el('button', `${BTN};background:#1a3a1a;color:#8c8;border:1px solid #4a4`, 'copy link')
    copyBtn.onclick = () => navigator.clipboard.writeText(shareUrl).then(() => { copyBtn.textContent = 'copied'; setTimeout(() => { copyBtn.textContent = 'copy link' }, 1500) })
    const codeRow = el('div', 'display:flex;align-items:center;gap:8px')
    codeRow.append(el('span', 'color:#4a4;letter-spacing:.1em;font-size:13px', code), copyBtn)
    const row = el('div', 'display:flex;flex-direction:column;gap:6px')
    // same id so a later host or join replaces this row again
    row.id = '__sync_status'
    row.append(codeRow)
    // only the host shares a volume
    if (DROPBOX_APP_KEY && state.isHost) {
      const btn = el('button', `${BTN};background:#0061fe;color:#fff;margin-top:2px`, 'save volume to dropbox')
      btn.onclick = async () => { btn.disabled = true; btn.textContent = 'uploading...'; await uploadVolumeToDropbox(); btn.disabled = false; btn.textContent = 'save volume to dropbox' }
      row.append(btn)
    }
    status.replaceWith(row)
  }

  function promptBoostlets(boostlets) {
    // only offer boostlets that load from the boostlet repo or site
    const missing = boostlets.filter(b => isTrustedBoostlet(b.url) && !(window.__boostlet_active || []).find(a => a.name === b.name))
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

  function isTrustedBoostlet(url) {
    try {
      const u = new URL(url)
      if (u.protocol !== 'https:') return false
      if (u.hostname === 'boostlet.org') return true
      return u.hostname === 'raw.githubusercontent.com' && u.pathname.startsWith('/mpsych/boostlet/')
    } catch (e) { return false }
  }

  // query params count too (minus sync) since single page viewers like slicedrop
  // keep what is loaded in the query string, not the path
  function isSamePage(a, b) {
    try {
      const ua = new URL(a), ub = new URL(b)
      for (const u of [ua, ub]) { u.searchParams.delete('sync'); u.searchParams.sort() }
      return ua.origin + ua.pathname + ua.search === ub.origin + ub.pathname + ub.search
    } catch { return false }
  }

})() //