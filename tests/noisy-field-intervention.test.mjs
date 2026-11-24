import assert from 'node:assert/strict';
import test from 'node:test';
import {laws,layoutFor,command,components,rollout,DT,N,GRID} from '../src/trajectory/field-law-dictionary.mjs';
import {rankObserved,activeDesign,identify} from '../src/trajectory/noisy-field-intervention.mjs';

test('all 22 registered expressions conserve the selected grid or state dimensions',()=>{
  assert.equal(Object.values(laws).flat().length,22);
  for(const [layout,terms] of Object.entries(laws)) for(const id of terms){
    const initial=layout==='periodic'?Array.from({length:GRID},(_,i)=>.6+.1*Math.sin(i*.4)):[.8,.7];
    const path=rollout(id,[.9,1.05],initial,-1);
    assert.equal(path.length,N+1);assert.equal(path[0].length,initial.length);
  }
  for(const id of ['burgers','kdv','modified-kdv','cahn-hilliard']){
    for(const col of components(id,Array.from({length:GRID},(_,i)=>.4+.24*Math.sin(i*.71))))
      assert.ok(Math.abs(col.reduce((x,y)=>x+y,0))<1e-10);
  }
});
test('eight commands have the same physical power within each observation layout',()=>{
  for(const layout of Object.keys(laws)) {
    const energy=Array.from({length:8},(_,id)=>Array.from({length:N},(_,t)=>
      command(layout,id,t*DT).reduce((v,x)=>v+x*x,0)).reduce((a,x)=>a+x,0));
    assert.ok(Math.max(...energy)-Math.min(...energy)<1e-9);
  }
});
test('no labelled derivatives enter fitting or verification',()=>{
  const run={layout:layoutFor('pendulum'),drive:1,sigma:[.005,.005],values:rollout('pendulum',[.93,1.08],[1.23,.83],1)};
  const other={...run,drive:3,values:rollout('pendulum',[.93,1.08],[-.71,.55],3)};
  const ranked=rankObserved([run]);
  assert.equal(ranked[0].law,'pendulum');
  assert.deepEqual(ranked,rankObserved([{...run,derivative:'forbidden decoy',truthId:'wrong'}]));
  assert.equal(activeDesign(run).scores.length,8);
  assert.equal(identify([run],other).admitted,true);
  assert.throws(()=>rankObserved([{...run,values:run.values.slice(2)}]));
});
