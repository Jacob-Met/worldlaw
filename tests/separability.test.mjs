import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectSeparability} from '../src/science/separability.mjs';
import {discover, predict, TERMS} from '../src/science/torque-discovery.mjs';
import {createSession, exportSession, restoreSession} from '../src/session.mjs';

const declaration={axes:['command','position'],fixedValue:0,torqueRadius:.01,exactCoordinates:true};
function course(interaction=1) {
  const rows=[];
  for(const command of [-1,0,1])for(const position of [-1,0,1])
    rows.push({command,position,rate:0,jointTorque:2*command-3*position+interaction*command*position});
  return rows;
}

test('source rectangles expose the omitted interaction behind the maintained residual mismatch',()=>{
  const rows=course(),original=structuredClone(rows),fit=discover(rows);
  assert.equal(fit.selected.id,'command+spring');
  assert.equal(fit.selected.metrics.rmse,2/3);
  const screen=inspectSeparability(rows,declaration);
  assert.equal(screen.rectangles.length,9);assert.equal(screen.excludedCount,9);
  const expected=[1,2,1,2,4,2,1,2,1];
  screen.rectangles.forEach((r,i)=>{
    assert.ok(r.contrastInterval[0]<=expected[i]-.04);
    assert.ok(r.contrastInterval[1]>=expected[i]+.04);
    const states=r.corners.map(id=>screen.states[id]);
    const corners=states.map(s=>rows[s.rowIndices[0]]);
    assert.equal(corners[0].jointTorque-corners[1].jointTorque-corners[2].jointTorque+corners[3].jointTorque,expected[i]);
  });
  assert.deepEqual(rows,original);
  assert.equal(inspectSeparability(course(0),declaration).excludedCount,0);
});

test('arbitrary separate functions cancel, and axis reversal preserves conclusions',()=>{
  const rows=[];
  for(const command of [-2,0,3])for(const position of [-1,0,2])for(const rate of [-1,0,1])
    rows.push({command,position,rate,jointTorque:Math.exp(command)+Math.sin(position)+rate**3});
  for(const axes of [['command','position'],['position','command'],['rate','command'],['position','rate']]){
    const got=inspectSeparability(rows,{...declaration,axes});
    assert.equal(got.rectangles.length,9);assert.equal(got.excludedCount,0);
  }
  // Guard the actual consumer claim about the maintained optional/default library.
  for(const term of TERMS) {
    const model={schema:'worldlaw.torque-model/v1',terms:[{id:term.id,coefficient:1}]};
    const source=rows.map(row=>({...row,jointTorque:predict(model,row)}));
    for(const axes of [['command','position'],['command','rate'],['position','rate']])
      assert.equal(inspectSeparability(source,{...declaration,axes,torqueRadius:0}).excludedCount,0,term.id);
  }
});

test('absolute reading bounds retain touching zero and enlarge monotonically',()=>{
  const rows=[{command:0,position:0,rate:0,jointTorque:1},
    {command:1,position:0,rate:0,jointTorque:0},
    {command:0,position:1,rate:0,jointTorque:0},
    {command:1,position:1,rate:0,jointTorque:0}];
  assert.equal(inspectSeparability(rows,{...declaration,torqueRadius:.25}).excludedCount,0);
  assert.equal(inspectSeparability(rows,{...declaration,torqueRadius:.24}).excludedCount,1);
  let previous=null;
  for(const radius of [0,.01,.1,.25,1]){
    const interval=inspectSeparability(rows,{...declaration,torqueRadius:radius}).rectangles[0].contrastInterval;
    if(previous){assert.ok(interval[0]<=previous[0]);assert.ok(interval[1]>=previous[1]);}previous=interval;
  }
});

test('repeated rows remain source-linked, and contradictory replicates are not an interaction claim',()=>{
  const rows=course(0); rows.push({...rows[0],jointTorque:rows[0].jointTorque+.01});
  const first=inspectSeparability(rows,declaration);
  assert.equal(first.states[0].rowIndices.length,2);assert.equal(first.replicateConflictCount,0);
  rows.push({...rows[0],jointTorque:rows[0].jointTorque+1});
  const got=inspectSeparability(rows,declaration);
  assert.equal(got.replicateConflictCount,1);assert.equal(got.excludedCount,0);
  assert.ok(got.rectangles.some(r=>r.status==='incompatible-replicates'&&r.contrastInterval===null));
  assert.equal(got.states[0].rowIndices.length,3);
});

test('no interpolation, rounding, hidden third coordinate matching or incomplete-corner success',()=>{
  const rows=course(0).filter(r=>r.command!==0&&r.position!==0);
  rows[3].rate=Number.MIN_VALUE;
  const got=inspectSeparability(rows,declaration);
  assert.equal(got.sliceRowCount,3);assert.equal(got.status,'no-complete-rectangles');
  assert.equal(inspectSeparability(rows,{...declaration,fixedValue:9}).sliceRowCount,0);
  assert.equal(inspectSeparability([],declaration).status,'no-complete-rectangles');
});

test('complete enumeration and row-order symmetry against independent Cartesian oracle',()=>{
  // Integer eighths make oracle extrema exactly representable; no production
  // interval arithmetic or grouping is reused in this complete grid oracle.
  let seed=107;const next=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;};
  for(let sample=0;sample<50;sample++){
    const rows=[];
    for(let x=0;x<4;x++)for(let y=0;y<3;y++)rows.push({command:x,position:y,rate:0,jointTorque:(next()%65-32)/8});
    const radius=(next()%5)/8;
    const got=inspectSeparability(rows,{...declaration,torqueRadius:radius});
    let excluded=0,index=0;
    for(let x0=0;x0<4;x0++)for(let x1=x0+1;x1<4;x1++)for(let y0=0;y0<3;y0++)for(let y1=y0+1;y1<3;y1++){
      const contrast=rows[x0*3+y0].jointTorque-rows[x1*3+y0].jointTorque-rows[x0*3+y1].jointTorque+rows[x1*3+y1].jointTorque;
      const r=got.rectangles[index++];
      assert.ok(r.contrastInterval[0]<=contrast-4*radius);assert.ok(r.contrastInterval[1]>=contrast+4*radius);
      if(Math.abs(contrast)>4*radius)excluded++;
    }
    assert.equal(got.rectangles.length,index);assert.equal(got.excludedCount,excluded);
    assert.equal(inspectSeparability([...rows].reverse(),{...declaration,torqueRadius:radius}).excludedCount,excluded);
  }
});

test('invalid declarations and full-work exhaustion refuse without mutating inputs',()=>{
  const rows=course(),original=structuredClone(rows);
  for(const change of [{axes:['rate','rate']},{axes:['time','rate']},{exactCoordinates:false},
    {fixedValue:NaN},{torqueRadius:-1},{torqueRadius:Infinity},{maxWork:1},{maxRectangles:1},{maxWork:200001}])
    assert.throws(()=>inspectSeparability(rows,{...declaration,...change}),RangeError);
  assert.throws(()=>inspectSeparability([{...rows[0],jointTorque:NaN}],declaration));
  assert.deepEqual(rows,original);
});

test('actual retained notebook replay preserves source rows and recomputes the same screen',()=>{
  const state=createSession({source:{label:'Authored interaction control',kind:'synthetic'},observations:course(),heldOut:[]});
  const saved=exportSession(state),reopened=restoreSession(saved);
  const first=inspectSeparability(state.discovery.observations,declaration);
  assert.deepEqual(inspectSeparability(reopened.discovery.observations,declaration),first);
  assert.equal(exportSession(state),saved);assert.equal(reopened.base.source.declaredKind,'synthetic');
});
