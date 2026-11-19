import test from 'node:test';
import assert from 'node:assert/strict';
import {planRateSineMinimax} from '../src/unknown-lab/rate-sine-minimax.mjs';
import {coefficientBounds} from '../src/unknown-lab/probe-coefficient-bounds.mjs';

const initial=[{rate:1,position:0,contrast:0,radius:.02}];
const offers=[
 {id:'parallel-forward',rate:2,position:0,radius:.02,cost:1},
 {id:'parallel-reverse',rate:-2,position:0,radius:.02,cost:1},
 {id:'sine-axis',rate:0,position:Math.PI/2,radius:.02,cost:1},
 {id:'diagonal',rate:1,position:Math.PI/2,radius:.02,cost:1}
];
test('two independent future readings defeat the collinear equal-cost design',()=>{
 const p=planRateSineMinimax(initial,offers,{budget:2,maxReadings:2});
 assert.equal(p.status,'computed');
 assert.equal(p.selected.offers.length,2);
 assert.ok(p.selected.offers.includes('sine-axis'));
 assert.ok(p.selected.worstFraction<=.5+1e-12);
 const collinear=p.courses.find(c=>c.offers.join(',')==='parallel-forward,parallel-reverse');
 assert.ok(collinear.worstFraction>=1-1e-12);
 assert.ok(collinear.worstFraction/p.selected.worstFraction>=1.99);
 assert.equal(p.structuralExclusionGuaranteed,false);
 assert.ok(p.work.constraintVertices>0&&p.work.constraintVertices<200000);
});
test('200 disjoint seeded truths and bounded future measurements respect exact predicted worst-case posterior widths',()=>{
 const p=planRateSineMinimax(initial,offers,{budget:2,maxReadings:2});
 let seed=809031;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;};
 for(let trial=0;trial<200;trial++){
  const alpha=(2*rand()-1)*.015,beta=(2*rand()-1)*80;
  const evidence=[...initial,...p.selected.offers.map(id=>{
   const offer=offers.find(x=>x.id===id);
   return {rate:offer.rate,position:offer.position,radius:offer.radius,
    contrast:alpha*offer.rate+beta*Math.sin(offer.position)+(2*rand()-1)*offer.radius};
  })];
  const posterior=coefficientBounds(evidence);
  assert.equal(posterior.status,'feasible','trial '+trial);
  assert.ok(posterior.rate.outward[0]-1e-9<=alpha&&alpha<=posterior.rate.outward[1]+1e-9);
  assert.ok(posterior.restoring.outward[0]-1e-9<=beta&&beta<=posterior.restoring.outward[1]+1e-9);
  assert.ok(posterior.rate.outward[1]-posterior.rate.outward[0]<=p.selected.rateWidth+1e-8);
  assert.ok(posterior.restoring.outward[1]-posterior.restoring.outward[0]<=p.selected.sineWidth+1e-8);
 }
});
test('permutation, cost, exact rank, invalid input and explicit no-affordable-course',()=>{
 const p=planRateSineMinimax(initial,offers,{budget:2});
 assert.equal(p.selected.worstFraction,
  planRateSineMinimax([...initial].reverse(),[...offers].reverse(),{budget:2}).selected.worstFraction);
 assert.equal(planRateSineMinimax(initial,offers,{budget:0}).status,'no-affordable-course');
 assert.throws(()=>planRateSineMinimax(initial,[offers[0],offers[0]]),/unique/);
 assert.throws(()=>planRateSineMinimax(initial,offers.map(o=>({...o,radius:-1}))),/bounded/);
 assert.throws(()=>planRateSineMinimax(initial,offers,{budget:2,maxReadings:3}),/one or two/);
 const exact=planRateSineMinimax(initial,offers.map(x=>({...x,radius:0})),{budget:2});
 assert.equal(exact.selected.rateWidth,0);assert.equal(exact.selected.sineWidth,0);
});
test('inconsistent original readouts never receive synthetic predictions',()=>{
 const incompatible=[{rate:1,position:0,contrast:0,radius:0},{rate:1,position:0,contrast:1,radius:0}];
 assert.equal(planRateSineMinimax(incompatible,offers).status,'inconsistent');
});
