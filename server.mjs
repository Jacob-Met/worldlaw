import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, extname } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = {'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
export function createProductServer() {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
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
    const allowed = ['/index.html','/styles.css','/favicon.svg','/motion.html','/motion.css',
      '/coupling.html','/coupling.css','/trajectory.html','/trajectory.css','/unknown-lab.html','/unknown-lab.css','/examples/trajectory-pendulum-92be.json',
      '/examples/trajectory-ambiguous-92be.json','/examples/physical-pasco-92be.json'].includes(pathname) || /^\/src\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.mjs$/.test(pathname);
    if (!allowed) { res.writeHead(404).end('File not found.'); return; }
    try {
      const bytes = await readFile(resolve(root, '.' + pathname));
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
