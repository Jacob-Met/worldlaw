import test from 'node:test';
import assert from 'node:assert/strict';
import {compareViscousStudy,readViscousStudy,exportViscousStudy,VISCOUS_RECORD_SCHEMA,VISCOUS_STUDY_SCHEMA,VISCOUS_INTERPRETATION} from '../src/coupling/viscous-comparison.mjs';
import {createViscousExample} from '../src/coupling/viscous-example.mjs';
import {createInertiaExample} from '../src/coupling/inertia-example.mjs';
import {identifyInertia} from '../src/coupling/inertia-identification.mjs';

// Independent held-aside analytic family; different frequencies, mixtures,
// sampling and coefficients from the user-facing authored example.
function course(m,d,{shift=0,origin=0}={}){
 const terms=[[[.51,1.37+shift,.27],[.16,2.71+shift*.4,1.12]],[[.43,1.91+shift*.7,1.41],[.24,3.53+shift*.2,.62]]];
 return {schema:VISCOUS_RECORD_SCHEMA,interpretation:VISCOUS_INTERPRETATION,units:{time:'s',position:'rad',torque:'N·m'},
  torqueDeclaration:'Analytic total force excluding viscous terms; no physical evidence.',
  source:{kind:'synthetic',label:'Held-aside motion '+shift,description:'Analytic multisine force; isolated coefficient controls.'},
  courses:[{id:'held-'+shift,rows:Array.from({length:1101},(_,i)=>{
   const t=i*.004;
   const q=terms.map(ts=>ts.reduce((s,[a,w,p])=>s+a*Math.sin(w*t+p),0));
   const v=terms.map(ts=>ts.reduce((s,[a,w,p])=>s+a*w*Math.cos(w*t+p),0));
   const acc=terms.map(ts=>ts.reduce((s,[a,w,p])=>s-a*w*w*Math.sin(w*t+p),0));
   return {time:t+origin,position:q,torque:[0,1].map(j=>m[j][0]*acc[0]+m[j][1]*acc[1]+d[j][0]*v[0]+d[j][1]*v[1])};
  })}]};
}
function study(m=[[1.61,.23],[.23,1.12]],d=[[.41,-.13],[-.13,.29]]){
 return {schema:VISCOUS_STUDY_SCHEMA,training:{record:course(m,d),settings:{windowSamples:101,stride:50}},
  challenge:{record:course(m,d,{shift:.47}),settings:{windowSamples:101,stride:50,toleranceNm:[.00001,.00001],correspondence:'Same authored matrices and coordinates; separate analytic frequency course.'}}};
}
function close(actual,expected,tolerance=2e-6){assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);}

test('unfamiliar analytic matrices recover one cross-loss coefficient and receive separate motions',()=>{
 for(let j=0;j<6;j++){
  const m=[[1.4+j*.17,.13-j*.025],[.13-j*.025,.9+j*.09]],c=(j%2?-1:1)*(.08+j*.011),d=[[.23+j*.032,c],[c,.41+j*.021]];
  const result=compareViscousStudy(study(m,d)),fit=result.symmetric.primary;
  assert.equal(fit.status,'candidate');assert.equal(fit.rank,6);
  const expected=[m[0][0],m[0][1],m[1][1],d[0][0],d[1][1],d[0][1]];
  fit.coefficients.forEach((x,i)=>close(x,expected[i]));
  assert.equal(result.challenge.symmetric.status,'within_declared_tolerance');
  assert.ok(result.challenge.diagonal.rmseNm>1000*result.challenge.symmetric.rmseNm);
  assert.equal(result.diagnostics.automaticallySelectedFamily,null);
 }
});

test('complete maintained diagonal fit is unchanged and no-cross data retains both explanations',()=>{
 const legacy=createInertiaExample(),expected=identifyInertia(legacy);
 const record={...structuredClone(legacy),schema:VISCOUS_RECORD_SCHEMA,interpretation:VISCOUS_INTERPRETATION,source:{kind:'synthetic',...legacy.source}};
 const result=compareViscousStudy({schema:VISCOUS_STUDY_SCHEMA,training:{record,settings:{windowSamples:81,stride:40}},challenge:null});
 assert.deepEqual(result.diagonal,expected);
 const independent=compareViscousStudy(createViscousExample('diagonal'));
 assert.equal(independent.challenge.diagonal.status,'within_declared_tolerance');
 assert.equal(independent.challenge.symmetric.status,'within_declared_tolerance');
 close(independent.symmetric.primary.coefficients[5],0,1e-7);
});

test('challenge values and declarations cannot alter either fitted training report',()=>{
 const original=study(),first=compareViscousStudy(original),changed=structuredClone(original);
 changed.challenge.record.source.label='New separately supplied response';
 changed.challenge.record.courses[0].rows.forEach((r,i)=>{r.torque=[r.torque[0]+.6*Math.sin(i*.031),r.torque[1]-.4];});
 changed.challenge.settings.toleranceNm=[0,0];
 const next=compareViscousStudy(changed);
 assert.deepEqual(next.diagonal,first.diagonal);assert.deepEqual(next.symmetric,first.symmetric);
 assert.equal(next.challenge.symmetric.status,'exceeds_declared_tolerance');
 assert.ok(next.challenge.symmetric.rmseNm>.1);
});

