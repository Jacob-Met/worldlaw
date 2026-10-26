import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultDynamicsInputs,readDynamicsInputs,compareCoupledDynamics,createCoupledDynamicsStudy,readDynamicsNotebook,exportDynamicsNotebook,MATRIX_INPUT_SCHEMA,MATRIX_INTERPRETATION,LOSS_INPUT_SCHEMA,LOSS_INTERPRETATION} from '../src/coupling/dynamics.mjs';
import {deriveCoupledModes,transformModeRow} from '../src/coupling/modes.mjs';
import {readSymmetricDamping} from '../src/coupling/damping.mjs';
import {compareViscousStudy} from '../src/coupling/viscous-comparison.mjs';
import {createViscousExample} from '../src/coupling/viscous-example.mjs';
import {createCouplingCourse} from '../src/coupling/virtual-instrument.mjs';

const model=(matrix=[[-2,.4],[.4,-3]],bias=[0,0],id='reciprocal')=>({schema:'worldlaw.coupled-torque-model/v1',id,matrix,bias});
const inputs=(extra={})=>({...defaultDynamicsInputs(),schema:LOSS_INPUT_SCHEMA,interpretation:LOSS_INTERPRETATION,inertia:[1.7,.9],inertiaCross:-.31,damping:[.42,.23],dampingCross:.17,initialPosition:[.63,-.27],initialRate:[.2,-.4],duration:3,samples:101,maxStep:.003,...extra});
const close=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<=tol,`${a} differs from ${b} by ${Math.abs(a-b)}`);
const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),mv=(a,b)=>a.map(r=>dot(r,b));
const mm=(a,b)=>a.map(r=>b[0].map((_,j)=>dot(r,b.map(c=>c[j]))));
const eye=n=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>Number(i===j)));
const add=(a,b)=>a.map((r,i)=>r.map((x,j)=>x+b[i][j]));
const scale=(a,x)=>a.map(r=>r.map(v=>v*x));

// Independent constant-system oracle: Taylor matrix exponential with scaling
// and squaring. No product RK4, mass factorization or mode transform is used.
function exponential(a,t){
 const norm=Math.max(...a.map(r=>r.reduce((s,x)=>s+Math.abs(x),0)))*Math.abs(t);
 const squarings=Math.max(0,Math.ceil(Math.log2(Math.max(1,norm*2))));
 const x=scale(a,t/2**squarings);let sum=eye(a.length),term=eye(a.length);
 for(let k=1;k<=40;k++){term=scale(mm(term,x),1/k);sum=add(sum,term);}
 for(let k=0;k<squarings;k++)sum=mm(sum,sum);
 return sum;
}
function oracle(m,p,t){
 const [a,b]=p.inertia,c=p.inertiaCross,det=a*b-c*c,inverse=[[b/det,-c/det],[-c/det,a/det]];
 const d=[[p.damping[0],p.dampingCross],[p.dampingCross,p.damping[1]]];
 const k=mm(inverse,m.matrix),loss=mm(inverse,d),bias=mv(inverse,m.bias);
 const system=[[0,0,1,0,0],[0,0,0,1,0],[...k[0],...loss[0].map(x=>-x),bias[0]],[...k[1],...loss[1].map(x=>-x),bias[1]],[0,0,0,0,0]];
 return mv(exponential(system,t),[...p.initialPosition,...p.initialRate,1]).slice(0,4);
}
function oscillator(q,v,m,d,k,t){
 const alpha=d/(2*m),omega=Math.sqrt(k/m-alpha*alpha),b=(v+alpha*q)/omega;
 const position=Math.exp(-alpha*t)*(q*Math.cos(omega*t)+b*Math.sin(omega*t));
 const rate=-alpha*position+Math.exp(-alpha*t)*(-q*omega*Math.sin(omega*t)+b*omega*Math.cos(omega*t));
 return [position,rate];
}

