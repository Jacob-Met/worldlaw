/** Fixed-design synthetic and reused physical ablation; no challenge-based tuning. */
import {readFileSync,writeFileSync} from 'node:fs';
import {gravityRun} from './integral-discovery-92be.mjs';
import {DEFAULT_ANGULAR_TERMS} from '../src/trajectory/angular-discovery.mjs';
import {investigateAngleReference} from '../src/representation/angle-reference.mjs';
const terms=[...DEFAULT_ANGULAR_TERMS,'cubic'];
function summarize(r){const s=r.search;return {selectedOffset:s.selected.offset,model:s.selected.model.id,terms:s.selected.model.terms,status:s.status,noiseResidual:s.selected.fitDiagnostics.trainingRmseInNoiseUnits,identifiability:s.selected.fitDiagnostics.identifiability,competitiveOffsets:s.competitiveOffsets,withoutCubic:{offset:r.libraryBaseline.selected.offset,model:r.libraryBaseline.selected.model.id,status:r.libraryBaseline.status},predictions:r.comparisons.map(p=>({runId:p.runId,...Object.fromEntries(['selected','withoutCubic'].map(k=>[k,p[k].error?{error:p[k].error}:{rmse:p[k].rollout.metrics.positionRMSE,finalError:p[k].rollout.metrics.finalPositionError,numericalDifference:p[k].resolution.maxAbsPositionDifference}]))}))};}
const cases=[];
for(const cubic of [0,.4,1.2])for(const sigma of [0,.001])for(const amplitude of [.05,1.5]){
 const make=(id,position,seed)=>{const r=gravityRun({id,position,cubic,sigma,seed,dt:.02});return {...r,inertia:null,dynamics:'unforced_scalar_rotation',samples:r.samples.map(({time,position})=>({time,position}))};};
 const bundle={schema:'worldlaw.angular-bundle/v1',label:'Declared independent nonlinear oracle',units:{time:'s',position:'rad',initialRate:'rad/s'},trainingRuns:[make('a',amplitude,123),make('b',-.87*amplitude,234)],challengeRuns:[make('c',2.1,456)]};
 const settings={offsets:[-.3,-.15,0,.15,.3],fit:{terms,noiseSigma:Math.max(.0001,sigma)}};
 cases.push({cubic,sigma,amplitude,settings,result:summarize(investigateAngleReference(bundle,settings))});
}
const physicalBundle=JSON.parse(readFileSync(new URL('../examples/physical-pasco-92be.json',import.meta.url))),physicalSettings={offsets:Array.from({length:21},(_,i)=>(i-10)/20),fit:{terms,noiseSigma:.01}};
const output={method:'Same declared evidence, grid, noise and maximum term count; each library freezes its training winner before evaluating challenge positions.',limits:['Synthetic truth is independently integrated, but within the offered extended model class.','Small-amplitude training with large-amplitude challenge intentionally tests unsupported extrapolation.','PASCO is a repeatedly reused exploratory benchmark, not blind validation.','Cubic law is origin-dependent and does not identify physical inertia, torque, calibration or mechanism.'],cases,physical:{settings:physicalSettings,result:summarize(investigateAngleReference(physicalBundle,physicalSettings))}};
writeFileSync(new URL('../evidence/cubic-restoring-results.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({cases:cases.map(c=>({cubic:c.cubic,sigma:c.sigma,amplitude:c.amplitude,model:c.result.model,rmse:c.result.predictions[0]})),physical:output.physical.result},null,2));
