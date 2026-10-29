import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGeometryTransferStudy,reopenGeometryTransferStudy,saveGeometryTransferStudy} from '../src/geometry-law-transfer/session.mjs';
const raw=JSON.parse(fs.readFileSync(new URL('../recovery/geometry-law-transfer/session-inputs.json',import.meta.url)));
test('source-only geometry transfer ignores forged derived results and target suffix cannot change transferred law or fitted prefix',()=>{
 const first=createGeometryTransferStudy(raw);assert.equal(first.status,'complete');
 const changed=structuredClone(raw),run=changed.receiving.original.original.bundle.challengeRuns[0],cut=run.samples[0].time+changed.receiving.options.prefixDuration;
 for(const row of run.samples)if(row.time>cut)row.position+=.2;
 changed.models=[{terms:[{id:'gravity',coefficient:999}]}];changed.results=[{status:'screened'}];
 const next=reopenGeometryTransferStudy(JSON.stringify(changed));assert.deepEqual(next.models,first.models);
 assert.deepEqual(next.results.map(r=>r.fit.best),first.results.map(r=>r.fit.best));
 assert.notEqual(next.results[0].forecast.results[1].laterRMSE,first.results[0].forecast.results[1].laterRMSE);
 assert.equal(JSON.parse(saveGeometryTransferStudy(next)).models,undefined);
 const denied=structuredClone(raw);denied.declaration.hypothesis='automatic length correction';const refusal=createGeometryTransferStudy(denied);assert.equal(refusal.status,'conditional_transfer_refused');assert.ok(refusal.receiving);assert.ok(refusal.original);
});
