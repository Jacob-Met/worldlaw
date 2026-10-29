import test from 'node:test';import assert from 'node:assert/strict';
import {fitInputOriginColumns} from '../src/science/input-origin-fit.mjs';
import {fitHeterogeneousColumns} from '../src/science/heterogeneous-fit.mjs';
import {splitResidual} from '../src/science/split-multicolumn.mjs';
test('shifted executable original coefficients preserve independently authored response',()=>{
 for(const origin of [-500000,-10000,10000,500000])for(const amplitude of [1e-6,1e-4,.01]){
 const x=Array.from({length:32},(_,i)=>origin+(i-15.5)*amplitude),ones=x.map(()=>1),y=x.map(v=>2*(v-origin)+3),ratios=x.map((_,i)=>1+i%3);
 const f=fitInputOriginColumns([x,ones],y,ratios,1e-7);assert.equal(f.status,'converged',JSON.stringify({origin,amplitude,f}));
 const held=[origin-20*amplitude,origin+20*amplitude];assert.ok(Math.max(...splitResidual([held,[1,1]],held.map(v=>2*(v-origin)+3),f.pairs).map(Math.abs))<1e-8);
 assert.ok(f.originalGradient<=1e-15&&f.centeredGradient<=1e-15);
 }
});
test('zero-crossing columns retain exact original solve pairs',()=>{const x=Array.from({length:32},(_,i)=>(i-15.5)/10),c=[x,x.map(()=>1)],y=x.map(v=>2*v+3),r=x.map(()=>1);const a=fitHeterogeneousColumns(c,y,r,1e-7),b=fitInputOriginColumns(c,y,r,1e-7);assert.equal(b.status,'converged');assert.deepEqual(b.pairs,a.pairs);assert.deepEqual(b.origins,[0,0]);});
test('explicit admission, singularity and work refusals',()=>{const c=[[10,11,12],[1,1,1]],y=[1,2,3],r=[1,1,1];assert.equal(fitInputOriginColumns([c[0]],y,r,1e-7).status,'bias-required');for(const options of [{maxSolves:0},null,[],{unknown:1}])assert.equal(fitInputOriginColumns(c,y,r,1e-7,options).status,'refused');for(const options of [{maxWork:0},{maxIterations:0}])assert.equal(fitInputOriginColumns(c,y,r,1e-7,options).status,'work-limit');assert.equal(fitInputOriginColumns([[2,2,2],c[1]],y,r,1e-7).status,'rank-unavailable');assert.equal(fitInputOriginColumns(c,new Array(3),r,1e-7).status,'refused');});
