import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {independentTemporalEvidence,prefixForecast} from '../../src/science/temporal-evidence.mjs';

const {stateOperatorWorlds,outsideStateOperatorWorlds,stateOperatorPlan,observeStateOperatorWorld}=
  await import(pathToFileURL(resolve(process.argv[2]||'.independent-state-nullgarden/src/state-operator-course.mjs')));
const outdir=resolve(process.argv[3]||'.receipts/temporal-evidence');
mkdirSync(outdir,{recursive:true});
const raw=readFileSync(new URL('./frozen-models.json',import.meta.url));
assert.equal(createHash('sha256').update(raw).digest('hex'),'4e083dcf89fec14b50ce1095477891bdf3ed2c9e84248c010a3ecefa9f9d784d');
const bank=JSON.parse(raw);
const genuine=stateOperatorWorlds('evaluation',927341),outsiders=outsideStateOperatorWorlds();
assert.equal(bank.length,192);
const rows=[],snrs=[40,25,15],data=new Map();
function permute(observation,seed){
  let s=seed>>>0;const random=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};
  const order=observation.samples.map((_,i)=>i);
  for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  return {...observation,samples:observation.samples.map((r,i)=>({...r,state:observation.samples[order[i]].state}))};
}
function loss(forecast,reference){
  if(!forecast)return 10;
  let e=0,s=0,n=0;
  for(let t=0;t<forecast.length;t++)for(let j=0;j<forecast[t].length;j++){
    const v=reference[t+11][j];s+=v*v;e+=(forecast[t][j]-v)**2;n++;
  }
  return Math.min(10,Math.sqrt(e/Math.max(s,n*1e-8)));
}
for(const item of bank){
  const outside=item.control==='omitted_mechanism', list=outside?outsiders:genuine;
  const wi=list.findIndex(w=>w.id===item.world),si=snrs.indexOf(item.snrDb);
  assert.ok(wi>=0 && si>=0);
  const key=item.world+'-'+item.snrDb, seed=614113+1000*wi+100*si+(outside?300000:0);
  if(!data.has(key))data.set(key,observeStateOperatorWorld(list[wi],stateOperatorPlan(item.kind,'test'),item.snrDb,seed));
  const sample=data.get(key), original=sample.observation;
  const input=item.control==='time_permutation'?permute(original,seed+701):original;
  const obs={...input,id:'independent-verification'};
  const {prediction,...verdict}=independentTemporalEvidence(item.model,obs);
  const row={world:item.world,kind:item.kind,snrDb:item.snrDb,control:item.control,acquisition:item.acquisition,
    oldStatus:item.status,seed,verdict};
  if(item.kind==='periodic' && item.control==='law'){
    const shrunk=prefixForecast(item.model,obs,true).states?.slice(1);
    writeFileSync(join(outdir,key+'-'+item.acquisition+'-forecasts.json'),JSON.stringify({raw:prediction,shrunk})+'\n');
    const ref=sample.reference.states;
    row.raw=loss(prediction,ref);row.shrunk=loss(shrunk,ref);
  }
  rows.push(row);
}
const groups={};
for(const row of rows){
  const key=row.control+'/'+row.acquisition;
  const g=groups[key]??={n:0,oldAccepted:0,information:0,residualScreen:0,accepted:0};
  g.n++;g.oldAccepted+=row.oldStatus==='predictive_candidate';
  g.information+=Number(!!row.verdict.information);
  g.residualScreen+=Number(!!row.verdict.residualScreen);
  g.accepted+=row.verdict.status==='predictive_candidate';
}
const means={};
for(const acquisition of ['active','random']){
 const sub=rows.filter(r=>r.control==='law'&&r.kind==='periodic'&&r.acquisition===acquisition);
 assert.equal(sub.length,24);
 for(const k of ['raw','shrunk'])means[acquisition+'/'+k]=sub.reduce((s,r)=>s+r[k],0)/sub.length;
}
const controlGate=groups['time_permutation/random'].accepted===0 && groups['omitted_mechanism/random'].accepted===0;
const coverageGate=groups['law/active'].accepted>0 && groups['law/random'].accepted>0;
const fieldGate=means['active/shrunk']<.035847301 && means['active/shrunk']<Math.min(means['random/raw'],means['random/shrunk']);
const result={schema:'worldlaw.independent-temporal-evidence/v1',groups,means,controlGate,coverageGate,fieldGate,
  scientificGate:controlGate&&coverageGate&&fieldGate, rows};
writeFileSync(join(outdir,'report.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({groups,means,controlGate,coverageGate,fieldGate}));
