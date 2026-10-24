import test from 'node:test';import assert from 'node:assert/strict';
import {estimateAngularPrelude} from '../src/science/angular-prelude.mjs';
const cubic=t=>.3+2*t-3*t*t+.4*t*t*t;
const rows=()=>Array.from({length:31},(_,i)=>({time:(i-30)/100,position:cubic((i-30)/100)}));
test('every declared trailing window recovers analytic cubic endpoint rate without torque scale',()=>{
 const r=estimateAngularPrelude(rows(),rows().at(-1),{windowSizes:[5,9,17,31],positionSigma:.001});
 for(const e of r.estimates){assert.equal(e.status,'estimated');assert.ok(Math.abs(e.rate-2)<1e-10);assert.ok(Math.abs(e.acceleration+6)<1e-8);}
 assert.equal(r.selectedWindow,null);assert.ok(!JSON.stringify(r).includes('inertia'));
});
test('late observations, mismatched endpoint, duplicate clocks and invalid windows refuse',()=>{
 const a=rows(),end=a.at(-1);
 assert.throws(()=>estimateAngularPrelude([...a,{time:.01,position:.4}],end),/Future challenge/);
 assert.throws(()=>estimateAngularPrelude(a,{...end,position:.31}),/match/);
 const b=rows();b[2].time=b[1].time;assert.throws(()=>estimateAngularPrelude(b,end),/strictly/);
 for(const windowSizes of [[4],[9,9],[],[33],[8]])assert.throws(()=>estimateAngularPrelude(a,end,{windowSizes}));
});
test('insufficient declared windows remain unavailable, never silently dropped',()=>{
 const a=rows().slice(-9),r=estimateAngularPrelude(a,a.at(-1),{windowSizes:[5,9,17,31]});
 assert.deepEqual(r.estimates.map(x=>x.status),['estimated','estimated','unavailable','unavailable']);
 assert.equal(r.selectedWindow,null);assert.ok(r.rateSpread!==null);
});
test('longer noiseless harmonic windows can be biased beyond conditional noise sigma',()=>{
 const a=rows().map(r=>({time:r.time,position:Math.cos(3*r.time+.7)}));
 const r=estimateAngularPrelude(a,a.at(-1),{windowSizes:[5,9,17,31],positionSigma:.001}),truth=-3*Math.sin(.7);
 assert.ok(r.estimates.at(-1).rateSigma<r.estimates[0].rateSigma);
 assert.ok(Math.abs(r.estimates.at(-1).rate-truth)>r.estimates.at(-1).rateSigma);
 assert.match(r.limitations.join(' '),/excludes polynomial approximation bias/);
});
test('input custody is copied and optional conditional sigma never comes from sensor rate',()=>{
 const a=rows(),before=JSON.stringify(a),end=a.at(-1),r=estimateAngularPrelude(a,end);
 assert.equal(JSON.stringify(a),before);a[0].position=999;assert.notEqual(r.samples[0].position,999);
 assert.equal(r.uncertaintySource,'polynomial_residual_proxy');
 const r2=estimateAngularPrelude(rows(),{...end,sensorRate:999});
 assert.deepEqual(r2,r);
});

test('sparse arrays refuse as incomplete measurements or declarations',()=>{
 const a=rows();delete a[3];assert.throws(()=>estimateAngularPrelude(a,rows().at(-1)),/finite/);
 assert.throws(()=>estimateAngularPrelude(rows(),rows().at(-1),{windowSizes:Array(1)}),/unique odd/);
});
test('conditional noise scale agrees with an independent IID Gaussian cubic experiment',()=>{
 let seed=8123;const uniform=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)+.5)/4294967296;
 const normal=()=>Math.sqrt(-2*Math.log(uniform()))*Math.cos(2*Math.PI*uniform());
 const estimates=[];let declared;
 for(let repeat=0;repeat<512;repeat++){
  const a=rows().slice(-17).map(r=>({...r,position:r.position+.001*normal()}));
  const fitted=estimateAngularPrelude(a,a.at(-1),{windowSizes:[17],positionSigma:.001}).estimates[0];
  estimates.push(fitted.rate);declared=fitted.rateSigma;
 }
 const mean=estimates.reduce((a,b)=>a+b,0)/estimates.length;
 const empirical=Math.sqrt(estimates.reduce((s,x)=>s+(x-mean)**2,0)/(estimates.length-1));
 assert.ok(Math.abs(mean-2)<declared*.15);assert.ok(empirical/declared>.9&&empirical/declared<1.1);
});
test('unrepresentable derivative or noise gain remains an explicit unavailable window',()=>{
 const a=Array.from({length:9},(_,i)=>({time:i*1e-200,position:i*.1}));
 const result=estimateAngularPrelude(a,a.at(-1),{windowSizes:[9],positionSigma:.001});
 assert.equal(result.estimates[0].status,'unavailable');assert.match(result.estimates[0].reason,/finite numerical/);assert.equal(result.rateSpread,null);
});
