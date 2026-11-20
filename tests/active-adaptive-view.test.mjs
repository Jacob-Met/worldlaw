import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createActiveNotebook,receiveActiveNotebook,replayActiveNotebook,adaptiveNotebookState}
  from '../src/science/active-experiment-record.mjs';
import {ADAPTIVE_DEMO_SOURCE_SHA256,adaptiveTrackReadings} from '../src/active/adaptive-instrument.mjs';
import {displayActiveNotebook,illustrateModels,witnessProjection} from '../src/active/view.mjs';

const source=readFileSync(new URL('../examples/active-adaptive-coupled-track.json',import.meta.url),'utf8');
const receive=book=>receiveActiveNotebook(book,JSON.stringify(adaptiveTrackReadings(book)));

test('separate closed-form apparatus follows two frozen actions with fresh nuisance states',async()=>{
  let book=await createActiveNotebook(source);
  assert.equal(book.plan.sourceSHA256,ADAPTIVE_DEMO_SOURCE_SHA256);
  assert.equal(book.plan.worstReadings,6);assert.equal(book.plan.staticPlan.readings,9);
  const first=adaptiveTrackReadings(book);
  assert.deepEqual(first.readings,[{tick:0,value:'4'},{tick:1,value:'41/20'},{tick:2,value:'57/50'}]);
  assert.equal(first.experimentId,'main_impulse');
  book=await receive(book);
  assert.deepEqual(book.readouts[0].result.consistentHypothesisIds,['main_coupling','cross_coupling']);
  const second=adaptiveTrackReadings(book);
  assert.equal(second.experimentId,'cross_impulse');
  assert.equal(second.previousReadingsSHA256,book.readouts[0].result.readingsSHA256);
  assert.deepEqual(second.readings,[{tick:0,value:'429/100'},{tick:1,value:'251/100'},{tick:2,value:'177/100'}]);
  book=await receive(book);
  assert.deepEqual(book.readouts[1].result.consistentHypothesisIds,['cross_coupling']);
  assert.equal(adaptiveNotebookState(book).spentReadings,6);
  assert.equal(adaptiveNotebookState(book).action,null);
  assert.throws(()=>adaptiveTrackReadings(book),/no pending/);
  assert.deepEqual(await replayActiveNotebook(book),book);
});

test('pending forecasts never borrow historical readings and law colors survive elimination',async()=>{
  const initial=await createActiveNotebook(source),book=await receive(initial),original=JSON.stringify(book);
  const old=displayActiveNotebook(book,0),pending=displayActiveNotebook(book,-1);
  assert.equal(old.display.experiment.id,'main_impulse');assert.equal(old.readouts.length,1);
  assert.equal(pending.display.experiment.id,'cross_impulse');assert.equal(pending.readouts.length,0);
  assert.deepEqual(old.plan.selection.map(row=>row.tick),[0,1,2]);
  assert.deepEqual(pending.display.excludedHypothesisIds,['uncoupled','side_coupling']);
  const originalColors=new Map(illustrateModels(initial).traces.map(row=>[row.id,row.color]));
  for(const row of illustrateModels(book).traces)assert.equal(row.color,originalColors.get(row.id));
  assert.equal(witnessProjection(book,-1,0).observed,null);
  const pair=old.plan.proof.findIndex(row=>row.witness),projection=witnessProjection(book,0,pair);
  assert.notEqual(projection.observed,null);assert.equal(projection.proof.marginLowerBound,'1/4');
  assert.equal(JSON.stringify(book),original,'display adapters changed the portable original');
});

test('unresolved geometry remains displayable without inventing a witness',async()=>{
  const request=JSON.parse(source);request.workLimit=100;
  const book=await createActiveNotebook(JSON.stringify(request));
  assert.equal(book.plan.status,'search_inconclusive');
  assert.equal(adaptiveNotebookState(book).action,null);
  assert.equal(displayActiveNotebook(book).display.experiment.id,'main_impulse');
  assert.equal(illustrateModels(book).traces.length,4);
  assert.throws(()=>adaptiveTrackReadings(book),/bound to its original/);
});
