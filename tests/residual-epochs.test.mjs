import test from 'node:test';
import assert from 'node:assert/strict';
import {residualEpochs} from '../src/trajectory/residual-epochs.mjs';
import {physicalResidualStructure as incumbent} from './support/residual-structure-incumbent-221.mjs';
const band=(lowerSeconds,upperSeconds)=>({lowerSeconds,upperSeconds});
const rows=()=>Array.from({length:13},(_,i)=>({time:i,observed:(i%2?1:-1)*i*.1,predicted:0,residual:999}));
test('complete epochs preserve every original row and pair, including cross-boundary pairs',()=>{
  const source=rows(),r=residualEpochs(source,{boundaries:[0,4,8,12],bands:[band(2,2)]});
  assert.deepEqual(r.epochs.map(e=>e.rowIndices),[[1,2,3,4],[5,6,7,8],[9,10,11,12]]);
  assert.equal(r.sourceCount,12);assert.equal(r.accountedSourceCount,12);assert.equal(r.pairPartitions[0].crossEpoch.count,4);
  const p=r.pairPartitions[0],indices=[...p.withinEpochs.flatMap(e=>e.pairIndices),...p.crossEpoch.pairs.map(x=>x.pairIndex)];
  assert.equal(indices.length,p.pairCount);assert.equal(new Set(indices).size,p.pairCount);assert.equal(p.accountedPairCount,p.pairCount);
  assert.equal(r.source[1].residual,source[1].observed-source[1].predicted);
});
test('epoch magnitudes reconstruct full error without excluding each new boundary row',()=>{
  const r=residualEpochs(rows(),{boundaries:[0,4,8,12],bands:[band(1,2)]});
  const reconstructed=Math.hypot(...r.epochs.map(e=>e.rmse*Math.sqrt(e.count)))/Math.sqrt(r.sourceCount);
  assert.ok(Math.abs(reconstructed-r.physical.rmse)<1e-15);
  assert.ok(Math.abs(r.epochs.reduce((sum,e)=>sum+e.squaredErrorFraction,0)-1)<1e-15);
  assert.equal(r.epochs[1].rowIndices[0],5);assert.equal(r.epochs[1].count,4);
});
test('global receiver and its physical pair evidence remain exactly equal to incumbent',()=>{
  const source=rows(),bands=[band(1,2),band(3,5)],a=residualEpochs(source,{boundaries:[0,4,8,12],bands});
  assert.deepEqual(a.physical,incumbent(source,{bands}));
  const b=residualEpochs(source,{boundaries:[0,3,6,12],bands});assert.deepEqual(a.physical,b.physical);
  assert.deepEqual(a.source,b.source);
});
test('empty epochs, one-pair groups and zero total error remain explicit',()=>{
  const source=[0,1,4,8].map(time=>({time,observed:0,predicted:0}));
  const r=residualEpochs(source,{boundaries:[0,1,2,8],bands:[band(3,3)]});
  assert.equal(r.epochs[1].status,'no_receiving_rows');assert.equal(r.epochs[1].rmse,null);
  assert.ok(r.epochs.every(e=>e.squaredErrorFraction===null));assert.equal(r.pairPartitions[0].crossEpoch.status,'single_pair');
  assert.equal(r.pairPartitions[0].crossEpoch.correlation,null);
});
test('source coordinates and pair membership remain unchanged under amplitude edits',()=>{
  const source=rows(),before=JSON.stringify(source),a=residualEpochs(source,{boundaries:[0,4,8,12],bands:[band(1,2)]});
  assert.equal(JSON.stringify(source),before);source[6].observed+=.5;
  const b=residualEpochs(source,{boundaries:[0,4,8,12],bands:[band(1,2)]});
  assert.deepEqual(a.epochs.map(e=>e.rowIndices),b.epochs.map(e=>e.rowIndices));
  assert.deepEqual(a.pairPartitions.map(p=>p.crossEpoch.pairs),b.pairPartitions.map(p=>p.crossEpoch.pairs));
  assert.notEqual(a.epochs[1].rmse,b.epochs[1].rmse);assert.equal(a.source[6].observed,JSON.parse(before)[6].observed);
});
test('incomplete, unordered, excessive or invalid declarations refuse without partial attribution',()=>{
  for(const boundaries of [[0,4,11],[1,4,12],[0,4,4,12],[0,NaN,12],[],Array(4),Array.from({length:34},(_,i)=>12*i/33)])assert.throws(()=>residualEpochs(rows(),{boundaries,bands:[band(1,2)]}));
  assert.throws(()=>residualEpochs(rows(),{boundaries:[0,6,12],bands:[band(1,12)],maxPairs:1}),/entire/);
});
test('tiny errors preserve nonzero epoch magnitude and exact original clock attribution',()=>{
  const source=rows().map((r,i)=>({...r,time:1e12+i*.125,observed:(i%2?1:-1)*1e-300}));
  const r=residualEpochs(source,{boundaries:[1e12,1e12+.5,1e12+1.5],bands:[band(.125,.125)]});
  assert.deepEqual(r.epochs.map(e=>e.count),[4,8]);assert.ok(r.epochs.every(e=>e.rmse>0));assert.equal(r.source[1].time,1e12+.125);
});
