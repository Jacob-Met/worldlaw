import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chooseParityProbe,fitParityDecay,modeRow,predictParityModes} from '../src/science/periodic-parity.mjs';

const {observeStateOperatorWorld,outsideStateOperatorWorlds} = await import(pathToFileURL(
  resolve(process.argv[2] || '.independent-state-nullgarden/src/state-operator-course.mjs')));
const destination=resolve(process.argv[3] || '.receipts/periodic-parity');
mkdirSync(destination,{recursive:true});
const n=32, spacing=.25, dt=.01, modes=[1,3], amplitude=.5;
const omitted=outsideStateOperatorWorlds().find(w=>w.id==='outside_nonlocal');
assert.ok(omitted);
const k3=modeRow(3,n,spacing)[0];
const localD=.08+.6/k3;
const matchedLocal={id:'matched_local_heat',kind:'periodic',initialize:omitted.initialize,
  rhs:(u,_command,h)=>u.map((v,j)=>localD*(u[(j+1)%n]-2*v+u[(j+n-1)%n])/(h*h))};
function plan(id,ks,phase){
  const initial=Array.from({length:n},(_,j)=>{
    const t=2*Math.PI*j/n;
    const designed=ks.reduce((s,k)=>s+amplitude/Math.sqrt(ks.length)*Math.sin(k*t+phase),0);
    // The independent producer adds this same physical k3 component in both arms.
    return .6+designed-.15*Math.sin(3*t);
  });
  return {id,initial,spacing,step:dt,steps:400,forcing:{offset:0,amplitude:0,startFrequency:.3,endFrequency:.7}};
}
function fit(records,ks){
  // Strip every source label before fitting. Only measured rows and declared inputs remain.
  return fitParityDecay(records.map((r,j)=>({...r.observation,id:'probe-'+j})),ks);
}
function score(states,truth){
  let e=0,s=0;
  for(let i=0;i<states.length;i++) for(let j=0;j<n;j++){
    const v=truth[i][j];e+=(states[i][j]-v)**2;s+=v*v;
  }
  return Math.sqrt(e/s);
}
const design=chooseParityProbe([3],[[3],[2,3]],n,spacing);
assert.equal(design.selected,1);
const records=[],gates={rankOne:0,rankTwo:0,omittedWin:0,localTradeoffs:0};
const equivalence=[];
for(const snr of [15,25,40])for(const seed of [19191,29009,41341]){
  const p=plan('first',[3],.4);
  const firsts=[matchedLocal,omitted].map(w=>observeStateOperatorWorld(w,p,snr,seed));
  let maximum=0;
  for(let i=0;i<firsts[0].observation.samples.length;i++)for(let j=0;j<n;j++)
    maximum=Math.max(maximum,Math.abs(firsts[0].observation.samples[i].state[j]-firsts[1].observation.samples[i].state[j]));
  assert.ok(maximum<1e-11);
  equivalence.push({snr,seed,maximum});
  for(const [index,world] of [matchedLocal,omitted].entries()){
    const first=firsts[index];
    const repeat=observeStateOperatorWorld(world,plan('repeat',[3],.9),snr,seed+1);
    const changed=observeStateOperatorWorld(world,plan('changed',[2,3],.9),snr,seed+2);
    const rankOne=fit([first,repeat],[[3],[3]]);
    const rankTwo=fit([first,changed],[[3],[2,3]]);
    if(rankOne.status==='rank_deficient')gates.rankOne++;
    if(rankTwo.status==='two_rates_resolved')gates.rankTwo++;
    const held=observeStateOperatorWorld(world,plan('forecast',modes,1.4),snr,seed+3);
    const prefix=held.observation.samples.slice(0,11);
    const times=held.observation.samples.slice(11).map(s=>s.time);
    const models={repeatLocal:rankOne.local,changedLocal:rankTwo.local,mixed:rankTwo.mixed};
    const predictions={};
    for(const [arm,model] of Object.entries(models))if(model)
      predictions[arm]=predictParityModes(model,prefix,times,spacing,modes);
    const key=[world.id,snr,seed].join('-');
    writeFileSync(join(destination,key+'-predictions.json'),JSON.stringify(predictions)+'\n');
    const reference=held.reference.states.slice(11);
    const losses=Object.fromEntries(Object.entries(predictions).map(([arm,states])=>[arm,score(states,reference)]));
    if(index===1 && losses.mixed<losses.repeatLocal && losses.mixed<losses.changedLocal)gates.omittedWin++;
    if(index===0 && losses.mixed>Math.min(losses.repeatLocal,losses.changedLocal))gates.localTradeoffs++;
    records.push({world:world.id,snr,seed,rankOne,rankTwo,losses});
  }
}
const result={schema:'worldlaw.periodic-parity-course/v1',design,gates,equivalence,records,
  nullgarden:'4af7717a866e0246e7c0bcd81977cea53cddbd8c',node:process.version,
  gate:gates.rankOne===18&&gates.rankTwo===18&&gates.omittedWin===9};
writeFileSync(join(destination,'report.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({gates,maximumPureModeMismatch:Math.max(...equivalence.map(r=>r.maximum)),gate:result.gate}));
