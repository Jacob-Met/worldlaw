import test from 'node:test';
import assert from 'node:assert/strict';
import {predictEvolution,synthesizeEvolution} from '../src/science/operator-synthesis.mjs';

const model=tree=>({schema:'worldlaw.symbolic-evolution/v1',kind:'periodic',terms:[{weight:1,tree}]});
const base={field:1,command:0,left:2,right:3,spacing:.5};

test('identical first-ring observations separate only with supplied second-ring measurements',()=>{
  const a={...base,left2:1,right2:-2}, b={...a,right2:2};
  for(const [op,delta] of [['thirdDerivative',16],['biharmonic',64]]) {
    assert.equal(predictEvolution(model([op,'field']),b)-predictEvolution(model([op,'field']),a),delta);
    assert.throws(()=>predictEvolution(model([op,'field']),base),/Second spatial neighbors required/);
  }
  assert.equal(predictEvolution(model(['laplacian',['mul','field','field']]),a),predictEvolution(model(['laplacian',['mul','field','field']]),b));
  assert.equal(predictEvolution(model(['thirdDerivative',['mul','field','field']]),b),-28);
});

test('bounded synthesis generates the high-order bare-field operator',()=>{
  const rows=Array.from({length:40},(_,i)=>{
    const x={...base,field:Math.sin(.5*i),left:Math.cos(.2*i),right:Math.sin(.7*i),
      left2:Math.cos(1.1*i),right2:Math.sin(1.6*i)};
    return {...x,change:.375*(x.right2-2*x.right+2*x.left-x.left2)/(2*x.spacing**3)};
  });
  const r=synthesizeEvolution(rows,{kind:'periodic',operators:['thirdDerivative'],maxNodes:2,maxTerms:1,
    maxCandidates:32,beam:6,tolerance:1e-11});
  assert.equal(r.status,'candidate');assert.deepEqual(r.model.terms[0].tree,['thirdDerivative','field']);
  assert.ok(Math.abs(r.model.terms[0].weight-.375)<1e-12);
});