test('both cross-loss signs follow independent closed-form damped sum/difference oscillators',()=>{
 for(const cross of [.31,-.31,0]){
  const p=inputs({inertia:[1.8,1.8],inertiaCross:.2,damping:[.6,.6],dampingCross:cross,duration:5,samples:151}),m=model([[-2.4,.5],[.5,-2.4]]);
  const run=compareCoupledDynamics([m],p);assert.equal(run.results[0].status,'screened');assert.equal(run.schema,'worldlaw.coupling-dynamics-comparison/v3');
  for(const row of run.results[0].refined.rows){
   const plus=oscillator((p.initialPosition[0]+p.initialPosition[1])/2,(p.initialRate[0]+p.initialRate[1])/2,2,.6+cross,1.9,row.time);
   const minus=oscillator((p.initialPosition[0]-p.initialPosition[1])/2,(p.initialRate[0]-p.initialRate[1])/2,1.6,.6-cross,2.9,row.time);
   for(let axis=0;axis<2;axis++){close(row.position[axis],plus[0]+(axis?-1:1)*minus[0],2e-10);close(row.rate[axis],plus[1]+(axis?-1:1)*minus[1],2e-10);}
  }
 }
});
test('unfamiliar noncommuting inertia/loss systems agree with independent matrix-exponential trajectories',()=>{
 const cases=[{}, {inertia:[.8,2.3],inertiaCross:.27,damping:[.12,.8],dampingCross:-.19,initialPosition:[-.2,.84],initialRate:[.55,.13]}, {inertia:[3.2,1.1],inertiaCross:-.72,damping:[.8,.8],dampingCross:.8,initialPosition:[.9,-.6]}];
 for(const extra of cases){
  const p=inputs(extra),m=model([[-2.1,.37],[.37,-3.4]],[.21,-.13]);
  const run=compareCoupledDynamics([m],p).results[0];assert.equal(run.status,'screened');
  for(const row of run.refined.rows.filter((_,i)=>i%10===0)){
   const expected=oracle(m,p,row.time);[...row.position,...row.rate].forEach((x,i)=>close(x,expected[i],3e-9));
  }
 }
});
test('zero cross loss preserves complete v2 numerical trajectories and mode coordinates exactly',()=>{
 for(const cross of [-.31,0,.31]){
  const p=inputs({inertiaCross:cross,dampingCross:0}),old={...p,schema:MATRIX_INPUT_SCHEMA,interpretation:MATRIX_INTERPRETATION};delete old.dampingCross;
  const m=model();assert.deepEqual(compareCoupledDynamics([m],p).results,compareCoupledDynamics([m],old).results);
  assert.deepEqual(deriveCoupledModes(m,p),deriveCoupledModes(m,old));
 }
});
test('conditional mechanical energy decreases by the independently integrated quadratic loss',()=>{
 const p=inputs({duration:4,samples:1001,maxStep:.002,dampingCross:-.2}),m=model([[-2.3,.2],[.2,-1.7]]),mass=[[p.inertia[0],p.inertiaCross],[p.inertiaCross,p.inertia[1]]],d=[[p.damping[0],p.dampingCross],[p.dampingCross,p.damping[1]]];
 const rows=compareCoupledDynamics([m],p).results[0].refined.rows;
 const energy=r=>.5*dot(r.rate,mv(mass,r.rate))-.5*dot(r.position,mv(m.matrix,r.position));
 let integrated=0,previous=energy(rows[0]);
 for(let i=1;i<rows.length;i++){
  const current=energy(rows[i]);assert.ok(current<=previous+1e-11);previous=current;
  integrated+=(rows[i].time-rows[i-1].time)/2*(dot(rows[i].rate,mv(d,rows[i].rate))+dot(rows[i-1].rate,mv(d,rows[i-1].rate)));
 }
 close(energy(rows[0])-energy(rows.at(-1)),integrated,4e-6);assert.ok(energy(rows.at(-1))<energy(rows[0])*.7);
});
test('generalized modes transform the full loss while preserving power and acceleration',()=>{
 const p=inputs(),m=model(),mode=deriveCoupledModes(m,p),rows=compareCoupledDynamics([m],p).results[0].refined.rows;
 const d=[[p.damping[0],p.dampingCross],[p.dampingCross,p.damping[1]]],det=p.inertia[0]*p.inertia[1]-p.inertiaCross**2;
 const inverse=[[p.inertia[1]/det,-p.inertiaCross/det],[-p.inertiaCross/det,p.inertia[0]/det]];
 for(const row of rows){
  const z=transformModeRow(mode,row),drag=mv(d,row.rate),acceleration=mv(inverse,row.torque.map((x,i)=>x-drag[i]));
  const transformed=transformModeRow(mode,{...row,position:acceleration}).position;
  const predicted=mv(mode.stiffness,z.position).map((x,i)=>x+mode.bias[i]-dot(mode.damping[i],z.rate));
  predicted.forEach((x,i)=>close(x,transformed[i],1e-12));
  close(dot(row.rate,drag),dot(z.rate,mv(mode.damping,z.rate)),1e-12);
 }
 const directional=model([[-2,.4],[.3,-3]],[0,0],'directional');
 assert.equal(deriveCoupledModes(directional,p).status,'asymmetric');assert.equal(compareCoupledDynamics([directional],p).results[0].status,'screened');
});
test('PSD/version/work boundaries refuse and numerical failures never become successful motion',()=>{
 for(const cross of [.4,-.4,NaN,Infinity,undefined,'0.17'])assert.throws(()=>readDynamicsInputs(inputs({dampingCross:cross})));
 for(const diag of [[0,.2],[.2,0],[-.2,.3]])assert.throws(()=>readDynamicsInputs(inputs({damping:diag})));
 assert.equal(readSymmetricDamping(0,0,0).minimumEigenvalue,0);assert.equal(readSymmetricDamping(.5,.5,-.5).minimumEigenvalue,0);assert.equal(readSymmetricDamping(.8,.8,.8).minimumEigenvalue,0);
 assert.throws(()=>readSymmetricDamping(.8,.8,.8000000001),/semidefinite/);
 assert.throws(()=>readDynamicsInputs({...defaultDynamicsInputs(),dampingCross:0}),/unknown fields/);
 assert.throws(()=>readDynamicsInputs({...inputs(),schema:MATRIX_INPUT_SCHEMA,interpretation:MATRIX_INTERPRETATION}),/unknown fields/);
 assert.throws(()=>readDynamicsInputs(inputs({interpretation:MATRIX_INTERPRETATION})),/interpretation/);
 assert.throws(()=>compareCoupledDynamics([model()],inputs({maxStep:1e-8})),/complete.*steps/);
 const failed=compareCoupledDynamics([model()],inputs({damping:[1e6,1e6],dampingCross:1e6,maxStep:.1})).results[0];
 assert.equal(failed.status,'failed');assert.equal(failed.refined,null);assert.equal(failed.screen,null);
});
test('training-inferred symmetric loss predicts unfamiliar initial states while the diagonal alternative diverges',t=>{
 const source=createViscousExample('cross'),fits=compareViscousStudy(source),m=model([[-1.6,.28],[.28,-2.1]]);
 const truth=inputs({inertia:[1.8,1.25],inertiaCross:.32,damping:[.35,.52],dampingCross:.19,initialPosition:[-.41,.76],initialRate:[.33,-.24],duration:4});
 const learned=inputs({...truth,...fits.symmetric.primary.simulationParameters});
 const diagonal=inputs({...truth,...fits.diagonal.primary.simulationParameters,dampingCross:0});
 const a=compareCoupledDynamics([m],learned).results[0],b=compareCoupledDynamics([m],diagonal).results[0];
 let good=0,bad=0;
 for(let i=0;i<a.refined.rows.length;i++){
  const expected=oracle(m,truth,a.refined.rows[i].time);
  for(let axis=0;axis<2;axis++){good=Math.max(good,Math.abs(a.refined.rows[i].position[axis]-expected[axis]));bad=Math.max(bad,Math.abs(b.refined.rows[i].position[axis]-expected[axis]));}
 }
 assert.ok(good<2e-7,`learned error ${good}`);assert.ok(bad>.01,`wrong-loss error ${bad}`);
 t.diagnostic(JSON.stringify({maximumAngleErrorRad:{symmetric:good,diagonal:bad},samples:a.refined.rows.length,initialPosition:truth.initialPosition,initialRate:truth.initialRate}));
 const changed=structuredClone(source);changed.challenge.record.courses[0].rows.forEach(r=>r.torque[0]+=.8);
 assert.deepEqual(compareViscousStudy(changed).symmetric.primary.simulationParameters,fits.symmetric.primary.simulationParameters);
});
test('v3 source-only motion replay recomputes while later evidence cannot refit the trajectory',()=>{
 const evidence=createCouplingCourse(),p=inputs(),before=JSON.stringify({evidence,p}),study=createCoupledDynamicsStudy(evidence,p);
 const raw=JSON.parse(exportDynamicsNotebook(evidence,p));assert.equal(raw.schema,'worldlaw.coupling-dynamics-notebook/v3');
 assert.deepEqual(Object.keys(raw).sort(),['evidence','inputs','schema']);assert.equal(raw.inputs.dampingCross,.17);
 const replay=readDynamicsNotebook(raw);assert.deepEqual(createCoupledDynamicsStudy(replay.evidence,replay.inputs),study);
 for(const version of ['v1','v2'])assert.throws(()=>readDynamicsNotebook({...raw,schema:'worldlaw.coupling-dynamics-notebook/'+version}),/versions/);
 assert.throws(()=>readDynamicsNotebook({...raw,trajectory:study.results}),/unknown fields/);
 const changed=structuredClone(evidence);changed.challenges=changed.challenges.map((r,i)=>({...r,torque:[800+i,-300-i]}));
 assert.deepEqual(createCoupledDynamicsStudy(changed,p).results,study.results);assert.equal(JSON.stringify({evidence,p}),before);
});
