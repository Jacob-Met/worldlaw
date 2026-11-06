#!/usr/bin/env node
// Reproduce a pinned research result; no product files are written or changed.
// Run: node --experimental-vm-modules scripts/diagnose-bounded-lm-spacing.mjs
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const root=path.resolve(process.env.WORLDLAW_RESEARCH_ROOT ?? fileURLToPath(new URL('..',import.meta.url)));
const SOURCE_BASE='0a7ba12e58d714a52fd8f5385b87a1a8600c927e';
const closure=new Map();
function sourceAt(file) {
  const relative=path.relative(root,file);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
  const text=execFileSync('git',['show',SOURCE_BASE+':'+relative],{cwd:root,encoding:'utf8'});
  closure.set(relative,sha(text));
  return text;
}
const helperPath=path.join(root,'src/science/bounded-lm.mjs');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const src=sourceAt(helperPath);
assert.equal(sha(src),'26536292d6fbdfc5bb26d7fa557fc01c6e80138c42d6b32b4d6cc947e9618a92');
async function loadActual(entry,override) {
 const context=vm.createContext({console,structuredClone,TextEncoder,TextDecoder,URL,URLSearchParams,performance});
 const cache=new Map();
 const get=file=>{
   if(cache.has(file))return cache.get(file);
   let text=sourceAt(file);
   if(file===helperPath&&override)text=override;
   const mod=new vm.SourceTextModule(text,{context,identifier:pathToFileURL(file).href,initializeImportMeta(meta,m){meta.url=m.identifier;}});
   cache.set(file,mod);return mod;
 };
 const module=get(path.join(root,entry));
 await module.link((specifier,referer)=>{
   if(!specifier.startsWith('.'))throw Error('Unexpected nonrelative import: '+specifier);
   return get(path.resolve(path.dirname(fileURLToPath(referer.identifier)),specifier));
 });
 await module.evaluate();
 return module.namespace;
}

const {fitLinearColumns}=await loadActual('src/science/linear-fit.mjs');
const makeHelper=(source,record)=>new Function('fitLinearColumns','record',source.replace("import {fitLinearColumns} from './linear-fit.mjs';","").replace('export function fitBoundedLM','function fitBoundedLM').replace('columns.push(column);','record({x,lo,hi,h,central,first:a[j],second:b[j],firstOffset:a[j]-x,secondOffset:b[j]-x,column:[...column]}); columns.push(column);')+';return fitBoundedLM;')(fitLinearColumns,record);
const oldColumn=`const column = plus.residuals.map((v, k) => central
        ? (v - other.residuals[k]) / (2 * h)
        : (4 * (v - best.residuals[k]) -
           (other.residuals[k] - best.residuals[k])) / (2 * h));`;
assert.equal(src.split(oldColumn).length,2);
const actualColumn=`const da=a[j]-x, db=b[j]-x;
      const magnitude=Math.max(Math.abs(da),Math.abs(db));
      const ua=da/magnitude, ub=db/magnitude;
      const wb=-ua/(ub-ua);
      const column = plus.residuals.map((v,k) => {
        if (central && da===-db) return (v-other.residuals[k])/(da-db);
        const sa=(v-best.residuals[k])/da;
        const sb=(other.residuals[k]-best.residuals[k])/db;
        return sa+wb*(sb-sa);
      });`;
