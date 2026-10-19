import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createChallengeServer} from './trajectory-server-92be.mjs';
import {createChallenge,exportChallenge,restoreChallenge} from '../src/trajectory/session.mjs';
const server=createChallengeServer();
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const origin=`http://127.0.0.1:${server.address().port}`;
try{
  const page=await fetch(origin+'/trajectory.html');assert.equal(page.status,200);
  assert.match(await page.text(),/trajectory\/app\.mjs/);
  for(const path of ['/trajectory.css','/src/trajectory/app.mjs','/src/trajectory/integral-discovery.mjs','/src/trajectory/forward.mjs','/src/trajectory/resolution.mjs','/src/trajectory/horizon.mjs','/index.html']){
    const response=await fetch(origin+path);assert.equal(response.status,200,path);assert.ok((await response.text()).length>0,path);
  }
  const response=await fetch(origin+'/examples/trajectory-pendulum-92be.json');assert.equal(response.status,200);
  const text=await response.text(),bundle=JSON.parse(text),state=createChallenge(bundle),reopened=restoreChallenge(exportChallenge(state));
  assert.equal(state.summary.failedRollouts,0);assert.equal(state.discovery.selected.id,'command+rate+gravity+bias');
  assert.equal(reopened.summary.selectedPositionRMSE,state.summary.selectedPositionRMSE);
  assert.equal(state.results[0].resolution.status,'compared');
  const bad=structuredClone(bundle);bad.challengeRuns[0].initialRate=null;
  assert.throws(()=>createChallenge(bad),/initialRate/);
  const missing=await fetch(origin+'/not-a-product-file');assert.equal(missing.status,404);
  const wrongMethod=await fetch(origin+'/trajectory.html',{method:'POST'});assert.equal(wrongMethod.status,405);
  console.log(JSON.stringify({product:'worldlaw',route:'trajectory-challenge',runtime:process.version,inputSHA256:createHash('sha256').update(text).digest('hex'),
    received:'launched local HTTP server -> actual JSON input -> fitting -> forward predictions -> source notebook reopen',selectedModel:state.discovery.selected.id,
    selectedPositionRMSE:state.summary.selectedPositionRMSE,comparedModels:state.summary.comparedModelCount,challengeRuns:state.summary.challengeRunCount,
    negativeCases:['missing initial rate refused','missing resource404','unsupported method405'],evidenceKind:'synthetic'},null,2));
}finally{await new Promise(resolve=>server.close(resolve));}
