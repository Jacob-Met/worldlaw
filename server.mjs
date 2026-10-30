import http from 'node:http';
import { lstat, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, extname, join } from 'node:path';
import { requestLawCandidates, summarizeTraining, MAX_PROPOSED_CANDIDATES } from './src/science/nemotron-law-candidates.mjs';

const MAX_PROPOSAL_BODY_BYTES = 1_500_000;

const root = fileURLToPath(new URL('.', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
// Binding to loopback does not authenticate HTTP Host (DNS rebinding can target it).
// Native clients without Origin are allowed, but browsers must be same origin.
function localRequest(req) {
  const rawHost = req.headers.host;
  if (typeof rawHost !== 'string' || /[\x00-\x20,@]/.test(rawHost) || rawHost.includes(String.fromCharCode(92))) return false;
  let target;
  try { target = new URL('http://' + rawHost); } catch { return false; }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname.toLowerCase())) return false;
  if (target.username || target.password || target.pathname !== '/' || target.search || target.hash) return false;
  if (target.port !== String(req.socket.localPort)) return false;
  if (req.headers.origin !== undefined) {
    if (typeof req.headers.origin !== 'string') return false;
    let from;
    try { from = new URL(req.headers.origin); } catch { return false; }
    if (from.origin !== target.origin || req.headers.origin !== from.origin) return false;
  }
  return true;
}

// Check each stable filesystem component and the opened regular-file identity.
// O_NOFOLLOW refuses final symlink swaps; directory replacement races are not
// claimed to be fully solved across all platforms.
async function readPublicAsset(pathname) {
  const segments = pathname.slice(1).split('/');
  let path = root;
  let expected;
  for (let i = 0; i < segments.length; i++) {
    path = join(path, segments[i]);
    const entry = await lstat(path);
    if (entry.isSymbolicLink()) throw new Error('linked asset');
    if (i < segments.length - 1 && !entry.isDirectory()) throw new Error('non-directory asset parent');
    if (i === segments.length - 1) {
      if (!entry.isFile()) throw new Error('nonregular asset');
      expected = entry;
    }
  }
  const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0) | (constants.O_NONBLOCK || 0));
  try {
    const received = await file.stat();
    if (!received.isFile() || received.dev !== expected.dev || received.ino !== expected.ino) throw new Error('asset changed while opening');
    return await file.readFile();
  } finally {
    await file.close();
  }
}
// Server-side Nemotron proposal. The browser never sees NEBIUS_API_KEY; errors
// are returned as plain JSON without echoing the key or upstream bodies.
async function handleLawCandidates(req, res) {
  const json = (status, body) => { res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8'}); res.end(JSON.stringify(body)); };
  if (req.method !== 'POST') { res.writeHead(405, {'Allow': 'POST'}).end('Use POST.'); return; }
  if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) { json(415, {error: 'Send application/json.'}); return; }
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_PROPOSAL_BODY_BYTES) { json(413, {error: 'Request is too large.'}); req.destroy(); return; }
    chunks.push(chunk);
  }
  const apiKey = process.env.NEBIUS_API_KEY;
  if (!apiKey) { json(503, {error: 'NEBIUS_API_KEY is not set on this server. Nemotron proposals are unavailable; every other workbench function still works.', code: 'no_key'}); return; }
  let payload;
  try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { json(400, {error: 'Request body is not valid JSON.'}); return; }
  try {
    const summary = summarizeTraining(payload.observations);
    const baseTerms = Array.isArray(payload.baseTerms) ? payload.baseTerms.map(String) : [];
    const result = await requestLawCandidates({summary, baseTerms, apiKey, model: process.env.NEBIUS_MODEL || undefined});
    json(200, {model: result.model, latencyMs: result.latencyMs, candidates: result.candidates, rejected: result.rejected, maxCandidates: MAX_PROPOSED_CANDIDATES});
  } catch (error) {
    const code = error?.code === 'model_reply' || error?.code === 'upstream' ? error.code : 'invalid_input';
    json(code === 'invalid_input' ? 400 : 502, {error: code === 'invalid_input' ? error.message : 'Nemotron proposal failed: ' + error.message, code});
  }
}
export function createProductServer() {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (!localRequest(req)) {
      res.writeHead(403).end('Only same-origin loopback requests are accepted.'); return;
    }
    if (new URL(req.url, 'http://localhost').pathname === '/api/nemotron/law-candidates') {
      await handleLawCandidates(req, res); return;
    }
    if (!['GET','HEAD'].includes(req.method)) {
      res.writeHead(405, {'Allow':'GET, HEAD'}).end('This application serves local files only.'); return;
    }
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400).end('Invalid request.'); return; }
    if (pathname === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({product:'worldlaw',version:'0.1.0',mode:'local-discovery-studio'})); return;
    }
    if (pathname === '/') pathname = '/index.html';
    const allowed = ['/cycle-work.html','/index.html','/stiffness.html','/stiffness.css','/styles.css','/separability.css','/favicon.svg','/motion.html','/motion.css','/motion-reference.html','/motion-reference.css',
      '/coupling.html','/coupling.css','/trajectory.html','/trajectory.css','/unknown-lab.html','/unknown-lab.css','/examples/trajectory-pendulum-92be.json',
      '/examples/correlation-band.json','/examples/period-bands.json','/examples/smooth-drift.json','/examples/trajectory-ambiguous-92be.json','/examples/physical-pasco-92be.json','/examples/physical-giessler-28271405/state-observations.json'].includes(pathname) || /^\/src\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.mjs$/.test(pathname);
    if (!allowed) { res.writeHead(404).end('File not found.'); return; }
    try {
      const bytes = await readPublicAsset(pathname);
      res.writeHead(200, {'Content-Type':types[extname(pathname)] || 'application/octet-stream','Content-Length':bytes.length});
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch { res.writeHead(404).end('File not found.'); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4193);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
  const server = createProductServer();
  server.listen(port, '127.0.0.1', () => console.log(`WORLDLAW listening at http://127.0.0.1:${port}`));
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
}
