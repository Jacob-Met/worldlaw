/** One training acquisition per predeclared arm on the original development physics. */
import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {developmentTrainingInstrument} from './continuous-law-course.mjs';
import {commandSamples,receiveContinuousRun} from '../src/trajectory/controlled-instrument.mjs';
import {rollout} from '../src/trajectory/forward.mjs';
import {discoverWeak} from '../src/trajectory/weak-discovery.mjs';
import assert from 'node:assert/strict';

const root=new URL('../docs/receipts/position-output-development/',import.meta.url);
const prereg=JSON.parse(readFileSync(new URL('interior-actuator-excitation.json',root)));
const seedMaterial='worldlaw-development-interior-acquisition/v1:1006';
const sha=x=>createHash('sha256').update(x).digest('hex');
const seal=x=>sha(JSON.stringify(x));

export function frozenForecasts(){
  return prereg.arms.filter(a=>a.arm!=='unit').map(a=>{
    const request={...prereg.analytic.request,segments:a.segments};
    const {samples}=commandSamples(request);
    const input={id:'future',label:'prospective',kind:'unknown',source:{label:'request'},inertia:request.inertia,
      initialRate:request.initialRate,samples:samples.map(s=>({...s,position:request.initialPosition}))};
    return {arm:a.arm,request,rivals:prereg.models.map(m=>({id:m.id,
      positions:rollout(m,input,{maxStep:.005}).rows.slice(1).map(z=>z.predicted)}))};
  });
}
export function scoreMeasured(pre,raw){
  const sourceId='wlcv1-development-1006-interior-comparison-'+pre.arm;
  const observed=receiveContinuousRun(pre.request,raw,{expectedSourceId:sourceId});
  const scores=pre.rivals.map(r=>{
    assert.equal(r.positions.length,observed.samples.length-1);
    const e=r.positions.map((q,i)=>q-observed.samples[i+1].position);
    return {id:r.id,rms:Math.hypot(...e)/Math.sqrt(e.length),peak:Math.max(...e.map(Math.abs))};
  });
  const first=scores[0].rms,second=scores[1].rms;
  return {scores,selected:first===second?null:scores[first<second?0:1].id};
}
export function runCourse(training,dir){
  assert.deepEqual(training.map(x=>x.id),prereg.trainingIds);
  const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?
    '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
  assert.equal(sha(canonical(training)),'1417f7fc8d409fc6129677d3fc56fad54cd5f18d00d5f6cf77a1a866ffcacffe',
    'Training recordings differ from the three archived source inputs');
  const fit=discoverWeak(training,prereg.fitOptions);
  for(const expected of prereg.models){
    const actual=fit.candidates.find(x=>x.id===expected.id);
    assert.deepEqual(actual.terms.map(t=>t.id),expected.terms.map(t=>t.id));
    actual.terms.forEach((t,i)=>assert.ok(Math.abs(t.coefficient-expected.terms[i].coefficient)<1e-12));
  }
  mkdirSync(dir);
  const save=(file,x)=>writeFileSync(join(dir,file),JSON.stringify(x,null,2)+'\n',{flag:'wx',flush:true});
  const pre=frozenForecasts();
  save('forecast-seal.json',{preregistration:194490,forecastsSHA256:seal(pre),arms:pre.map(p=>p.arm)});
  const noiseSeed=Number.parseInt(sha(seedMaterial).slice(0,8),16);
  const results=[];
  for(const arm of pre){
    const id='wlcv1-development-1006-interior-comparison-'+arm.arm;
    const instrument=developmentTrainingInstrument(1006,noiseSeed,id);
    const measured=instrument.acquire(arm.request);
    save(arm.arm+'.run.json',measured);
    const beforeRefit=scoreMeasured(arm,measured);
    const refit=discoverWeak([...training,measured],prereg.fitOptions);
    results.push({arm:arm.arm,usage:instrument.usage(),measurementSHA256:seal(measured),beforeRefit,
      weakRefit:{id:refit.selected.id,terms:refit.selected.terms}});
  }
  const result={world:1006,preregistration:194490,seedMaterial,noiseSeed,forecastsSHA256:seal(pre),
    trainingIds:prereg.trainingIds,results};
  save('scores.json',result);
  return result;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const [training,out]=process.argv.slice(2);
  if(!training||!out)throw new Error('Pass an exact three-run training array and a new output directory');
  console.log(JSON.stringify(runCourse(JSON.parse(readFileSync(training)),out)));
}
