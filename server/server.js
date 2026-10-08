// boostlet pusher auth worker (cloudflare workers)
// handles pusher channel auth and scene url storage via kv
// kv stores code -> { sceneUrl, token } with 30 day expiry
// signaling (offer/answer/ice) goes peer to peer via pusher client events

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With'
}

// 30 days
const SCENE_TTL = 2592000

// lowercase alphanumeric, 5 allows codes from older sync.js clients
const CODE_RE = /^[a-z0-9]{5,32}$/

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    const url = new URL(request.url)

    // scene url storage
    // the first publish for a code gets a token back, and only that token
    // can update the code later, so nobody else can repoint someone's room
    if (url.pathname === '/scene' && request.method === 'POST') {
      const { code, sceneUrl, token } = await request.json()
      if (!code || !sceneUrl) return json({ error: 'missing fields' }, 400)
      if (!CODE_RE.test(code)) return json({ error: 'bad code' }, 400)

      const existing = parseEntry(await env.BOOSTLET_SCENES.get(code))
      // entries from before tokens have no owner, so they stay writable
      if (existing?.token && existing.token !== token) {
        return json({ error: 'code taken' }, 409)
      }

      const owner = existing?.token || crypto.randomUUID()
      await env.BOOSTLET_SCENES.put(code, JSON.stringify({ sceneUrl, token: owner }), { expirationTtl: SCENE_TTL })
      return json({ ok: true, token: owner })
    }

    if (url.pathname.startsWith('/scene/') && request.method === 'GET') {
      const code = url.pathname.slice(7)
      const entry = parseEntry(await env.BOOSTLET_SCENES.get(code))
      if (!entry) return json({ error: 'not found' }, 404)
      // never send the token back out
      return json({ sceneUrl: entry.sceneUrl })
    }

    // pusher auth
    if (request.method !== 'POST') {
      return new Response('not found', { status: 404, headers: CORS })
    }

    const body = await request.text()
    const params = new URLSearchParams(body)
    const socket_id = params.get('socket_id')
    const channel_name = params.get('channel_name')
    const user_id = params.get('user_id') || socket_id

    if (!socket_id || !channel_name) {
      return new Response('missing fields', { status: 400, headers: CORS })
    }

    // sign the exact channel_data string we send back so they always match
    const channel_data = JSON.stringify({ user_id, user_info: {} })
    const sig = await hmacSHA256(env.PUSHER_SECRET, `${socket_id}:${channel_name}:${channel_data}`)

    return json({ auth: `${env.PUSHER_KEY}:${sig}`, channel_data })
  }
}

// old entries are a bare url string, new ones are json
function parseEntry(raw) {
  if (!raw) return null
  try { return JSON.parse(raw) } catch (e) { return { sceneUrl: raw, token: null } }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  })
}

async function hmacSHA256(secret, message) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}
