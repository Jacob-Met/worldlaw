import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createActiveNotebook,receiveActiveNotebook} from '../src/science/active-experiment-record.mjs';
import {coupledDemoReadings} from '../src/active/instrument.mjs';
import {illustrateModels,witnessProjection,finiteDisplayRange,drawApparatus,drawProjection} from '../src/active/view.mjs';

const source=await readFile(new URL('../examples/active-intervention-coupled-kinematics.json',import.meta.url),'utf8');
const book=await createActiveNotebook(source);

test('illustrative tracks agree with independent hand calculations without fitting an unknown state',()=>{
  const view=illustrateModels(book);
  assert.deepEqual(view.traces.map(row=>row.values),[[3,1,0,-1,-2],[3,-1,-3,-5,-7]]);
  assert.deepEqual(view.traces.map(row=>row.response),[[0,0,1,2,3],[0,0,2,4,6]]);
  const p=witnessProjection(book,-1);
  assert.deepEqual(p.centers,[1,2]);assert.equal(p.radius,.04);assert.equal(p.observed,null);
});

test('missing readings produce no projection and every separate set remains independent',async()=>{
  let received=await receiveActiveNotebook(book,JSON.stringify(coupledDemoReadings(book.plan,'partial')));
  assert.equal(witnessProjection(received,0).observed,null);
  received=await receiveActiveNotebook(received,JSON.stringify(coupledDemoReadings(book.plan,'outside')));
  assert.equal(witnessProjection(received,0).observed,null);
  assert.equal(witnessProjection(received,1).observed,5);
  const host={innerHTML:'',getBoundingClientRect:()=>({width:320})};
  drawApparatus(host,received,2,0);
  assert.match(host.innerHTML,/No reading at tick 2/);
  assert.doesNotMatch(host.innerHTML,/NaN|Infinity/);
});

test('numeric graphics refuse overflow while the exact scientific record stays available',()=>{
  assert.equal(finiteDisplayRange([-1e308,1e308]),null);
  assert.equal(finiteDisplayRange([Infinity]),null);
  assert.equal(finiteDisplayRange([]),null);
  assert.ok(finiteDisplayRange([3,3]).hi>3);
  const before=JSON.stringify(book),host={innerHTML:'',getBoundingClientRect:()=>({width:320})};
  const projection=witnessProjection(book,-1);
  drawProjection(host,{...projection,centers:[1e308,-1e308],radius:1e308,finite:true});
  assert.match(host.innerHTML,/finite display range/);assert.doesNotMatch(host.innerHTML,/<svg|NaN|Infinity/);
  assert.equal(JSON.stringify(book),before);
});

test('bounded input illustrations use the frozen chosen course and label uncertified reference controls',async()=>{
  const text=await readFile(new URL('../examples/active-control-box-coupled-kinematics.json',import.meta.url),'utf8');
  const designed=await createActiveNotebook(text),view=illustrateModels(designed);
  assert.equal(view.bounded,true);assert.equal(view.referenceControls,false);
  assert.deepEqual(view.controls,[['1'],['1'],['1'],['0']]);
  assert.deepEqual(view.traces.map(row=>row.values),[[0,0,1,3,6],[0,0,2,6,12]]);
  const projection=witnessProjection(designed,-1);
  assert.deepEqual(projection.centers,[6,12]);assert.equal(projection.radius,2);
  const request=JSON.parse(text);request.noiseBound='1';
  const refused=await createActiveNotebook(JSON.stringify(request)),reference=illustrateModels(refused);
  assert.equal(reference.referenceControls,true);assert.equal(refused.plan.chosenControls,null);
  assert.deepEqual(reference.traces.map(row=>row.values),[[0,0,-1,-3,-6],[0,0,-2,-6,-12]]);
  assert.equal(witnessProjection(refused,-1),null);
});

test('all joint response views use the same certified interior input and preserve each pair',async()=>{
  const text=await readFile(new URL('../examples/active-joint-control-three-responses.json',import.meta.url),'utf8');
  const joint=await createActiveNotebook(text),view=illustrateModels(joint);
  assert.equal(view.joint,true);assert.equal(view.bounded,true);assert.equal(view.referenceControls,false);
  assert.deepEqual(view.controls,[['1','-1/3'],['0','0']]);
  for(const [i,value] of [0,2/3,4/3].entries())assert.ok(Math.abs(view.traces[i].values[1]-value)<=2*Number.EPSILON);
  assert.deepEqual([0,1,2].map(i=>witnessProjection(joint,-1,i).proof.marginLowerBound),['2/3','4/3','2/3']);
  const request=JSON.parse(text);request.workLimit=100;
  const unfinished=await createActiveNotebook(JSON.stringify(request));
  assert.equal(illustrateModels(unfinished).referenceControls,true);
  assert.equal(unfinished.plan.chosenControls,null);assert.equal(witnessProjection(unfinished,-1),null);
});
