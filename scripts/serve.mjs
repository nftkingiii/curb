import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'

const port = Number(process.env.PORT || 4173)
const host = '0.0.0.0'
const distRoot = resolve(process.cwd(), 'dist')
const allowedRoot = `${distRoot}${sep}`

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
}

function sendFile(request, response, filePath) {
  const extension = extname(filePath).toLowerCase()
  const cacheControl = filePath.includes(`${sep}assets${sep}`)
    ? 'public, max-age=31536000, immutable'
    : extension === '.html'
      ? 'no-cache'
      : 'public, max-age=86400'

  response.writeHead(200, {
    'Cache-Control': cacheControl,
    'Content-Type': contentTypes[extension] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  })

  if (request.method === 'HEAD') return response.end()
  createReadStream(filePath).pipe(response)
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)

  if (url.pathname === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    return response.end(JSON.stringify({ status: 'ok', service: 'curb' }))
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' })
    return response.end('Method not allowed')
  }

  let pathname
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    response.writeHead(400)
    return response.end('Bad request')
  }

  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1)
  let filePath = resolve(distRoot, relativePath)

  if (filePath !== distRoot && !filePath.startsWith(allowedRoot)) {
    response.writeHead(403)
    return response.end('Forbidden')
  }

  try {
    const fileStat = await stat(filePath)
    if (fileStat.isDirectory()) filePath = resolve(filePath, 'index.html')
    await stat(filePath)
  } catch {
    if (extname(relativePath)) {
      response.writeHead(404)
      return response.end('Not found')
    }
    filePath = resolve(distRoot, 'index.html')
  }

  sendFile(request, response, filePath)
})

server.listen(port, host, () => {
  console.log(`Curb is listening on ${host}:${port}`)
})

function shutdown() {
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
