import assert from 'node:assert/strict';
import {proposeVelocityReleases,VELOCITY_RELEASE_SCHEMA,velocityReleaseDynamicsInputs} from '../src/coupling/velocity-release.mjs';
import {createCouplingCourse} from '../src/coupling/virtual-instrument.mjs';
import {createVelocityExample} from '../src/coupling/velocity-example.mjs';
import {defaultReleaseSettings} from '../src/coupling/viscous-release.mjs';
import {discoverCoupling} from '../src/coupling/science.mjs';
import {compareCoupledDynamics} from '../src/coupling/dynamics.mjs';

function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function torque(K,q){return [K[0]*q[0]+K[1]*q[1]+.05,K[1]*q[0]+K[2]*q[1]-.04];}
function terminal(q,t,p,K){
 const derivative=([x,y,v,w])=>{
  const [f0,f1]=torque(K,[x,y]);
  return [v,w,(f0-p.d0*v-(p.cross+p.skew)*w)/p.m0,(f1-(p.cross-p.skew)*v-p.d1*w)/p.m1];
 };
 let u=[...q,0,0];const steps=Math.max(1,Math.ceil(t/.0025)),dt=t/steps;
 const offset=(y,k,f)=>y.map((v,i)=>v+f*k[i]);
 for(let j=0;j<steps;j++){
  const a=derivative(u),b=derivative(offset(u,a,dt/2)),c=derivative(offset(u,b,dt/2)),d=derivative(offset(u,c,dt));
  u=u.map((v,i)=>v+dt*(a[i]+2*b[i]+2*c[i]+d[i])/6);
 }
 return u.slice(0,2);
}
function trial(seed){
 const rand=rng(seed),signed=seed%2?1:-1;
 const p={m0:1.7+.6*rand(),m1:1.7+.6*rand(),d0:.35+.2*rand(),d1:.5+.2*rand(),cross:.05+.06*rand(),skew:signed*(.22+.18*rand())};
 const K=[-1.6-.8*rand(),.25+.55*rand(),-1.2-.7*rand()];
 const response=createCouplingCourse('reciprocal'),velocity=createVelocityExample('two-frequency');
 for(const [i,r] of [...response.training,...response.challenges].entries()){
  r.torque=torque(K,r.q).map((v,j)=>v+.0005*Math.sin((i+1)*(j+1)*1.73));
 }
 for(const group of [velocity.training,velocity.challenge]){
  group.record.courses.forEach((course,c)=>{
   const freq=group===velocity.challenge?1.3:[.8,1.7][c];
   for(const row of course.rows){
    const [x,y]=row.position, v=-freq*y,w=freq*x;
    row.torque=[-p.m0*freq*freq*x+p.d0*v+(p.cross+p.skew)*w,-p.m1*freq*freq*y+(p.cross-p.skew)*v+p.d1*w];
   }
  });
 }
 const settings={...defaultReleaseSettings(),duration:2,samples:41,maxStep:.025};
 const res=proposeVelocityReleases({schema:VELOCITY_RELEASE_SCHEMA,response,velocity,settings});
 const selected=res.singleReading.selected;
 if(!selected) return {seed,status:res.singleReading.status};
 const uniformIndex=Math.floor(rand()*res.releases.length),uniformClock=1+Math.floor(rand()*(settings.samples-1));
 const sampled=(index,k)=>{
  const release=res.releases[index];assert.equal(release.status,'screened');
  return Math.min(...release.comparisons.map(pair=>pair.curve[k].separation));
 };
 const scores=res.releases.flatMap((r,i)=>r.status==='screened'?r.comparisons[0].curve.slice(1).map((_,k)=>sampled(i,k+1)):[]);
 assert.ok(Math.abs(Math.max(...scores)-selected.separation)<=1e-12);
 const settingsForFamily=res.training.families;
 const model=discoverCoupling(response.training,response.options).candidates.find(x=>x.id==='reciprocal');
 const noise=[0,1].map(()=>.025*(2*rand()-1));
 const arms={};
 for(const [arm,index,k] of [['active',selected.index,selected.sampleIndex],['first',0,settings.samples-1],['uniform',uniformIndex,uniformClock]]){
  const q=res.releases[index].position,t=res.releases[index].comparisons[0].curve[k].time,score=sampled(index,k);
  assert.ok(selected.separation+1e-12>=score);
  const predicted={};
  for(const family of ['diagonal','symmetric','skew']){
   const inputs=velocityReleaseDynamicsInputs(settingsForFamily[family],q,settings);
   const run=compareCoupledDynamics([model],inputs).results[0];assert.equal(run.status,'screened');
   predicted[family]=run.refined.rows[k].position;
  }
  const outcomes=[];
  for(const baseline of ['diagonal','symmetric']){
   for(const truth of [baseline,'skew']){
    const obs=terminal(q,t,{...p,skew:truth==='skew'?p.skew:0,cross:truth==='diagonal'?0:p.cross},K).map((v,i)=>v+noise[i]);
    const distance=family=>Math.hypot(...predicted[family].map((v,i)=>v-obs[i]));
    const margin=distance(baseline)-distance('skew');
    outcomes.push({baseline,truth,correct:truth==='skew'?margin>0:margin<0,margin});
   }
  }
  arms[arm]={index,k,t,score,outcomes};
 }
 return {seed,status:res.singleReading.status,signed,arms};
}
const rows=Array.from({length:30},(_,i)=>trial(12001+i));
console.log(JSON.stringify(rows));
