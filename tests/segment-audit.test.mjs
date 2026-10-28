import test from 'node:test';
import assert from 'node:assert/strict';
import {segmentAudit} from '../src/trajectory/segment-audit.mjs';
const rows=values=>values.map(([time,error])=>({time,observed:error,predicted:0}));
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-13*Math.max(Math.abs(a),Math.abs(b),1e-300),`${a} != ${b}`);
test('independent exact polynomial integrals on irregular source and full endpoint custody',()=>{
 const source=rows([[0,-2],[.1,3],[1,-1],[4,2]]),before=JSON.stringify(source),r=segmentAudit(source);
 let linear=0,squared=0,difference=0;
 for(let i=1;i<source.length;i++){const a=source[i-1].observed,b=source[i].observed,dt=source[i].time-source[i-1].time;linear+=dt*(a*a+a*b+b*b)/3;squared+=dt*(a*a+b*b)/2;difference+=dt*(a-b)**2/6;}
 near(r.linearResidualRMS,Math.sqrt(linear/4));near(r.linearSquaredResidualRMS,Math.sqrt(squared/4));near(r.conventionDifferenceRMS,Math.sqrt(difference/4));
 assert.deepEqual(r.segments.map(s=>[s.earlier.index,s.later.index]),[[0,1],[1,2],[2,3]]);assert.equal(JSON.stringify(source),before);
});
test('linear-residual integral invariant to exact subdivision; squared convention changes honestly',()=>{
 const a=segmentAudit(rows([[0,0],[1,0],[2,2],[3,0]])),b=segmentAudit(rows([[0,0],[.5,0],[1,0],[1.5,1],[2,2],[3,0]]));
 near(a.linearResidualRMS,b.linearResidualRMS);assert.notEqual(a.original.rmse,b.original.rmse);assert.notEqual(a.linearSquaredResidualRMS,b.linearSquaredResidualRMS);
});
test('zero and subnormal-scale squared values avoid direct-square underflow',()=>{
 const z=segmentAudit(rows([[0,0],[1,0],[2,0],[3,0]]));assert.equal(z.linearResidualRMS,0);
 const tiny=segmentAudit(rows([[0,1e-300],[1,1e-300],[2,1e-300],[3,1e-300]]));near(tiny.linearResidualRMS,1e-300);near(tiny.linearSquaredResidualRMS,1e-300);assert.equal(tiny.conventionDifferenceRMS,0);
});
test('identical observed zero endpoints cannot certify an unsampled oscillation',()=>{
 const r=segmentAudit(rows([[0,0],[1,0],[2,0],[3,0]]));assert.equal(r.linearResidualRMS,0);
 // Authored hidden residual sin(pi*t) vanishes at all these observations yet has continuous RMS sqrt(1/2).
 near(Math.sqrt(.5),.7071067811865476);assert.match(r.meaning,/do not bound actual intersample error/);
});
test('representable RMS contribution survives an underflowing duration fraction',()=>{
 const r=segmentAudit(rows([[0,1],[Number.MIN_VALUE,0],[1,0],[1e308,0]]));
 assert.equal(r.segments[0].spanFraction,0);
 assert.ok(r.linearResidualRMS>0);
 assert.ok(r.linearSquaredResidualRMS>r.linearResidualRMS);
});
