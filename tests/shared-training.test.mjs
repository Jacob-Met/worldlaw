import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareSharedTraining,makeSharedCertificate,checkSharedTrainingCertificate} from '../src/science/shared-training-check.mjs';
import {searchSharedTraining} from '../src/science/shared-training-search.mjs';
import {predictionContrasts} from '../src/science/prediction-contrast.mjs';
import {fitLinearColumns} from '../src/science/linear-fit.mjs';
const model={schema:'worldlaw.torque-model/v1',terms:[{id:'spring',coefficient:0},{id:'bias',coefficient:0}]};
const row=(position,jointTorque=0)=>({command:0,position,rate:0,jointTorque});
const training=[-1,1].flatMap(x=>Array.from({length:4},()=>row(x)));
const bad=[row(-1,-.5),row(0,.5),row(1,-.5)];
const good=[row(-1,-.3),row(0,.2),row(1,.7)];
const exact={trainingRadius:1,receivingRadius:0},noisy={trainingRadius:1,receivingRadius:.01};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function certificate(m,t,q,options,kind,values){return makeSharedCertificate(prepareSharedTraining(m,t,q,options),kind,values);}
test('whole-course separator resolves affine contradiction missed by all marginal and pair tests',()=>{
 const pair=predictionContrasts(model,training,bad,exact);assert.equal(pair.marginal.outsideCount,0);assert.equal(pair.outsideCount,0);
 const result=searchSharedTraining(model,training,bad,exact);assert.equal(result.status,'verified-separation');assert.equal(result.check.receivingCount,3);assert.ok(result.check.gap>result.check.numericalTolerance);
 const replay=checkSharedTrainingCertificate(model,training,bad,exact,result.certificate);assert.deepEqual(replay,result.check);
});
test('independent analytic three-point separator has zero training support and positive discrepancy',()=>{
 const c=certificate(model,training,bad,exact,'receiving-separator',[-.5,1,-.5]);
 const r=checkSharedTrainingCertificate(model,training,bad,exact,c);assert.equal(r.status,'verified-separation');close(r.discrepancy,1);close(r.trainingSupport,0);close(r.receivingSupport,0);close(r.gap,1);assert.equal(r.trainingProjection.length,8);
});
test('supplied interior offsets are checked by independent maintained refit across every receiving row',()=>{
 const offsets=[...Array(4).fill(-.3),...Array(4).fill(.7)],c=certificate(model,training,good,noisy,'training-offsets',offsets);
 const result=checkSharedTrainingCertificate(model,training,good,noisy,c);assert.equal(result.status,'verified-interior-witness');assert.equal(result.rows.length,3);close(result.refittedCoefficients[0],.5);close(result.refittedCoefficients[1],.2);
 assert.ok(result.rows.every(r=>r.strictInterior&&r.refitMargin>r.numericalTolerance&&r.linearMargin>r.numericalTolerance));
});
test('bounded search finds a separately replayed interior witness without changing source or fit',()=>{
 const before=JSON.stringify({model,training,good});const result=searchSharedTraining(model,training,good,noisy);assert.equal(result.status,'verified-interior-witness');assert.ok(result.iterationsPerformed>0);assert.ok(result.certificate.values.every(x=>Math.abs(x)<=1));
 assert.deepEqual(checkSharedTrainingCertificate(model,training,good,noisy,result.certificate),result.check);assert.equal(JSON.stringify({model,training,good}),before);
});
test('arbitrary receiving contrast support equals full 256-corner oracle',()=>{
 const weights=[.2,-.4,.9],options={trainingRadius:1,receivingRadius:.03},c=certificate(model,training,bad,options,'receiving-separator',weights);
 const checked=checkSharedTrainingCertificate(model,training,bad,options,c);let maximum=-Infinity;
 for(let mask=0;mask<256;mask++){
  const target=training.map((_,i)=>((mask>>i)&1)?1:-1),fit=fitLinearColumns([training.map(r=>r.position),training.map(()=>1)],target);
  const value=bad.reduce((sum,r,j)=>sum+weights[j]*(fit.coefficients[0]*r.position+fit.coefficients[1]),0);maximum=Math.max(maximum,value);
 }
 close(maximum,checked.trainingSupport);close(checked.receivingSupport,.03*1.5);close(checked.support,maximum+.045);
});
test('checker rejects stale source binding and independently recomputes re-keyed bad vectors',()=>{
 const c=certificate(model,training,good,noisy,'training-offsets',[...Array(4).fill(-.3),...Array(4).fill(.7)]);
 assert.throws(()=>checkSharedTrainingCertificate(model,training,good,{...noisy,receivingRadius:.02},c),/changed/);
 assert.throws(()=>checkSharedTrainingCertificate({...model,terms:[{id:'spring',coefficient:1},{id:'bias',coefficient:0}]},training,good,noisy,c),/changed/);
 const changed=good.map(r=>({...r,jointTorque:r.jointTorque+10}));assert.throws(()=>checkSharedTrainingCertificate(model,training,changed,noisy,c),/changed/);
 const rebound={...c,sourceKey:prepareSharedTraining(model,training,changed,noisy).sourceKey,claimedStatus:'verified-interior-witness'};assert.equal(checkSharedTrainingCertificate(model,training,changed,noisy,rebound).status,'unresolved');
 assert.throws(()=>checkSharedTrainingCertificate(model,training,good,noisy,{...c,values:Array(8).fill(2)}),/bound/);
 assert.throws(()=>checkSharedTrainingCertificate(model,training,good,noisy,{...c,values:[0]}),/every/);
});
test('separator always uses original receiving radius rather than search inset',()=>{
 const zero={schema:'worldlaw.torque-model/v1',terms:[]},t=Array.from({length:8},()=>row(0)),q=[row(0,.75)],options={trainingRadius:0,receivingRadius:1};
 const c=certificate(zero,t,q,options,'receiving-separator',[1]),check=checkSharedTrainingCertificate(zero,t,q,options,c);
 assert.equal(check.status,'unresolved');close(check.receivingSupport,1);close(check.gap,-.25);
 assert.equal(searchSharedTraining(zero,t,q,options).status,'verified-interior-witness');
});
test('zero-radius contact and finite receiving-boundary contact do not become positive feasibility claims',()=>{
 const constant={schema:'worldlaw.torque-model/v1',terms:[{id:'bias',coefficient:1}]},t=Array.from({length:8},()=>row(0,1)),q=[row(1,1),row(2,1)],options={trainingRadius:0,receivingRadius:0};
 const c=certificate(constant,t,q,options,'training-offsets',Array(8).fill(0));assert.equal(checkSharedTrainingCertificate(constant,t,q,options,c).status,'unresolved');assert.equal(searchSharedTraining(constant,t,q,options).status,'unresolved');
 const zero={schema:'worldlaw.torque-model/v1',terms:[]},zt=Array.from({length:8},()=>row(0)),zq=[row(0,.1)],zo={trainingRadius:0,receivingRadius:.1};
 const boundary=certificate(zero,zt,zq,zo,'training-offsets',Array(8).fill(0));assert.equal(checkSharedTrainingCertificate(zero,zt,zq,zo,boundary).status,'unresolved');assert.equal(searchSharedTraining(zero,zt,zq,zo).status,'unresolved');
});
test('iteration and matrix budgets refuse completeness without selecting rows',()=>{
 const iterations=searchSharedTraining(model,training,good,{...noisy,maxIterations:0});assert.equal(iterations.status,'unresolved');assert.equal(iterations.reason,'iteration-budget');assert.equal(iterations.marginal.receivingCount,3);
 const products=searchSharedTraining(model,training,good,{...noisy,maxProducts:1});assert.equal(products.status,'unresolved');assert.equal(products.reason,'matrix-work-budget');assert.equal(products.matrixTermsUsed,0);
 for(const extra of [{maxIterations:-1},{maxIterations:true},{maxIterations:4097},{maxProducts:67108865},{other:1}])assert.throws(()=>searchSharedTraining(model,training,good,{...noisy,...extra}));
});
test('source-row permutation preserves independently recomputed separating meaning',()=>{
 const v=[-.5,1,-.5],first=checkSharedTrainingCertificate(model,training,bad,exact,certificate(model,training,bad,exact,'receiving-separator',v));
 const t=[...training].reverse(),q=[...bad].reverse(),second=checkSharedTrainingCertificate(model,t,q,exact,certificate(model,t,q,exact,'receiving-separator',[...v].reverse()));
 assert.equal(second.status,first.status);close(second.gap,first.gap);close(second.support,first.support);
});
test('common receiving offset may have a shared witness or a separating contrast depending on original bounds',()=>{
 const constant={schema:'worldlaw.torque-model/v1',terms:[{id:'bias',coefficient:0}]},t=Array.from({length:8},()=>row(0)),options={trainingRadius:.2,receivingRadius:.01};
 assert.equal(searchSharedTraining(constant,t,[row(0,.1),row(1,.1)],options).status,'verified-interior-witness');
 assert.equal(searchSharedTraining(constant,t,[row(0,1),row(1,1)],options).status,'verified-separation');
});
test('maximum source course remains whole even when no search is affordable',()=>{
 const zero={schema:'worldlaw.torque-model/v1',terms:[]},t=Array.from({length:256},()=>row(0)),q=Array.from({length:128},(_,i)=>row(i,i===127?2:0)),options={trainingRadius:0,receivingRadius:.1};
 const refused=searchSharedTraining(zero,t,q,{...options,maxProducts:0});assert.equal(refused.status,'unresolved');assert.equal(refused.marginal.receivingCount,128);assert.equal(refused.matrixTermsUsed,0);
 const v=Array(128).fill(0);v[127]=1;const checked=checkSharedTrainingCertificate(zero,t,q,options,certificate(zero,t,q,options,'receiving-separator',v));assert.equal(checked.status,'verified-separation');assert.equal(checked.receivingCount,128);assert.equal(checked.weights.length,128);assert.equal(checked.trainingProjection.length,256);close(checked.gap,1.9);
});
test('rank and malformed certificates remain explicit',()=>{
 const rank=searchSharedTraining(model,training.map(r=>({...r,position:0})),good,noisy);assert.equal(rank.status,'unresolved');assert.equal(rank.reason,'rank-unavailable');
 const c=certificate(model,training,bad,exact,'receiving-separator',[-.5,1,-.5]);
 for(const values of [[0,0,0],[NaN,1,0],[2,0,0]])assert.throws(()=>checkSharedTrainingCertificate(model,training,bad,exact,{...c,values}));
 assert.throws(()=>searchSharedTraining(model,training,good,{trainingRadius:null}));
});

