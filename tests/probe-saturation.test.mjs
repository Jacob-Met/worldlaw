import test from 'node:test';import assert from 'node:assert/strict';
import {saturatedProbeExample} from '../src/unknown-lab/probe-saturation-fixture.mjs';
import {fitProbeModels,analyzeProbeStudy,validateProbeStudy,exportProbeStudy,importProbeStudy} from '../src/unknown-lab/probe-response.mjs';
import {planProbeAcquisition} from '../src/unknown-lab/probe-planner.mjs';
import {planProbeCourses,compareProbeCourse} from '../src/unknown-lab/probe-course.mjs';
const training=s=>({...s,runs:s.runs.filter(r=>r.role==='training')});
test('declared saturation revises a rejected four-law explanation and challenges frozen support',()=>{
 const s=saturatedProbeExample(),result=analyzeProbeStudy(s);
 assert.deepEqual(result.fit.candidates.filter(c=>c.compatible).map(c=>c.id),['saturated-rate:0.2']);
 assert.ok(result.fit.candidates.filter(c=>!c.id.startsWith('saturated-rate:')).every(c=>!c.compatible));
 assert.equal(result.jointChallenges.find(c=>c.id==='saturated-rate:0.2').status,'compatible');
 const c=result.fit.candidates.find(c=>c.compatible);assert.ok(c.coefficientInterval[0]<-.4&&c.coefficientInterval[1]>-.4);
 assert.deepEqual(importProbeStudy(exportProbeStudy(s)),validateProbeStudy(s));
});
test('separate challenge mutation cannot choose scale or coefficient',()=>{
 const s=saturatedProbeExample(),before=fitProbeModels(training(s));
 for(const r of s.runs.filter(r=>r.role==='challenge'))for(const t of r.notebook.trials)if(t.history==='conditioned')t.jointTorque+=1;
 const after=analyzeProbeStudy(s);assert.deepEqual(after.fit,before);assert.equal(after.jointChallenges.find(c=>c.id==='saturated-rate:0.2').status,'contradicted');
});
test('explicit schema and declared finite scale grid are preserved, no automatic fitting of scales',()=>{
 const s=saturatedProbeExample();for(const scales of [[],[0],[.2,.2],[Infinity],[.1,.2,.3,.4]])assert.throws(()=>validateProbeStudy({...s,rateSaturationScales:scales}));
 assert.throws(()=>validateProbeStudy({...s,schema:'worldlaw.probe-response/v1'}),/schema/);
 const missing={...s};delete missing.rateSaturationScales;assert.throws(()=>validateProbeStudy(missing),/schema/);
 const old={...missing,schema:'worldlaw.probe-response/v1'};assert.equal(fitProbeModels(training(old)).status,'none-compatible');
 const offgrid=saturatedProbeExample(.28);assert.equal(fitProbeModels(training(offgrid)).status,'none-compatible');
});
test('declared feature metadata reaches one-state and joint-course predictions',()=>{
 const s=saturatedProbeExample();for(const r of s.runs)r.notebook.noiseSigma=.08;
 const settings={contrastRadius:.001,budget:2,probes:[{id:'slow',position:.4,rate:.05,cost:1},{id:'fast',position:.4,rate:1,cost:1}]};
 const one=planProbeAcquisition(training(s),settings);assert.ok(one.models.some(m=>m.rateSaturationScale));
 const course=planProbeCourses(training(s),settings);assert.equal(course.courses.length,1);assert.ok(course.courses[0].comparisons.some(c=>c.hypotheses.some(id=>id.startsWith('saturated-rate:'))));
 assert.throws(()=>compareProbeCourse([{id:'saturated-rate:0.2',rateSaturationScale:.4,coefficientInterval:[-1,-.1]}],settings.probes,.01),/Unknown declared/);
});

test('saturated high-rate observations preserve indistinguishable declared scales',()=>{
 const s=saturatedProbeExample();
 for(const run of s.runs){
  const previous=-.4*Math.tanh(run.probe.rate/.2),rate=run.probe.rate<0?-100:100,response=-.4*Math.sign(rate);
  run.probe.rate=rate;for(const row of run.notebook.trials){row.rate=rate;if(row.history==='conditioned')row.jointTorque+=response-previous;}
 }
 const result=fitProbeModels(training(s));
 assert.deepEqual(result.candidates.filter(c=>c.id.startsWith('saturated-rate:')&&c.compatible).map(c=>c.rateSaturationScale),[.1,.2,.4]);
 assert.equal(result.status,'ambiguous');
});
