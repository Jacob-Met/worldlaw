import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {fitDispersiveProbe,predictDispersiveProbe} from '../src/science/periodic-dispersion.mjs';
const {observeStateOperatorWorld,outsideStateOperatorWorlds}=await import(pathToFileURL(
  resolve(process.argv[2]||'.independent-state-nullgarden/src/state-operator-course.mjs')));
const dir=resolve(process.argv[3]||'.receipts/periodic-dispersion');
mkdirSync(dir,{recursive:true});
const n=32,h=.25,mu8=4*Math.sin(Math.PI*8/n)**2/h**2;
const original=outsideStateOperatorWorlds().find(x=>x.id==='outside_dispersion');
assert.ok(original);
const local={kind:'periodic',id:'matched_local_burgers',initialize:original.initialize,
  rhs:(u,command,h)=>u.map((_,j)=>{
    const l=u[(j+n-1)%n],r=u[(j+1)%n];
    return (.06*mu8*(r-l)-.3*(r*r-l*l))/(2*h)+.2*command[j];
  })};
function plan(id,ks,phase){
  return {id,spacing:h,step:.01,steps:400,forcing:{amplitude:0,offset:0,startFrequency:.3,endFrequency:.8},
    initial:Array.from({length:n},(_,j)=>{
      const t=j*2*Math.PI/n;
      return .3+ks.reduce((s,k)=>s+.35/Math.sqrt(ks.length)*Math.sin(k*t+phase),0)-.15*Math.sin(3*t);
    })};
}
const gates={repeatRefusals:0,changedRank:0,omittedWins:0,localLosses:0};
const equivalence=[],rows=[];
const episode=(w,id,ks,p,snr,seed)=>observeStateOperatorWorld(w,plan(id,ks,p),snr,seed).observation;
function fit(records,ks){return fitDispersiveProbe(records.map((r,i)=>({...r,id:'probe-'+i})),ks);}
function error(pred,truth){
  if(!pred)return 10;
  let e=0,s=0;
  for(let t=0;t<pred.length;t++)for(let j=0;j<n;j++){
    const v=truth[t+11][j];s+=v*v;e+=(pred[t][j]-v)**2;
  }
  return Math.min(10,Math.sqrt(e/s));
}
for(const snr of [15,25,40])for(const seed of [19191,29009,41341]){
  const worlds=[local,original],first=worlds.map(w=>episode(w,'first',[8],.4,snr,seed));
  let discrepancy=0;
  for(let t=0;t<first[0].samples.length;t++)for(let j=0;j<n;j++)
    discrepancy=Math.max(discrepancy,Math.abs(first[0].samples[t].state[j]-first[1].samples[t].state[j]));
  equivalence.push({snr,seed,discrepancy});
  for(const [i,world] of worlds.entries()){
    const repeat=episode(world,'repeat',[8],.9,snr,seed+1),modified=episode(world,'modified',[4,8],.9,snr,seed+2);
    const passive=fit([first[i],repeat],[[8],[8]]),active=fit([first[i],modified],[[8],[4,8]]);
    if(passive.status==='rank_deficient')gates.repeatRefusals++;
    if(active.status==='three_columns_estimable')gates.changedRank++;
    const held=observeStateOperatorWorld(world,plan('forecast',[3,6],1.4),snr,seed+3);
    const prefix=held.observation.samples.slice(0,11);
    const models={passiveLocal:passive.repeatLocal,activeLocal:active.local,mixed:active.mixed};
    const preds={};
    for(const [arm,model] of Object.entries(models)){
      preds[arm]=model?predictDispersiveProbe(model,prefix,h,390).states:null;
    }
    writeFileSync(join(dir,[world.id,snr,seed].join('-')+'-forecasts.json'),JSON.stringify(preds)+'\n');
    const errors=Object.fromEntries(Object.entries(preds).map(([arm,p])=>[arm,error(p,held.reference.states)]));
    const stronger=Math.min(errors.passiveLocal,errors.activeLocal);
    if(i===1&&errors.mixed<stronger)gates.omittedWins++;
    if(i===0&&errors.mixed>stronger)gates.localLosses++;
    rows.push({world:world.id,snr,seed,passive,active,errors});
  }
}
const identical=Math.max(...equivalence.map(v=>v.discrepancy))<1e-10;
const gate=identical&&gates.repeatRefusals===18&&gates.changedRank===18&&gates.omittedWins===9;
writeFileSync(join(dir,'report.json'),JSON.stringify({gate,identical,gates,equivalence,rows},null,2)+'\n');
console.log(JSON.stringify({gate,identical,gates,maxMismatch:Math.max(...equivalence.map(r=>r.discrepancy))}));
