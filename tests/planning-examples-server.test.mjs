import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createProductServer} from '../server.mjs';
test('authored planning example buttons receive exact source JSON without broadening static access',async()=>{
 const server=createProductServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const base=`http://127.0.0.1:${server.address().port}`;
  for(const name of ['period-bands','smooth-drift']){const response=await fetch(`${base}/examples/${name}.json`);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/application\/json/);assert.equal(await response.text(),await readFile(new URL(`../examples/${name}.json`,import.meta.url),'utf8'));const head=await fetch(`${base}/examples/${name}.json`,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');}
  assert.equal((await fetch(base+'/examples/order-construction.json')).status,404);assert.equal((await fetch(base+'/package.json')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
