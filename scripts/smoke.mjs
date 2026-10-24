import assert from 'node:assert/strict';
import {createProductServer} from '../server.mjs';
import {newVirtualSession,sessionPlan,runVirtualExperiment,exportSession,restoreSession} from '../src/session.mjs';
const server=createProductServer();
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
try{
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const path of ['/','/styles.css','/src/app.mjs','/src/session.mjs','/src/science/torque-discovery.mjs','/src/science/virtual-lab.mjs','/unknown-lab.html','/unknown-lab.css',
    '/src/unknown-lab/app.mjs','/src/unknown-lab/paired-history.mjs',
    '/motion.html','/motion.css','/src/motion/app.mjs','/trajectory.html','/trajectory.css',
    '/src/trajectory/app.mjs','/src/trajectory/angular-discovery.mjs','/src/trajectory/angular-weak.mjs',
    '/examples/trajectory-pendulum-92be.json','/examples/trajectory-ambiguous-92be.json','/examples/physical-pasco-92be.json']){
    const response=await fetch(base+path);assert.equal(response.status,200,path);assert.ok((await response.text()).length>10,path);
  }
  assert.equal((await(await fetch(base+'/health')).json()).product,'worldlaw');
  assert.equal((await fetch(base+'/README.md')).status,404);
  assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
  const initial=newVirtualSession();const next=runVirtualExperiment(initial,sessionPlan(initial).selected.input);
  assert.ok(next.history.at(-1).heldOutRMSE<initial.history[0].heldOutRMSE/100);
  assert.deepEqual(restoreSession(exportSession(next)).history,next.history);
  console.log('PASS launched product assets and refusal paths; actual discovery → virtual measurement → revision → notebook reopen.');
}finally{await new Promise(resolve=>server.close(resolve));}
