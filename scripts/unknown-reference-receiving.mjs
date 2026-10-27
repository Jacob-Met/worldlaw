import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createProductServer} from '../server.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const root=new URL('../',import.meta.url),seen=new Set();
async function visit(file){if(seen.has(file))return;seen.add(file);const text=await readFile(new URL(file,root),'utf8');if(file.endsWith('.mjs'))for(const m of text.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+\.mjs)['"]/g))await visit(new URL(m[1],new URL(file,root)).pathname.slice(root.pathname.length));}
await visit('src/unknown-lab/app.mjs');for(const p of ['unknown-lab.html','unknown-lab.css','favicon.svg'])await visit(p);
const server=createProductServer();await new Promise((r,j)=>{server.once('error',j);server.listen(0,'127.0.0.1',r);});const origin='http://127.0.0.1:'+server.address().port,resources=[];
try{assert.equal((await fetch(origin+'/health')).status,200);for(const p of [...seen].sort()){const response=await fetch(origin+'/'+p);assert.equal(response.status,200,p);const actual=Buffer.from(await response.arrayBuffer()),expected=await readFile(new URL(p,root));assert.deepEqual(actual,expected,p);resources.push({path:p,bytes:actual.length,sha256:sha(actual)});}assert.equal((await fetch(origin+'/src/unknown-lab/not-declared.css')).status,404);assert.equal((await fetch(origin+'/unknown-lab.html',{method:'POST'})).status,405);await writeFile(new URL('reference-start-smoke.json',root),JSON.stringify({schema:'worldlaw.reference-smoke/v1',baseRevision:'d6d80edf6022493441ef37865078a3ae212a00b5',node:process.version,resources,health:200,unknownCss:404,post:405},null,2));console.log(JSON.stringify({served:resources.length,health:200,unknownCss:404,post:405}));}finally{await new Promise(r=>server.close(r));}
