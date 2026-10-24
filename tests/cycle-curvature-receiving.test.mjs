import test from 'node:test';
import assert from 'node:assert/strict';
import {reopenRefinement} from '../src/cycle-work/refinement.mjs';
import {refinementExample,receiveAuthoredRefinement} from '../src/cycle-work/refinement-example.mjs';
const received=kind=>receiveAuthoredRefinement(refinementExample(kind),kind);
test('false curvature withholds continuous interpretation while preserving both polygons',()=>{
 const r=reopenRefinement(received('false-curvature'));
 assert.equal(r.curvatureAudit.status,'contradicted');
 assert.equal(r.continuousPath,null);assert.equal(r.coarse,null);assert.equal(r.refined,null);
 assert.ok(r.polygon.original);assert.ok(r.polygon.refined);assert.equal(r.pending,0);
});
test('declared rounding boxes retain the compatible authored controls',()=>{
 for(const kind of ['branch','conservative']){
  const r=reopenRefinement(received(kind));
  assert.notEqual(r.curvatureAudit.status,'contradicted');assert.ok(r.continuousPath);
  assert.ok(r.refined);assert.equal(r.pending,0);
 }
});
test('wide supplied reading boxes remove the necessary contradiction only',()=>{
 const raw=received('false-curvature');
 raw.acquisition.readings.forEach(r=>r.torqueRadius=1);
 const r=reopenRefinement(raw);
 assert.notEqual(r.curvatureAudit.status,'contradicted');
 assert.equal(r.conditionalStatus,'conditional-on-unvalidated-assumptions');
});
test('partial and empty receiving preserves pending and branch custody',()=>{
 const raw=received('false-curvature'),total=raw.acquisition.readings.length;
 raw.acquisition.readings=raw.acquisition.readings.slice(0,1);
 const r=reopenRefinement(raw);
 assert.equal(r.pending,total-1);assert.equal(r.polygon.refined,null);
 assert.ok(r.polygon.original);assert.equal(r.curvatureAudit.segments[2].status,'zero-angle-jump');
 for(const w of r.curvatureAudit.witnesses)assert.equal(w.segment,raw.acquisition.readings[0].segment);
 raw.acquisition.readings=[];const empty=reopenRefinement(raw);
 assert.equal(empty.pending,total);assert.equal(empty.curvatureAudit.status,'insufficient-readings');
});
test('input-only replay ignores fabricated results and rejects stale acquisitions',()=>{
 const raw=received('false-curvature'),expected=reopenRefinement(raw);
 const replay=reopenRefinement({...JSON.parse(JSON.stringify(expected.bundle)),curvatureAudit:{status:'safe'},continuousPath:{safe:true}});
 assert.equal(replay.continuousPath,null);assert.deepEqual(replay.polygon,expected.polygon);
 raw.acquisition.request={...raw.acquisition.request,budget:0};
 assert.throws(()=>reopenRefinement(raw),/stale or modified/);
});
