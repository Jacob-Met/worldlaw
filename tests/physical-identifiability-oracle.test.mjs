import test from 'node:test';
import assert from 'node:assert/strict';
import {designPhysicalAnchors} from '../src/science/physical-identifiability.mjs';

// Independently implemented determinant/minor oracle: no imports of the
// production elimination, rank, nullspace, model or subset-search helpers.
// This follows a source-locked xorshift32 generator for changed-input tests.
function seeded(seed){
  let x=seed>>>0;
  return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};
}
function minor(matrix){
  if(matrix.length===0)return 1;
  if(matrix.length===1)return matrix[0][0];
  let value=0;
  for(let c=0;c<matrix.length;c++){
    const rest=matrix.slice(1).map(row=>row.filter((_,j)=>j!==c));
    value+=(c%2?-1:1)*matrix[0][c]*minor(rest);
  }
  return value;
}
function choose(n,k){
  const result=[];
  const rec=(at,items)=>{
    if(items.length===k){result.push(items);return;}
    for(let i=at;i<=n-(k-items.length);i++)rec(i+1,[...items,i]);
  };
  rec(0,[]);
  return result;
}
function determinantRank(rows,n){
  if(!rows.length)return 0;
  for(let k=Math.min(n,rows.length);k>=1;k--){
    const colsets=choose(n,k);
    for(const ix of choose(rows.length,k)){
      for(const cx of colsets){
        const m=ix.map(i=>cx.map(j=>Number(rows[i][j])));
        if(minor(m)!==0)return k;
      }
    }
  }
  return 0;
}
function brute(request){
  const observations=request.observations.map(x=>x.coefficients);
  const anchors=request.anchors;
  const targets=request.targets.map(x=>x.coefficients);
  const identifiable=(rows)=>{
    const rank=determinantRank(rows,request.variables.length);
    return targets.every(t=>determinantRank([...rows,t],request.variables.length)===rank);
  };
  if(identifiable(observations))return {status:'already_identifiable',cardinality:0,cost:0,ids:[]};
  if(!identifiable([...observations,...anchors.map(a=>a.coefficients)]))
    return {status:'fundamentally_unidentifiable_with_offered_anchors',cardinality:null};
  for(let k=1;k<=request.maxAnchors;k++){
    let best=null;
    for(const indices of choose(anchors.length,k)){
      const cost=indices.reduce((s,i)=>s+anchors[i].cost,0);
      if(identifiable([...observations,...indices.map(i=>anchors[i].coefficients)])){
        if(best===null||cost<best.cost)best={cost,indices};
      }
    }
    if(best)return {status:'optimal_structural_design',cardinality:k,cost:best.cost,
      ids:best.indices.map(i=>anchors[i].id)};
  }
  return {status:'insufficient_anchor_budget',cardinality:null};
}
function make(rng,i){
  const n=2+Math.floor(rng()*3);
  const obsN=1+Math.floor(rng()*4);
  const anchorN=2+Math.floor(rng()*6);
  const targetsN=1+Math.floor(rng()*2);
  const vector=()=>Array.from({length:n},()=>Math.floor(rng()*5)-2);
  const nonzero=()=>{let a=vector();if(a.every(v=>v===0))a[0]=1;return a;};
  const observations=Array.from({length:obsN},(_,j)=>({
    id:'observed'+j,coefficients:nonzero(),historicalMeasuredData:(j%2?1e50:-1e30)}));
  const anchors=Array.from({length:anchorN},(_,j)=>({
    id:'anchor'+j,coefficients:nonzero(),cost:1+Math.floor(rng()*8),
    physicalOutcomeAlreadyObserved:null}));
  const targets=Array.from({length:targetsN},(_,j)=>({
    id:'target'+j,coefficients:nonzero(),futureHeldoutValue:(j%2?100:-100)}));
  return {variables:Array.from({length:n},(_,j)=>'latent'+j),
    observations,anchors,targets,maxAnchors:Math.min(anchorN,4),workLimit:50000};
}
test('128 source-blind randomized geometric cases agree with independent integer minor oracle',()=>{
  const rng=seeded(20261119);
  const counts={},sample={};
  for(let i=0;i<128;i++){
    const request=make(rng,i);
    const actual=designPhysicalAnchors(request);
    const expected=brute(request);
    counts[expected.status]=(counts[expected.status]??0)+1;
    assert.equal(actual.status,expected.status,'case '+i+' status mismatch');
    assert.equal(actual.exactMinimalAnchors,expected.cardinality,'case '+i+' exact cardinality mismatch');
    if(expected.status==='optimal_structural_design'){
      assert.equal(actual.totalCost,expected.cost,'case '+i+' cost mismatch');
      assert.deepEqual(actual.selection.map(x=>x.id),expected.ids,'case '+i+' tie break mismatch');
      sample[i]=actual.work.nodes;
    }
    assert.equal(actual.work.exhausted,false,'tiny input must fit resource budget');
    // Validate every exact unresolved nullspace counterexample via an
    // independent integer dot-product rational parser.
    for(const target of actual.initial.targets.filter(t=>!t.identifiable)){
      const coeff=request.targets.find(x=>x.id===target.id).coefficients;
      const vector=target.counterexample.direction.map(x=>{
        const [p,q]=x.split('/');return Number(p)/Number(q??1);
      });
      for(const row of request.observations)
        assert.ok(Math.abs(row.coefficients.reduce((s,c,j)=>s+c*vector[j],0))<1e-9,
          'source row not orthogonal to supplied gauge');
      assert.ok(Math.abs(coeff.reduce((s,c,j)=>s+c*vector[j],0))>1e-9,
        'unresolved target is unchanged by claimed gauge');
    }
  }
  assert.ok(counts.optimal_structural_design>0,'blind oracle did not exercise optimization');
  assert.ok(counts.fundamentally_unidentifiable_with_offered_anchors>0,'blind oracle did not exercise no-go');
  const explicitBudget={variables:['x','y','z'],
    observations:[{id:'known_x',coefficients:[1,0,0]}],
    anchors:[{id:'new_y',coefficients:[0,1,0],cost:1},
             {id:'new_z',coefficients:[0,0,1],cost:2}],
    targets:[{id:'target_y',coefficients:[0,1,0]},
             {id:'target_z',coefficients:[0,0,1]}],
    maxAnchors:1};
  assert.equal(brute(explicitBudget).status,'insufficient_anchor_budget');
  assert.equal(designPhysicalAnchors(explicitBudget).status,'insufficient_anchor_budget');
  console.log(JSON.stringify({oracle_seed:20261119,cases:128,counts,
    max_exact_nodes:Math.max(0,...Object.values(sample))}));
});