test('omitted and asymmetric forces remain failed explanations, not automatic adoption',()=>{
 const omitted=compareViscousStudy(createViscousExample('omitted'));
 assert.equal(omitted.challenge.diagonal.status,'exceeds_declared_tolerance');
 assert.equal(omitted.challenge.symmetric.status,'exceeds_declared_tolerance');
 const asymmetric=compareViscousStudy(study(undefined,[[.41,.21],[-.13,.29]]));
 assert.ok(asymmetric.symmetric.primary.meanTorqueBalanceRmse>.001);
 assert.notEqual(asymmetric.challenge.symmetric.status,'within_declared_tolerance');
 assert.equal(asymmetric.diagnostics.automaticallySelectedFamily,null);
});

test('indefinite unconstrained loss remains visible and cannot pass as a supported law',()=>{
 const result=compareViscousStudy(study(undefined,[[.2,.7],[.7,.3]]));
 assert.equal(result.symmetric.primary.status,'outside_supported_family');
 assert.match(result.symmetric.primary.refusal,/semidefinite/);
 assert.equal(result.symmetric.primary.coefficients.length,6);
 assert.equal(result.challenge.symmetric.status,'unsupported_training');
 assert.equal(result.challenge.symmetric.rmseNm,null);
});

test('unexcited motion retains refusal without invented coefficients or challenge success',()=>{
 const input=study();input.challenge=null;
 input.training.record.courses[0].rows.forEach(r=>{r.position=[.2+.1*r.time,-.3+.4*r.time];r.torque=[.1,.2];});
 const result=compareViscousStudy(input);
 assert.equal(result.symmetric.primary.status,'unidentified');assert.equal(result.symmetric.primary.coefficients,null);
 assert.ok(result.symmetric.primary.rank<6);assert.equal(result.diagonal.primary.status,'unidentified');
});

test('source-clock translation and conjugate coordinate scaling preserve the offered balance',()=>{
 const original=study(),changed=structuredClone(original),scale=[2,3];
 for(const input of [changed.training,changed.challenge])for(const c of input.record.courses)for(const r of c.rows){r.time+=10000;r.position=r.position.map((q,j)=>q*scale[j]+[.8,-.6][j]);r.torque=r.torque.map((t,j)=>t/scale[j]);}
 const a=compareViscousStudy(original),b=compareViscousStudy(changed);
 const divisors=[4,6,9,4,9,6];
 b.symmetric.primary.coefficients.forEach((x,i)=>close(x,a.symmetric.primary.coefficients[i]/divisors[i],2e-7));
 assert.equal(b.challenge.symmetric.status,'within_declared_tolerance');
});

test('source-only replay rederives results and refuses stored answers or repeated training',()=>{
 const input=study(),before=JSON.stringify(input),text=exportViscousStudy(input);
 assert.equal(JSON.stringify(input),before);assert.deepEqual(compareViscousStudy(text),compareViscousStudy(input));
 assert.deepEqual(Object.keys(JSON.parse(text)).sort(),['challenge','schema','training']);
 const injected=JSON.parse(text);injected.fittedCoefficients=[1,2,3];assert.throws(()=>readViscousStudy(injected),/unsupported/);
 const repeated=structuredClone(input);repeated.challenge.record=structuredClone(repeated.training.record);repeated.challenge.record.source.label='renamed';repeated.challenge.record.courses[0].id='also-renamed';repeated.challenge.record.courses[0].rows.forEach(r=>r.time+=100);
 assert.throws(()=>readViscousStudy(repeated),/repeats/);
});

test('aggregate quadrature refuses before a partial two-family/challenge transaction',()=>{
 const input=createViscousExample();input.training.settings.stride=4;input.challenge.settings.stride=4;
 assert.throws(()=>compareViscousStudy(input),e=>e.code==='work_limit'&&/complete two-family/.test(e.message));
 input.challenge=null;assert.ok(compareViscousStudy(input).diagnostics.reservedSegments<100000);
});

test('typed source boundaries refuse legacy ambiguity, getters, sparse rows and unsupported units',()=>{
 const old=createInertiaExample();assert.throws(()=>readViscousStudy(old),/unsupported/);
 for(const mutate of [s=>s.training.record.units.position='degrees',s=>s.training.record.source.kind='verified',s=>delete s.training.record.courses[0].rows[3],s=>s.challenge.settings.correspondence='']){
  const input=study();mutate(input);assert.throws(()=>readViscousStudy(input));
 }
 const input=study();Object.defineProperty(input.training.record,'source',{get(){throw new Error('accessor executed');},enumerable:true});
 assert.throws(()=>readViscousStudy(input),/cannot contain accessors/);
});
