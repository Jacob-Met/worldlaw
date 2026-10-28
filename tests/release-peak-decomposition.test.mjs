import test from 'node:test';import assert from 'node:assert/strict';
import {decomposeReleasePeakSamples as decompose} from '../src/science/release-peak-decomposition.mjs';
import {investigateReleasePeaks} from '../src/science/release-peak-resolution.mjs';
const row=(time,positive,negative=positive)=>({time,positive,negative});
test('equal sampled maxima can hide cancelling numerical shift and additional-time gain',()=>{
 const coarse=[row(0,1),row(1,10)],fine=[row(0,1),row(.5,10),row(1,8)],before=JSON.stringify({coarse,fine});const r=decompose(coarse,fine);
 assert.equal(r.totalPeakShift,0);assert.equal(r.sharedGridPeakShift,-2);assert.equal(r.additionalSamplePeakGain,2);assert.deepEqual(r.finePeak,{value:10,time:.5,side:'positive'});assert.equal(JSON.stringify({coarse,fine}),before);
 const sign=decompose([row(0,1),row(1,3,4)],[row(0,1),row(.5,2,8),row(1,2,3)]);assert.equal(sign.finePeak.side,'negative');assert.equal(sign.additionalSamplePeakGain,5);assert.equal(sign.sharedGridPeakShift,-1);
});
test('executed harmonic and Coulomb courses distinguish sampling gain from numerical peak shift',()=>{
 const model=terms=>({schema:'worldlaw.torque-model/v1',terms}),scales={positionScale:1,rateScale:1};
 const harmonic=investigateReleasePeaks({competitive:[model([{id:'spring',coefficient:-((2*Math.PI/.1)**2)}])]},{position:0,rate:0},{position:.001,rate:0},{duration:.4,dt:.1},scales);
 const h=harmonic.transitions[0].laws[0].peakDecomposition;assert.ok(h.additionalSamplePeakGain>60);assert.equal(h.sharedGridPeakShift,0);
 const stopping=investigateReleasePeaks({competitive:[model([{id:'coulomb',coefficient:-1}])]},{position:0,rate:.2},{position:0,rate:.01},{duration:.6,dt:.1},scales);const c=stopping.transitions[0].laws[0].peakDecomposition;assert.equal(c.additionalSamplePeakGain,0);assert.ok(c.sharedGridPeakShift<-1);
 for(const report of [harmonic,stopping])for(const transition of report.transitions)for(const law of transition.laws){const d=law.peakDecomposition;assert.ok(d.additionalSamplePeakGain>=0);assert.ok(Math.abs(d.totalPeakShift-(d.sharedGridPeakShift+d.additionalSamplePeakGain))<1e-12);assert.equal(Math.abs(d.totalPeakShift),law.peakDifference);}
});
test('missing exact times, changed domains, nonfinite, unsorted and sparse samples refuse',()=>{
 const good=[row(0,1),row(1,2)];for(const bad of [[],[row(0,1),row(.9,2)],[row(0,1),row(1,NaN)],[row(0,1),row(.5,2),row(.5,3),row(1,4)],[row(0,1),,row(1,2)]])assert.throws(()=>decompose(good,bad));
 assert.throws(()=>decompose([row(0,1),row(.5,3),row(1,2)],good),/every exact/);
});