const diagnosticSrc=src.replace(oldColumn,actualColumn);
const E=Number.EPSILON,M=Number.MIN_VALUE;
const cases=[
 {name:'central-odd-ulp',x:1+E,bounds:[1,1+4*E],f:x=>x,expected:1},
 {name:'central-reflected',x:-(1+E),bounds:[-(1+4*E),-1],f:x=>x,expected:1},
 {name:'lower-unequal-1-3',x:1+E,bounds:[1+E,1+7*E],f:x=>x,expected:1},
 {name:'lower-unequal-2-3',x:1,bounds:[1,1+6*E],f:x=>x,expected:1},
 {name:'upper-reflected-1-3',x:-(1+E),bounds:[-(1+7*E),-(1+E)],f:x=>x,expected:1},
 {name:'upper-reflected-2-3',x:-1,bounds:[-(1+6*E),-1],f:x=>x,expected:1},
 {name:'central-even-ulp-refusal',x:1+2*E,bounds:[1+E,1+4*E],f:x=>x,expected:1},
 {name:'only-two-representable-nodes',x:1,bounds:[1,1+E],f:x=>x,expected:1},
 {name:'subnormal-step-underflow',x:M,bounds:[0,4*M],f:x=>x,expected:1},
 {name:'ordinary-central-affine',x:.3,bounds:[-2,3],f:x=>2*x+1,expected:2},
 {name:'ordinary-lower-quadratic',x:1,bounds:[1,3],f:x=>x*x,expected:2}
];
function helperCase(c,source) {
 const traces=[],evaluations=[];
 const fit=makeHelper(source,t=>traces.push(t));
 const result=fit([c.x],[c.bounds],1,values=>{
   const residuals=[c.f(values[0])],v={index:evaluations.length,values:[...values],status:'complete',residuals,rmse:Math.abs(residuals[0])};
   evaluations.push(v); return v;
 });
 return {evaluations:evaluations.length,iterations:result.iterations,traces,best:{values:result.best.values,rmse:result.best.rmse}};
}
const helperCases=cases.map(c=>({name:c.name,expected:Number.isFinite(c.expected)?c.expected:'nonfinite analytic slope',baseline:helperCase(c,src),actualNodeDiagnostic:helperCase(c,diagnosticSrc)}));
const seed={schema:'worldlaw.angular-model/v1',id:'bias',terms:[{id:'bias',coefficient:1+E,coefficientUnit:'rad/s²'}],units:{position:'rad',rate:'rad/s',angularAcceleration:'rad/s²'},physicalInertia:null,absoluteTorqueIdentified:false,scaleMeaning:'angular_acceleration_only_absolute_torque_unknown'};
const rawRuns=[{id:'exact',kind:'synthetic',dynamics:'unforced_scalar_rotation',inertia:null,initialRate:0,source:{label:'Analytic constant acceleration'},samples:Array.from({length:5},(_,i)=>{const time=i/16;return {time,position:(1+4*E)*time*time/2};})}];
const options={iterations:1,maxStep:.0625,screen:.001,bounds:[[1,1+4*E]],maxTotalSteps:4000000};
const originalJSON=JSON.stringify({seed,rawRuns,options});
const baselineModule=await loadActual('src/trajectory-lm/fit.mjs');
const diagnosticModule=await loadActual('src/trajectory-lm/fit.mjs',diagnosticSrc);
const baseline=baselineModule.fitTrajectoryLM(seed,rawRuns,options);
const diagnostic=diagnosticModule.fitTrajectoryLM(seed,rawRuns,options);
assert.equal(JSON.stringify({seed,rawRuns,options}),originalJSON);
const compact=r=>({status:r.status,best:r.best,evaluations:r.trials.length,maximumEvaluations:r.maximumEvaluations,reservation:r.reservation,iterations:r.iterations});
for(const [file,digest] of closure) assert.equal(sha(execFileSync('git',['show','0a7ba12e58d714a52fd8f5385b87a1a8600c927e:'+file],{cwd:root})),digest,file);
assert.equal(baseline.trials.length,4);assert.equal(diagnostic.trials.length,4);
assert.equal(baseline.best.values[0],1+2*E);assert.equal(diagnostic.best.values[0],1+4*E);
assert.equal(diagnostic.best.rmse,0);

const wideRuns=structuredClone(rawRuns);
for(const row of wideRuns[0].samples)row.position=1.5*row.time*row.time/2;
wideRuns[0].source.label='Analytic constant acceleration in a wide coefficient interval';
const wideInputsJSON=JSON.stringify(wideRuns),wideCases=[];
for(const initialCoefficient of [1+E,1.1]) {
 for(const iterationBudget of [1,2,4,8]) {
  const selectedSeed=structuredClone(seed);
  selectedSeed.terms[0].coefficient=initialCoefficient;
  const selectedOptions={...options,iterations:iterationBudget,bounds:[[1,2]]};
  const before=JSON.stringify({seed:selectedSeed,rawRuns:wideRuns,options:selectedOptions});
  const base=baselineModule.fitTrajectoryLM(selectedSeed,wideRuns,selectedOptions);
  const actual=diagnosticModule.fitTrajectoryLM(selectedSeed,wideRuns,selectedOptions);
  assert.equal(JSON.stringify({seed:selectedSeed,rawRuns:wideRuns,options:selectedOptions}),before);
  assert.equal(JSON.stringify(base.reservation),JSON.stringify(actual.reservation));
  assert.equal(base.maximumEvaluations,actual.maximumEvaluations);
  assert.ok(base.trials.length<=base.maximumEvaluations && actual.trials.length<=actual.maximumEvaluations);
  wideCases.push({initialCoefficient,iterationBudget,baseline:compact(base),actualNodeDiagnostic:compact(actual)});
 }
}
assert.equal(JSON.stringify(wideRuns),wideInputsJSON);

const receipt={sourceBase:'0a7ba12e58d714a52fd8f5385b87a1a8600c927e',allSourcesReadFromGitBase:true,schema:'worldlaw.representable-probe-investigation/v1',runtime:process.version,helperSHA256:sha(src),diagnosticHelperSHA256:sha(diagnosticSrc),sourceClosure:[...closure].map(([file,sha256])=>({path:file,sha256})),helperCases,wideIntervalExperiment:{inputs:{rawRuns:wideRuns,baseSeed:seed,baseOptions:{...options,bounds:[[1,2]]},initialCoefficients:[1+E,1.1],iterationBudgets:[1,2,4,8]},inputUnchanged:true,cases:wideCases,interpretation:'Early finite-budget sensitivity on an authored wide interval. Additional iterations can recover the same optimum; not a general speed or physical-accuracy claim.'},consumer:{inputs:{seed,rawRuns,options},inputSHA256:sha(originalJSON),inputUnchanged:true,baseline:compact(baseline),actualNodeDiagnostic:compact(diagnostic)},limits:['No product source file changed. Diagnostic actual-node expression only, not a proposed complete production implementation.','Refusals from collapsed nominal probes remain unchanged.','The tiny-box consumer witness is rounding-scale. The separate wide-interval witness tests finite iteration budgets; no general practical scientific-impact claim.','The diagonal/control comparisons do not certify derivative accuracy for numerically unresolved residuals.']};
console.log(JSON.stringify(receipt));
