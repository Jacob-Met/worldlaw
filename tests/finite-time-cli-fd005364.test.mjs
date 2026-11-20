import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const cli='scripts/inspect-finite-time.mjs';
const model='examples/finite-time/authored-model.json',run='examples/finite-time/authored-course.json';
test('real CLI consumes original authored model/run and returns source-pinned finite-time matrix',()=>{
 const raw=execFileSync(process.execPath,[cli,model,run],{encoding:'utf8',maxBuffer:1e6});
 const study=JSON.parse(raw);
 assert.equal(study.schema,'worldlaw.finite-time-transition/v1');
 assert.equal(study.rows.length,6);
 assert.deepEqual(study.rows[0].transition,[[1,0],[0,1]]);
 const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
 assert.equal(study.inputs.modelSha256,sha(model));
 assert.equal(study.inputs.runSha256,sha(run));
 assert.equal(study.steps*2,study.combinedReservedSteps);
 assert.ok(study.rows.at(-1).transition[0][0]<1);
});
test('CLI refuses insufficient combined work budget without a partial result',()=>{
 const p=spawnSync(process.execPath,[cli,model,run,'--max-total-steps','2'],{encoding:'utf8'});
 assert.notEqual(p.status,0); assert.equal(p.stdout,''); assert.match(p.stderr,/budget/i);
});
test('CLI refuses unknown flags and does not mutate inputs',()=>{
 const modelBefore=readFileSync(model),runBefore=readFileSync(run);
 const p=spawnSync(process.execPath,[cli,model,run,'--unknown','42'],{encoding:'utf8'});
 assert.notEqual(p.status,0);assert.equal(p.stdout,'');
 assert.deepEqual(readFileSync(model),modelBefore);assert.deepEqual(readFileSync(run),runBefore);
});

