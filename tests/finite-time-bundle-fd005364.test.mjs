import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const executable='scripts/inspect-finite-time-bundle.mjs';
const source='examples/physical-pasco-92be.json';
test('original measured PASCO bundle flows through retained training fit and finite-time source receiving',()=>{
 const raw=execFileSync(process.execPath,[executable,source,'--method','weak'],{encoding:'utf8',maxBuffer:3*1024*1024});
 const result=JSON.parse(raw);
 assert.equal(result.schema,'worldlaw.finite-time-bundle-receipt/v1');
 assert.equal(result.originalBundleSha256,createHash('sha256').update(readFileSync(source)).digest('hex'));
 assert.equal(result.modelSelection.method,'weak');
 assert.equal(result.modelSelection.trainingOnly,true);
 assert.equal(result.target.kind,'measured');
 assert.equal(result.transition.rows.length,2001);
 assert.deepEqual(result.transition.rows[0].transition,[[1,0],[0,1]]);
 assert.ok(result.transition.combinedReservedSteps<400000);
 assert.match(result.limitations.join(' '),/not independently authenticated/);
});
test('missing original challenge cannot be silently replaced with another recording',()=>{
 const p=spawnSync(process.execPath,[executable,source,'--challenge-id','not-an-original'],{encoding:'utf8'});
 assert.notEqual(p.status,0);assert.equal(p.stdout,'');assert.match(p.stderr,/absent/);
});
test('unsupported fitting method fails with no receipt',()=>{
 const p=spawnSync(process.execPath,[executable,source,'--method','speculate'],{encoding:'utf8'});
 assert.notEqual(p.status,0);assert.equal(p.stdout,'');assert.match(p.stderr,/weak or integral/);
});

