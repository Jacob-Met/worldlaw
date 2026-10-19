/** Additive preview entrypoint; delegates the studio to its existing owner. */
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {createProductServer} from '../server.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const publicFiles=new Set(['/trajectory.html','/trajectory.css','/examples/trajectory-pendulum-92be.json','/examples/trajectory-ambiguous-92be.json','/examples/physical-pasco-92be.json']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
export function createChallengeServer(){
  const studio=createProductServer();
  return http.createServer(async(req,res)=>{
    let pathname;
    try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end('Invalid request.');return;}
    if(pathname==='/')pathname='/trajectory.html';
    if(!publicFiles.has(pathname)){studio.emit('request',req,res);return;}
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'}).end('This application serves local files only.');return;}
    try{const bytes=await readFile(resolve(root,'.'+pathname));res.writeHead(200,{'Content-Type':types[extname(pathname)],'Content-Length':bytes.length});res.end(req.method==='HEAD'?undefined:bytes);}catch{res.writeHead(404).end('File not found.');}
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT||4194);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be an integer from 1 to 65535.');
  const server=createChallengeServer();
  server.on('error',error=>{console.error(error.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`WORLDLAW trajectory challenge: http://127.0.0.1:${port}/trajectory.html`));
}
