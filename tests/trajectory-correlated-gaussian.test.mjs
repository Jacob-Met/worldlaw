import test from 'node:test';
import assert from 'node:assert/strict';
import {designCorrelatedReadings,correlatedEnergy} from '../src/trajectory/correlated-gaussian-discriminator.mjs';
import {designGaussianReadings} from '../src/trajectory/gaussian-discriminator.mjs';

const predictions = rows => rows.map((values,i)=>({modelId:`law-${i}`,rows:[0,...values].map((position,time)=>({time,position}))}));
// Independent dense Gauss-Jordan inverse oracle, not the innovation formula.
function denseEnergy(d,t,indices,tau){
  const a=indices.map((i)=>[...indices.map(j=>Math.exp(-Math.abs(t[i]-t[j])/tau)),d[i]]);
  for(let col=0;col<a.length;col++){
    let pivot=col;for(let r=col+1;r<a.length;r++)if(Math.abs(a[r][col])>Math.abs(a[pivot][col]))pivot=r;
    [a[col],a[pivot]]=[a[pivot],a[col]];
    const scale=a[col][col];assert.ok(Math.abs(scale)>1e-12);
    for(let k=col;k<=a.length;k++)a[col][k]/=scale;
    for(let r=0;r<a.length;r++)if(r!==col){const f=a[r][col];for(let k=col;k<=a.length;k++)a[r][k]-=f*a[col][k];}
  }
  return indices.reduce((sum,i,r)=>sum+d[i]*a[r][a.length],0);
}

test('known correlated duplicates cannot borrow independent reading power',()=>{
  const p=predictions([[0,0],[1,1]]), o={sigma:1,targetZ:1.2,maxReadings:2};
  assert.equal(designGaussianReadings(p,o).status,'distinguishable');
  const actual=designCorrelatedReadings(p,{...o,correlationTime:-1/Math.log(.99)});
  assert.equal(actual.status,'threshold_unreachable_on_grid');
  assert.ok(Math.abs(correlatedEnergy([1,1],[1,2],[0,1],-1/Math.log(.99))-2/1.99)<1e-12);
});
test('zero correlation is byte-equivalent to the maintained independent course',()=>{
  const p=predictions([[0,0,0],[1,2,3],[3,1,2]]),o={sigma:.2,targetZ:4,maxReadings:2};
  assert.deepEqual(designCorrelatedReadings(p,{...o,correlationTime:0}),designGaussianReadings(p,o));
});
test('correlated oracle agrees with dense solves on frozen irregular subsets',()=>{
  for(let seed=1;seed<=40;seed++){
    const t=[.1,.3,1.2,2.7,4.1,7],d=t.map((_,i)=>Math.sin(seed*(i+1)*.71)),tau=.15+seed*.13;
    for(const indices of [[0,1],[1,3,5],[0,2,3,5],[0,1,2,3,4,5]]){
      const a=correlatedEnergy(d,t,indices,tau),b=denseEnergy(d,t,indices,tau);
      assert.ok(Math.abs(a-b)<1e-9*Math.max(1,b),`${seed}: ${a} vs ${b}`);
    }
  }
});
test('full shared-subset oracle verifies minimum or impossibility on frozen ensembles',()=>{
  for(let seed=1;seed<=48;seed++){
    const p=predictions(Array.from({length:3},(_,m)=>Array.from({length:6},(_,i)=>Math.sin((seed+3*m)*(i+1)*.37))));
    const o={sigma:.6,targetZ:1+seed%5,maxReadings:3,correlationTime:.2+(seed%9)*.6};
    let minimum=null;
    for(let mask=1;mask<64;mask++){
      const indices=Array.from({length:6},(_,i)=>i).filter(i=>mask>>i&1);if(indices.length>3)continue;
      let worst=Infinity;
      for(let a=0;a<3;a++)for(let b=a+1;b<3;b++){
        const d=p[a].rows.slice(1).map((r,i)=>(r.position-p[b].rows[i+1].position)/o.sigma);
        worst=Math.min(worst,denseEnergy(d,[1,2,3,4,5,6],indices,o.correlationTime));
      }
      if(worst>=o.targetZ**2)minimum=minimum===null?indices.length:Math.min(minimum,indices.length);
    }
    const r=designCorrelatedReadings(p,o);
    assert.equal(r.certifiedMinimumReadings,minimum,`seed ${seed}`);
    assert.equal(r.status==='distinguishable',minimum!==null,`seed ${seed}`);
  }
});
test('equal laws and unresolved covariance never become evidence',()=>{
  const p=predictions([[1,2],[1,2]]);
  assert.equal(designCorrelatedReadings(p,{sigma:1,targetZ:1,maxReadings:2,correlationTime:1}).status,'observationally_equivalent_on_grid');
  for(const correlationTime of [-1,NaN,Infinity,1e20])assert.throws(()=>designCorrelatedReadings(p,{sigma:1,targetZ:1,maxReadings:2,correlationTime}));
});

test('exhausted shared work budget is unresolved rather than false impossibility',()=>{
  const p=predictions([[0,0,0],[1,2,3]]);
  const r=designCorrelatedReadings(p,{sigma:1,targetZ:1,maxReadings:2,correlationTime:.2,maxInnovationTerms:3});
  assert.equal(r.status,'search_inconclusive');
  assert.equal(r.certifiedMinimumReadings,null);
  assert.equal(r.work.exhausted,true);
  assert.equal(r.work.innovationTerms,3);
});
