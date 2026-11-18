import test from 'node:test';
import assert from 'node:assert/strict';
import {singleReadingForRelease,rankSingleReadings} from '../src/coupling/single-reading.mjs';

const pair = values => ({screened:true,curve:values.map((separation,time)=>({time,separation}))});
const settings={minimumSeparation:.15,tieTolerance:1e-9};
test('one simultaneous reading cannot combine peaks at incompatible clocks',()=>{
 const reading=singleReadingForRelease([pair([0,5,2,1]),pair([0,1,3,4])],0);
 assert.deepEqual(reading,{time:2,sampleIndex:2,separation:2,tiedSampleCount:1});
});
test('missing or mismatched numerical evidence cannot form a proposal',()=>{
 assert.equal(singleReadingForRelease([],0),null);
 assert.equal(singleReadingForRelease([{screened:false,curve:[]}],0),null);
 const a=pair([0,3]),b=pair([0,4]); b.curve[1].time=2;
 assert.throws(()=>singleReadingForRelease([a,b],0),/inconsistent/);
 assert.throws(()=>singleReadingForRelease([a,pair([0])],0),/complete/);
});
test('equal clocks and releases retain stable exact optimum and declared tie count',()=>{
 const reading=singleReadingForRelease([pair([0,1,1])],0);
 assert.equal(reading.time,1);assert.equal(reading.tiedSampleCount,2);
 const releases=[0,1].map(index=>({index,position:[index,0],singleReading:reading}));
 assert.deepEqual(rankSingleReadings(releases,settings).tiedIndices,[0,1]);
 assert.equal(rankSingleReadings(releases,settings).selected.index,0);
 assert.equal(rankSingleReadings(releases,{...settings,minimumSeparation:1}).selected,null);
 assert.equal(rankSingleReadings([{singleReading:null}],settings).status,'unresolved');
});
