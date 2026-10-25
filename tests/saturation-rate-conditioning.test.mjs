
import test from 'node:test';import assert from 'node:assert/strict';
import {compareSaturationRates,fitSaturationProfile} from '../src/unknown-lab/saturation-profile.mjs';
import {saturatedRatePlanningExample} from '../src/unknown-lab/saturation-rate-fixture.mjs';
import {rational,mul,div,cmp,enclosure} from '../src/unknown-lab/chronos-exact-halfplanes.mjs';
import {tanhPositive} from '../src/science/tanh-enclosure.mjs';
const q=s=>s.split('/').map(BigInt),minimum=(a,b)=>cmp(a,b)<0?a:b,maximum=(a,b)=>cmp(a,b)>0?a:b;
function authored(){const study=saturatedRatePlanningExample();
for(const run of study.runs){const old=-.4*Math.sign(run.probe.rate),rate=Math.sign(run.probe.rate)*.01,response=-.4*Math.tanh(rate/.28),baseline=-.2*(rate-run.probe.rate);run.probe.rate=rate;for(const row of run.notebook.trials){row.rate=rate;row.jointTorque+=baseline;if(row.history==='conditioned')row.jointTorque+=response-old;}}return study;}
const settings={settings:{maxEvaluations:1024},windows:[[.05,.2],[.5,1]],probes:[0,.01,.1,.2,.3,.5,100].map((rate,i)=>({id:'offer-'+i,position:.6,rate,cost:rate>.3?10:1})),contrastRadius:.002,budget:1};
function originalBand(box,rate){if(!rate)return [rational(0),rational(0)];const a=box.amplitudeOuter.exact.map(q),s=box.scale.exact.map(q),r=rational(Math.abs(rate)),f=[tanhPositive(div(r,s[1]))[0],tanhPositive(div(r,s[0]))[1]],v=a.flatMap(x=>f.map(y=>mul(x,y)));const b=[v.reduce(minimum),v.reduce(maximum)];return rate<0?[[-b[1][0],b[1][1]],[-b[0][0],b[0][1]]]:b;}
const study=authored(),snapshot=JSON.stringify(study),plan=compareSaturationRates(study,settings);
test('original family remains unchanged while conditioning exposes affordable discriminator',()=>{
 assert.equal(plan.selected,'offer-4');assert(plan.courses[4].margin.outer[0]>.02246);assert.equal(JSON.stringify(study),snapshot);
 const high=compareSaturationRates(study,{...settings,probes:[{id:'other',position:.6,rate:100,cost:1}]});assert.deepEqual(plan.training,high.training);
 for(const course of plan.courses.filter(c=>c.affordable)){
  let minimumGap=Infinity;
  for(const a of plan.groups[0].boxes)for(const b of plan.groups[1].boxes){
   const x=originalBand(a,course.probe.rate).map(t=>enclosure(t)),y=originalBand(b,course.probe.rate).map(t=>enclosure(t));
   minimumGap=Math.min(minimumGap,Math.max(0,y[0].lower-x[1].upper,x[0].lower-y[1].upper));
  }assert(minimumGap<=2*settings.contrastRadius);
 }
});
test('each band preserves original box identity and is an exact subset of the unconditioned forecast',()=>{
 for(const course of plan.courses)for(let g=0;g<2;g++){
  assert.equal(course.forecasts[g].length,course.forecastBoxIndices[g].length);
  assert.equal(new Set([...course.forecastBoxIndices[g],...course.excludedForecastBoxIndices[g]]).size,plan.groups[g].boxes.length);
  course.forecasts[g].forEach((band,j)=>{const old=originalBand(plan.groups[g].boxes[course.forecastBoxIndices[g][j]],course.probe.rate),now=band.exact.map(q);assert(cmp(now[0],old[0])>=0);assert(cmp(now[1],old[1])<=0);});
 }
});
test('same-rate screen, signed mirror, zero and saturated offers remain conservative',()=>{
 const same=plan.courses[1];
 for(const point of plan.training.finiteBaseline.points){const limits=point.probe.rate<0?[-point.interval[1],-point.interval[0]]:point.interval;
  for(const bands of same.forecasts)for(const b of bands){assert(b.outer[0]>=limits[0]);assert(b.outer[1]<=limits[1]);}}
 const reverse=compareSaturationRates(study,{...settings,probes:settings.probes.map(p=>({...p,rate:-p.rate}))});
 for(let i=0;i<plan.courses.length;i++)assert.deepEqual(plan.courses[i].margin,reverse.courses[i].margin);
 for(const g of plan.courses[0].forecasts)for(const b of g)assert.deepEqual(b.exact,['0/1','0/1']);
 assert.equal(plan.courses.at(-1).probe.rate,100);assert.equal(plan.courses.at(-1).affordable,false);
});
test('work exhaustion publishes no prefix of offered courses',()=>{
 for(const maxEvaluations of [2,30,60]){const r=compareSaturationRates(study,{...settings,settings:{maxEvaluations}});assert.equal(r.selected,null);assert.deepEqual(r.courses,[]);}
});
