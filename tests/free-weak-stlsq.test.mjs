import test from 'node:test';
import assert from 'node:assert/strict';
import {fitFreeWeakSTLSQ} from '../src/science/free-weak-stlsq.mjs';
const close=(a,b,t=1e-11)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),JSON.stringify({a,b}));
const fit=(rows,options={})=>fitFreeWeakSTLSQ(rows,{thresholds:[0],ridges:[0],...options}).candidates[0];
test('free coefficients recover an independent linear system and preserve feature/response units',()=>{
  const row={columns:[[1,0,1],[0,1,1]],target:[2,-3,-1]};
  const a=fit([row]);assert.equal(a.status,'converged');
  a.equations[0].coefficients.forEach((v,j)=>close(v,[2,-3][j]));
  const b=fit([{columns:[row.columns[0].map(v=>100*v),row.columns[1]],target:row.target.map(v=>7*v)}]);
  b.equations[0].coefficients.forEach((v,j)=>close(v,[.14,-21][j]));
});
test('the free baseline retains more than four active coefficients without top-k truncation',()=>{
  const columns=Array.from({length:6},(_,j)=>Array.from({length:6},(_,i)=>+(i===j)));
  const r=fit([{columns,target:[1,2,3,4,5,6]}]).equations[0];
  assert.equal(r.active.length,6);r.coefficients.forEach((v,j)=>close(v,j+1));assert.equal(r.supportRank,6);
});
test('zero response, zero library and rank refusal have distinct outcomes',()=>{
  assert.equal(fit([{columns:[[1,2,3]],target:[0,0,0]}]).equations[0].reason,'zero_target');
  assert.equal(fit([{columns:[[0,0,0]],target:[1,2,3]}]).equations[0].reason,'all_columns_zero');
  const duplicate=fit([{columns:[[1,2,3],[1,2,3]],target:[1,2,3]}]);
  assert.equal(duplicate.status,'refused');assert.equal(duplicate.equations[0].status,'data_rank_deficient');
  const ridge=fit([{columns:[[1],[1]],target:[1]}],{ridges:[.01]});
  assert.equal(ridge.status,'converged');assert.equal(ridge.equations[0].supportRank,1);
  assert.equal(ridge.equations[0].dataRankDeficient,true);
});
test('a coefficient crossing threshold after refit is deleted, with shared kinetic hyperparameters',()=>{
  const columns=[[1,0,0],[.5,Math.sqrt(.75),0]];
  const a={columns,target:[.35,-.5*Math.sqrt(.75),Math.sqrt(.69)]},b={columns,target:[1,0,0]};
  const r=fit([a,b],{thresholds:[.55]});
  assert.equal(r.status,'converged');assert.deepEqual(r.equations[0].active,[]);
  assert.deepEqual(r.equations[0].trace.map(x=>x.kept),[[0],[]]);
  assert.deepEqual(r.equations[1].active,[0]);close(r.equations[1].coefficients[0],1);
  const unfinished=fit([a],{thresholds:[.55],maxFits:1});
  assert.equal(unfinished.status,'refused');assert.equal(unfinished.equations[0].status,'iteration_limit');
});
test('work is refused before an unbudgeted solve and sparse vectors are rejected',()=>{
  const r=fit([{columns:[[1,2],[2,1]],target:[1,1]}],{maxWorkPerRow:1});
  assert.equal(r.status,'refused');assert.equal(r.equations[0].fits,0);assert.equal(r.equations[0].status,'work_limit');
  assert.throws(()=>fit([{columns:[new Array(2)],target:[1,1]}]),/missing observation/);
  assert.throws(()=>fit([{columns:[[1,1]],target:[1,1]}],{thresholds:[0,0]}),/menu/);
});
test('representable coefficient ratios survive large units and unrepresentable ratios refuse',()=>{
  const r=fit([{columns:[[1e200,1e200]],target:[2e200,2e200]}]);
  assert.equal(r.status,'converged');close(r.equations[0].coefficients[0],2);
  for(const [x,y] of [[1e-300,1e300],[1e300,1e-300]]){
    const bad=fit([{columns:[[x,x]],target:[y,y]}]);
    assert.equal(bad.status,'refused');assert.equal(bad.equations[0].status,'numeric_failure');
  }
});
