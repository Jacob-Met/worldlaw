import test from 'node:test';
import assert from 'node:assert/strict';
import {createHistoryAcquisition,validateHistoryAcquisition,exportHistoryAcquisition,importHistoryAcquisition,completeHistoryAcquisition} from '../src/unknown-lab/history-acquisition.mjs';
import {evaluateHistory} from '../src/unknown-lab/paired-history.mjs';
const copy=x=>JSON.parse(JSON.stringify(x));
const settings={id:'independent-receiver',count:8,seed:71,noiseSigma:.01,command:.2,position:.3,rate:-.1,preparation:'Independently supplied AB/BA readings',sourceNote:'Authored analytic control, not physical observations'};
const make=()=>createHistoryAcquisition(settings);
function filled(effect=.6){
 const draft=copy(make());draft.orderConfirmed=true;
 for(const r of draft.readings)Object.assign(r,{command:settings.command,position:settings.position,rate:settings.rate,jointTorque:10+.25*r.sampleIndex+(r.history==='conditioned'?effect:0)});
 return draft;
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} differs from analytic ${b}`);

test('prospective request contains no observations, preserves missing versus real zero',()=>{
 const plan=make();assert.equal(plan.orderConfirmed,false);assert.equal(plan.readings.length,16);
 for(const row of plan.readings)for(const field of ['command','position','rate','jointTorque'])assert.equal(row[field],null);
 assert.throws(()=>completeHistoryAcquisition(plan));
 const partial=copy(plan);partial.readings[0].jointTorque=0;
 const reopened=importHistoryAcquisition(exportHistoryAcquisition(partial));
 assert.equal(reopened.readings[0].jointTorque,0);assert.equal(reopened.readings[1].jointTorque,null);
 assert.throws(()=>completeHistoryAcquisition(reopened));
 const empty=copy(partial);empty.readings[0].jointTorque='';assert.throws(()=>validateHistoryAcquisition(empty));
});

test('separately authored torque recovers known history and linear drift with chronology independent of row order',()=>{
 const draft=filled();const before=copy(draft);const notebook=completeHistoryAcquisition(draft);
 assert.deepEqual(draft,before);assert.equal(notebook.source,'measured');assert.equal(notebook.simulation,undefined);
 const report=evaluateHistory(notebook);assert.equal(report.order.status,'counterbalanced');
 assert.equal(report.order.referenceFirst,4);assert.equal(report.order.conditionedFirst,4);
 close(report.order.historyEstimate,.6);close(report.order.driftPerStep,.25);assert.equal(report.verdict,'challenged');
 draft.readings.reverse();const permuted=evaluateHistory(completeHistoryAcquisition(draft));
 close(permuted.order.historyEstimate,.6);close(permuted.order.driftPerStep,.25);
});

test('linear drift alone does not fabricate a history finding',()=>{
 const report=evaluateHistory(completeHistoryAcquisition(filled(0)));
 close(report.order.historyEstimate,0);close(report.order.driftPerStep,.25);assert.equal(report.verdict,'inconclusive');
});

test('completion refuses missing, forged chronology, unconfirmed order and off-target matched readings',()=>{
 for(const mutate of [
  x=>{x.readings.pop();},
  x=>{x.readings[0].jointTorque=null;},
  x=>{x.readings[0].sampleIndex=x.readings[1].sampleIndex;},
  x=>{x.readings[0].pairId='unplanned-pair';},
  x=>{x.readings[0].history=x.readings[0].history==='reference'?'conditioned':'reference';},
  x=>{x.orderConfirmed=false;},
  x=>{for(const r of x.readings)r.position+=.01;},
  x=>{x.readings[0].jointTorque=Infinity;}
 ]){const draft=filled();mutate(draft);assert.throws(()=>completeHistoryAcquisition(draft));}
});

test('partial portable draft owns a copy of declarations and refuses derived or virtual answers',()=>{
 const input={...settings};const plan=createHistoryAcquisition(input);input.preparation='mutated caller declaration';
 assert.equal(plan.request.preparation,settings.preparation);
 const draft=copy(plan);draft.readings[3].jointTorque=-2;
 const frozen=copy(draft);const restored=importHistoryAcquisition(exportHistoryAcquisition(draft));
 assert.deepEqual(restored,frozen);assert.deepEqual(draft,frozen);
 for(const field of ['simulation','verdict','result']){const injected=copy(draft);injected[field]={verdict:'challenged'};assert.throws(()=>validateHistoryAcquisition(injected));}
 const nested=copy(draft);nested.readings[0].predictedTorque=17;assert.throws(()=>validateHistoryAcquisition(nested));
});

test('individually on-target states still require pairwise matching',()=>{
 const draft=filled(),first=draft.readings[0],partner=draft.readings.find(r=>r.pairId===first.pairId&&r.history!==first.history);
 first.position=settings.position-.0009;partner.position=settings.position+.0009;
 assert.ok(Math.abs(first.position-settings.position)<.001);assert.ok(Math.abs(partner.position-settings.position)<.001);
 assert.throws(()=>completeHistoryAcquisition(draft));
});
