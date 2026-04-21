import http from 'http';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR  = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
};

// ── Static file server ──────────────────────────────────────────────────────
function serveStatic(req, res) {
  const filePath = path.join(DIR, req.url === '/' ? 'robobuddy.html' : req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'text/plain' });
    res.end(data);
  });
}

// ── Anthropic proxy (uses Node 18+ built-in fetch) ──────────────────────────
async function proxyChat(req, res) {
  // Collect full request body
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks).toString();

  let parsed;
  try { parsed = JSON.parse(rawBody); } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'Invalid request body.' } }));
    return;
  }

  const { _apiKey, ...anthropicBody } = parsed;
  const apiKey = (_apiKey || process.env.ANTHROPIC_API_KEY || '').trim();

  if (!apiKey) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'No API key — enter it in the Chat tab.' } }));
    return;
  }

  console.log(`[proxy] → Anthropic  model=${anthropicBody.model}  stream=${anthropicBody.stream}`);
  console.log(`[proxy]   key preview: ${apiKey.slice(0, 18)}...${apiKey.slice(-4)}  length=${apiKey.length}`);

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    });

    const ct       = upstream.headers.get('content-type') || 'application/json';
    const isStream = ct.includes('event-stream');

    console.log(`[proxy] ← Anthropic  status=${upstream.status}  content-type=${ct}`);

    res.writeHead(upstream.status, {
      'Content-Type': ct,
      ...(isStream ? {
        'Cache-Control':     'no-cache',
        'Connection':        'keep-alive',
        'X-Accel-Buffering': 'no',
      } : {}),
    });

    // Stream the response body straight to the browser
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const ok = res.write(value);
      if (!ok) await new Promise(r => res.once('drain', r));
    }
    res.end();

  } catch (err) {
    console.error('[proxy] fetch error:', err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: err.message } }));
    }
  }
}

// ── Router ───────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  console.log(`[${req.method}] ${pathname}`);

  if (req.method === 'POST' && pathname === '/api/chat') {
    await proxyChat(req, res);
  } else if (req.method === 'GET' && pathname === '/api/validate-key') {
    // Quick key validation endpoint — pass ?key=sk-ant-...
    const key = (new URL(req.url, 'http://localhost').searchParams.get('key') || '').trim();
    if (!key) { res.writeHead(400); res.end(JSON.stringify({ error: 'No key provided' })); return; }
    try {
      const r = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
      });
      const body = await r.json();
      res.writeHead(r.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: r.status, ok: r.ok, body }));
    } catch (e) {
      res.writeHead(502); res.end(JSON.stringify({ error: e.message }));
    }
  } else if (req.method === 'GET') {
    serveStatic(req, res);
  } else {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: `Method ${req.method} not allowed.` } }));
  }
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌  Port ${PORT} is already in use.`);
    console.error(`   Run this to free it:  lsof -ti :${PORT} | xargs kill -9\n`);
  } else {
    console.error('Server error:', err.message);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`\n🤖  RoboBuddy  →  http://localhost:${PORT}`);
  console.log('   Open that URL in your browser (not the file directly).\n');
});