test('training-box boundary offsets remain admissible while receiving-box contact stays unresolved',()=>{
 const constant={schema:'worldlaw.torque-model/v1',terms:[{id:'bias',coefficient:0}]};
 const t=Array.from({length:8},()=>row(0));
 const options={trainingRadius:.2,receivingRadius:.01};
 for(const sign of [-1,1]){
  const offsets=Array(8).fill(sign*.2),q=[row(-1,sign*.2),row(1,sign*.2)];
  const c=certificate(constant,t,q,options,'training-offsets',offsets);
  const accepted=checkSharedTrainingCertificate(constant,t,q,options,c);
  assert.equal(accepted.status,'verified-interior-witness');
  assert.deepEqual(accepted.offsets,offsets);
  assert.ok(accepted.rows.every(r=>r.strictInterior&&r.refitMargin>r.numericalTolerance&&r.linearMargin>r.numericalTolerance));
  close(accepted.refittedCoefficients[0],sign*.2);
  const outside={...c,values:[...offsets]};outside.values[0]=sign*(.2+Number.EPSILON);
  assert.throws(()=>checkSharedTrainingCertificate(constant,t,q,options,outside),/bound/);
  const contact=[row(-1,sign*.21),row(1,sign*.21)];
  const contactCertificate=certificate(constant,t,contact,options,'training-offsets',offsets);
  const unresolved=checkSharedTrainingCertificate(constant,t,contact,options,contactCertificate);
  assert.equal(unresolved.status,'unresolved');
  assert.ok(unresolved.rows.every(r=>!r.strictInterior));
 }
});
