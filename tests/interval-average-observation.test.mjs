import test from 'node:test';import assert from 'node:assert/strict';
import {averagePredictedIntervals as average} from '../experiments/interval-average/interval-average.mjs';
const interval=(start,end)=>({start,end,reportedTime:start+(end-start)/2,timestampConvention:'center'});
test('independent constant and affine integrals on irregular prediction nodes',()=>{
 const times=[0,.125,.5,.75,1];
 for(const [a,b] of [[3,0],[-2,7]]){const rows=times.map(time=>({time,predicted:a+b*time}));const original=JSON.stringify(rows);for(const [l,r]of [[0,1],[.125,.75],[.5,1]])assert.ok(Math.abs(average(rows,[interval(l,r)]).rows[0].averagePrediction-(a+b*(l+r)/2))<1e-14);assert.equal(JSON.stringify(rows),original);}
});
test('exact endpoint support, timestamp semantics and full population budget refuse',()=>{
 const rows=[0,.25,.5,.75,1].map(time=>({time,predicted:1}));
 for(const intervals of [[interval(-.25,.5)],[interval(0,.375)],[interval(.5,.5)],[{...interval(0,.5),reportedTime:.5}],[{...interval(0,.5),timestampConvention:'unknown'}]])assert.throws(()=>average(rows,intervals));
 assert.throws(()=>average(rows,[interval(0,.5),interval(.5,1)],{maxSegments:3}),/Complete/);
 assert.equal(average(rows,[interval(0,.5),interval(.5,1)],{maxSegments:4}).segments,4);
});
test('observation values never enter the averaging operation',()=>{
 const rows=[0,.25,.5].map(time=>({time,predicted:Math.cos(time),observed:0}));const intervals=[interval(0,.5)];const a=average(rows,intervals);
 for(const r of rows)r.observed=1e99;
 assert.deepEqual(average(rows,intervals),a);
});
test('analytic centered small-window limit and trapezoid refinement are distinct controls',()=>{
 const w=8*Math.PI,t=.25,point=Math.cos(w*t);let previous=Infinity;
 for(const duration of [1/16,1/64,1/256]){const exact=(Math.sin(w*(t+duration/2))-Math.sin(w*(t-duration/2)))/(w*duration);const error=Math.abs(exact-point);assert.ok(error<previous);previous=error;}
 const rows=n=>Array.from({length:n+1},(_,i)=>({time:i/n,predicted:Math.cos(w*i/n)}));const win=interval(0,1/16);const exact=Math.sin(w/16)/(w/16);const a=average(rows(256),[win]).rows[0].averagePrediction,b=average(rows(1024),[win]).rows[0].averagePrediction;
 assert.ok(Math.abs(b-exact)<Math.abs(a-exact)/15);
});
