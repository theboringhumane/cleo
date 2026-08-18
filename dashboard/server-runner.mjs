import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const clientDir = join(__dirname, 'dist', 'client')

const { default: serverEntry } = await import('./dist/server/server.js')

const MIME = {
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.html': 'text/html',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

const PORT = parseInt(process.env.PORT || '3000', 10)

createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  // Health check for container orchestration
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }))
    return
  }

  // Serve static assets from the client build
  if (url.pathname.startsWith('/assets/')) {
    try {
      const filePath = join(clientDir, url.pathname)
      const data = await readFile(filePath)
      res.writeHead(200, {
        'Content-Type': MIME[extname(filePath)] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      })
      res.end(data)
      return
    } catch {
      // fall through to SSR
    }
  }

  // Build a Web-standard Request for the TanStack Start handler
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === 'string') headers.set(k, v)
    else if (Array.isArray(v)) v.forEach((x) => headers.append(k, x))
  }

  const init = { method: req.method, headers }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = []
    for await (const c of req) chunks.push(c)
    init.body = Buffer.concat(chunks)
    // @ts-expect-error duplex required for streaming bodies in Node 18+
    init.duplex = 'half'
  }

  try {
    const request = new Request(url.href, init)
    const response = await serverEntry.fetch(request)

    res.statusCode = response.status
    response.headers.forEach((v, k) => res.setHeader(k, v))

    if (response.body) {
      const reader = response.body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(value)
      }
    } else {
      const text = await response.text()
      res.write(text)
    }
    res.end()
  } catch (err) {
    console.error('SSR error:', err)
    res.statusCode = 500
    res.end('Internal Server Error')
  }
}).listen(PORT, () => {
  console.log(`Cleo dashboard listening on http://localhost:${PORT}`)
})
