import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, symlink, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {request} from 'node:http';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {createProductServer} from '../server.mjs';
import {createChallengeServer} from '../scripts/trajectory-server-92be.mjs';

const sourceRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const get = (port, path, method = 'GET', headers = {}) => new Promise((yes, no) => {
  const req = request({hostname:'127.0.0.1',port,path,method,headers}, res => {
    const chunks=[]; res.on('data',c=>chunks.push(c));
    res.on('end',()=>yes({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));
    res.on('error',no);
  }); req.on('error',no); req.end();
});
async function withServer(create,run) {
  const server=create();
  await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok);});
  try {await run(server.address().port);} finally {await new Promise(ok=>server.close(ok));}
}
test('local HTTP refuses foreign hosts and symbolic links while serving ordinary assets', async t=>{
  const scratch=await mkdtemp(join(tmpdir(),'worldlaw-http-admission-'));
  const file=join(sourceRoot,'src','__http_admission_outside__.mjs');
  const dir=join(sourceRoot,'src','__http_admission_dir__');
  const special=join(sourceRoot,'src','__http_admission_nonregular__.mjs');
  await mkdir(join(scratch,'remote-modules'));
  await writeFile(join(scratch,'private.mjs'),'SYNTHETIC_PRIVATE_SENTINEL_20261027');
  await writeFile(join(scratch,'remote-modules','private.mjs'),'SYNTHETIC_DIR_SENTINEL_20261027');
  await symlink(join(scratch,'private.mjs'),file);
  await symlink(join(scratch,'remote-modules'),dir,'dir');
  await mkdir(special);
  t.after(async()=>{await Promise.all([rm(file,{force:true}),rm(dir,{force:true}),rm(special,{recursive:true,force:true}),rm(scratch,{recursive:true,force:true})]);});
  for(const [label,create] of [['studio',createProductServer],['trajectory preview',createChallengeServer]]){
    await t.test(label,async t2=>{
      await withServer(create,async port=>{
        const host='127.0.0.1:'+port;
        const expected=await readFile(join(sourceRoot,'src','session.mjs'));
        const asset=await get(port,'/src/session.mjs');
        assert.equal(asset.status,200);assert.deepEqual(asset.body,expected);
        const head=await get(port,'/src/session.mjs','HEAD');
        assert.equal(head.status,200);assert.equal(Number(head.headers['content-length']),expected.length);assert.equal(head.body.length,0);
        assert.equal((await get(port,'/health')).status,200);
        assert.equal((await get(port,'/health','GET',{Host:host,Origin:'http://'+host})).status,200);
        assert.equal((await get(port,'/health','GET',{Host:'localhost:'+port,Origin:'http://localhost:'+port})).status,200);
        assert.equal((await get(port,'/health','GET',{Host:'localhost:'+port})).status,200);
        assert.equal((await get(port,'/health','HEAD')).body.length,0);
        await t2.test('foreign Host refuses health',async()=>{assert.equal((await get(port,'/health','GET',{Host:'rebind.example:'+port})).status,403);});
        await t2.test('foreign Origin refuses health',async()=>{assert.equal((await get(port,'/health','GET',{Host:host,Origin:'http://rebind.example:'+port})).status,403);});
        await t2.test('unexpected authority credentials or port refuse',async()=>{
          assert.equal((await get(port,'/health','GET',{Host:'attacker@localhost:'+port})).status,403);
          assert.equal((await get(port,'/health','GET',{Host:'127.0.0.1:'+ (port+1)})).status,403);
        });
        await t2.test('cross-scheme Origin refuses health',async()=>{
          assert.equal((await get(port,'/health','GET',{Host:host,Origin:'https://'+host})).status,403);
        });
        await t2.test('null Origin refuses assets',async()=>{assert.equal((await get(port,'/','GET',{Host:host,Origin:'null'})).status,403);});
        await t2.test('linked file refuses outside bytes',async()=>{
          const r=await get(port,'/src/__http_admission_outside__.mjs');assert.equal(r.status,404);assert.doesNotMatch(r.body.toString(),/SYNTHETIC_PRIVATE_SENTINEL/);
        });
        await t2.test('linked directory refuses outside bytes',async()=>{
          const r=await get(port,'/src/__http_admission_dir__/private.mjs');assert.equal(r.status,404);assert.doesNotMatch(r.body.toString(),/SYNTHETIC_DIR_SENTINEL/);
        });
        await t2.test('nonregular file refuses',async()=>{assert.equal((await get(port,'/src/__http_admission_nonregular__.mjs')).status,404);});
        await t2.test('internal package file refuses',async()=>{assert.equal((await get(port,'/package.json')).status,404);});
        await t2.test('unsupported method refuses',async()=>{assert.equal((await get(port,'/health','POST')).status,405);});
        if (label === 'trajectory preview') {
          const defaultPage = await get(port, '/');
          assert.equal(defaultPage.status,200);
          assert.deepEqual(defaultPage.body,await readFile(join(sourceRoot,'trajectory.html')));
        }
        const page=await get(port,'/trajectory.html');
        assert.equal(page.status,200);assert.deepEqual(page.body,await readFile(join(sourceRoot,'trajectory.html')));
      });
    });
  }
});
