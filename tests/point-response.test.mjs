import test from 'node:test';import assert from 'node:assert/strict';
import {POINT_RESPONSE_SCHEMA,inspectPointResponse,pointResponseAt,exportPointResponse,importPointResponse} from '../src/coupling/point-response.mjs';
import {circulationExample} from '../src/coupling/circulation.mjs';
const fixture=(kind='reciprocal')=>({schema:POINT_RESPONSE_SCHEMA,path:circulationExample('Explicit test coordinates',kind),sensitivity:[[1,1],[1,1]],sensitivityUnits:'N·m/rad',sensitivityBasis:'Authored independent control; not estimated'});
const number=x=>Number(x.integer)*2**x.powerOfTwo;
test('zero polygon work hides exact repeated-state contradiction of every position-only response',()=>{
 const raw=fixture();raw.path.samples.at(-1).torque[0]=1;raw.sensitivity=[[1e6,1e6],[1e6,1e6]];const r=inspectPointResponse(raw);assert.equal(r.work.work,0);assert.equal(r.status,'incompatible');assert.equal(r.witness,null);assert.equal(r.repeatedStateConflict.lowerRow,4);assert.equal(r.repeatedStateConflict.upperRow,0);assert.equal(number(r.repeatedStateConflict.gap),1);assert.equal(number(r.repeatedStateConflict.sensitivityAllowance),0);
 assert.throws(()=>pointResponseAt(raw,[0,0]),/No compatible/);
});
test('nonzero conservative quadrature work admits a constructive single-valued point response',()=>{
 const raw=fixture('quadrature');raw.sensitivity=[[4,2],[2,0]];const before=structuredClone(raw),r=inspectPointResponse(raw);assert.equal(r.work.work,-.5);assert.equal(r.status,'compatible');assert.ok(r.witness);assert.deepEqual(raw,before);
 for(const [i,row]of raw.path.samples.entries()){const witness=r.witness.sourceValues[i].torque.map(number);for(let a=0;a<2;a++)assert.equal(witness[a],row.torque[a]);assert.deepEqual(pointResponseAt(raw,row.q).torque,r.witness.sourceValues[i].torque);}
 for(const q of [[.25,.75],[.5,1],[0,1.5]]){const value=pointResponseAt(raw,q).torque.map(number);for(const row of raw.path.samples)for(let a=0;a<2;a++)assert.ok(Math.abs(value[a]-row.torque[a])<=raw.sensitivity[a].reduce((sum,L,b)=>sum+L*Math.abs(q[b]-row.q[b]),0));}
});
test('wider reading boxes and declared sensitivities admit witnesses without changing source',()=>{
 const raw=fixture();raw.path.samples.at(-1).torque[0]=1;raw.path.samples[0].torqueRadius[0]=.5;raw.path.samples.at(-1).torqueRadius[0]=.5;assert.equal(inspectPointResponse(raw).status,'compatible');
 const near=fixture();near.path.samples.splice(1,0,{q:[.0005,0],torque:[1,.0005],torqueRadius:[0,0]});near.sensitivity[0]=[100,1];assert.equal(inspectPointResponse(near).status,'incompatible');assert.equal(inspectPointResponse(near).repeatedStateConflict,null);near.sensitivity[0][0]=2000;assert.equal(inspectPointResponse(near).status,'compatible');
});
test('independent finite-grid feasibility oracle covers729 closed point-box cases including zero sensitivity',()=>{
 const q=[0,1,2,0];for(let code=0;code<81;code++)for(const radius of [0,.5,1])for(const L of [0,.5,1]){
  let c=code;const centers=q.map(()=>{const v=c%3-1;c=Math.floor(c/3);return v;});const options=centers.map(v=>Array.from({length:radius*4+1},(_,i)=>v-radius+i*.5));let feasible=false;
  function search(values){if(feasible)return;if(values.length===4){feasible=true;return;}const i=values.length;for(const v of options[i])if(values.every((w,j)=>Math.abs(v-w)<=L*Math.abs(q[i]-q[j])))search([...values,v]);}search([]);
  const raw=fixture();raw.sensitivity=[[L,0],[0,0]];raw.path.samples=q.map((x,i)=>({q:[x,0],torque:[centers[i],0],torqueRadius:[radius,0]}));const r=inspectPointResponse(raw);assert.equal(r.status==='compatible',feasible,JSON.stringify({centers,radius,L}));
  if(r.witness){const v=r.witness.sourceValues.map(s=>number(s.torque[0]));for(let i=0;i<4;i++){assert.ok(Math.abs(v[i]-centers[i])<=radius);for(let j=0;j<4;j++)assert.ok(Math.abs(v[i]-v[j])<=L*Math.abs(q[i]-q[j]));}}
 }
});
test('source-only replay ignores forged certificates; work allowance does not change point conclusion',()=>{
 const raw=fixture(),a=inspectPointResponse(raw);raw.path.integrationAllowance=100;const b=inspectPointResponse(raw);assert.deepEqual(a.axes,b.axes);assert.deepEqual(a.witness,b.witness);assert.notDeepEqual(a.work.interval,b.work.interval);
 const saved=JSON.parse(exportPointResponse({...raw,witness:{forged:true},status:'incompatible'}));assert.equal(saved.witness,undefined);assert.equal(saved.status,undefined);assert.deepEqual(inspectPointResponse(importPointResponse(JSON.stringify(saved))).witness,b.witness);assert.equal(saved.path.samples.length,5);assert.equal(saved.path.integrationAllowance,100);
});
test('tiny exact contradiction is never screened away; invalid or oversized complete sources refuse',()=>{
 const raw=fixture();raw.path.samples.at(-1).torque[0]=Number.MIN_VALUE;assert.equal(inspectPointResponse(raw).status,'incompatible');assert.notEqual(inspectPointResponse(raw).repeatedStateConflict.gap.integer,'0');
 for(const mutate of [r=>r.sensitivity[0][0]=-1,r=>r.sensitivity[0][0]=Infinity,r=>r.sensitivityUnits='rad',r=>r.sensitivityBasis='',r=>r.path.samples[1].gapBefore=true,r=>r.path.samples=Array.from({length:129},(_,i)=>r.path.samples[i%4]).concat(r.path.samples[0])]){const r=fixture();mutate(r);assert.throws(()=>inspectPointResponse(r));}
});
