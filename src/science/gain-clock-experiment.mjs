import {screenIntervalPairs,selectSeparatingCandidate} from '../experiment-design/interval-separation.mjs';
const SCHEMA='worldlaw.gain-clock-input/v1';
const finite=(n,name,lo,hi)=>{if(!Number.isFinite(n)||n<lo||n>hi)throw Error(`${name} must be finite in [${lo}, ${hi}].`);return n;};
const pair=(x,name,lo,hi)=>{if(!Array.isArray(x)||x.length!==2)throw Error(`${name} needs two endpoints.`);x.forEach(v=>finite(v,name,lo,hi));if(x[0]>x[1])throw Error(`${name} endpoints reversed.`);return x;};
const text=(x,name)=>{if(typeof x!=='string'||!x.trim()||x.length>200)throw Error(`${name} needs 1–200 source characters.`);return x;};
// Deliberately small admitted analytic profile domain. No sampled extrema.
export function commandAt(p,t,duration){const z=t/duration;if(p.kind==='linear')return z;if(p.kind==='quadratic')return z*z;if(p.kind==='ramp')return Math.min(t,1);return Math.sin(p.cycles*Math.PI*z);}
function commandRange(p,a,b,d){let lo=Math.min(commandAt(p,a,d),commandAt(p,b,d)),hi=Math.max(commandAt(p,a,d),commandAt(p,b,d));if(p.kind==='sine'){const w=p.cycles*Math.PI/d;for(let k=Math.ceil((a*w-Math.PI/2)/Math.PI);k<=Math.floor((b*w-Math.PI/2)/Math.PI);k++){const v=k%2===0?1:-1;lo=Math.min(lo,v);hi=Math.max(hi,v);}}return [lo,hi];}
function padded(lo,hi){const e=128*Number.EPSILON*Math.max(1,Math.abs(lo),Math.abs(hi));return [lo-e,hi+e];}
export function planGainClockExperiment(model,input){
 if(input?.schema!==SCHEMA)throw Error('Expected gain-clock input/v1.');
 text(input.source,'Source');
 if(model?.schema!=='worldlaw.torque-model/v1'||!Array.isArray(model.terms)||model.terms.length!==1||model.terms[0].id!=='command')throw Error('This experiment requires one fixed instantaneous command term; other dynamics are not admitted.');
 const coefficient=finite(model.terms[0].coefficient,'Fixed command coefficient',-1e6,1e6);
 const duration=finite(input.duration,'State-clock course duration',.01,60),amplitude=finite(input.maxAmplitude,'Amplitude limit',0,10),slew=finite(input.maxSlew,'Slew limit',0,1e4),radius=finite(input.readingRadius,'Declared reading radius',0,1e6);
 const families=input.families,profiles=input.profiles,times=input.torqueTimes;
 if(!Array.isArray(families)||families.length<2||families.length>16)throw Error('Offer 2–16 complete gain/scale families.');
 if(!Array.isArray(profiles)||profiles.length<1||profiles.length>8||!Array.isArray(times)||times.length<1||times.length>32||profiles.length*times.length>128)throw Error('Offer at most 128 profile/time pairs (8 profiles, 32 times).');
 const ids=new Set();for(const f of families){text(f.id,'Family ID');if(ids.has(f.id))throw Error('Duplicate family ID.');ids.add(f.id);pair(f.gain,'Gain interval',.01,10);pair(f.scale,'Clock scale interval',.5,2);}
 ids.clear();for(const p of profiles){text(p.id,'Profile ID');if(ids.has(p.id))throw Error('Duplicate profile ID.');ids.add(p.id);if(!['linear','quadratic','ramp','sine'].includes(p.kind))throw Error('Unsupported command profile.');if(p.kind==='sine'&&(!Number.isInteger(p.cycles)||p.cycles<1||p.cycles>4))throw Error('Sine half-cycle count must be 1–4.');}
 times.forEach(t=>finite(t,'Torque-clock time',0,60));if(new Set(times).size!==times.length)throw Error('Duplicate torque-clock time.');
 const candidates=[];for(const p of profiles)for(const t of times){
  const mapped=families.map(f=>[t/f.scale[1],t/f.scale[0]]),maxTime=Math.max(...mapped.map(x=>x[1]));
  const maxValue=p.kind==='ramp'?Math.min(duration,1):1,maxDerivative=p.kind==='sine'?p.cycles*Math.PI/duration:p.kind==='quadratic'?2/duration:p.kind==='ramp'?1:1/duration;
  const withinBudget=maxTime<=duration&&maxValue<=amplitude&&maxDerivative<=slew;
  const predictions=withinBudget?families.map((f,i)=>{const r=commandRange(p,...mapped[i],duration),ends=f.gain.flatMap(g=>r.map(v=>g*v*coefficient));return {id:f.id,interval:padded(Math.min(...ends),Math.max(...ends)),stateTimeInterval:mapped[i]};}):[];
  const pairs=screenIntervalPairs(predictions,radius),separated=pairs.filter(x=>x.separable).length;
  candidates.push({id:`${p.id}@${String(t)}`,profile:p,torqueTime:t,costSeconds:maxTime,withinBudget,predictions,pairs,separated,allSeparated:pairs.length>0&&separated===pairs.length,reason:withinBudget?null:maxTime>duration?'mapped time outside complete course':'amplitude or slew exceeds declaration'});
 }
 const selected=selectSeparatingCandidate(candidates,'torqueTime');
 return {schema:'worldlaw.gain-clock-plan/v1',selected,candidates,readingRadius:radius,limits:{familyEvaluations:families.length*profiles.length*times.length,pairComparisons:families.length*(families.length-1)/2*profiles.length*times.length},limitations:['Zero clock origins and zero offset are declared; torque time = scale × state time. Gain and scale ranges are caller declarations, not fitted confidence bounds.','Fixed instantaneous command law only. Complete analytic profile ranges include sine turning points; 128-epsilon engineering allowance is not a formal interval proof.','No probability, unique instrument diagnosis, hardware authorization or coefficient uncertainty is inferred. A later refit is a different prediction and cannot erase prior failure.']};
}
export function inspectGainClockExperiment(model,input){
 const plan=planGainClockExperiment(model,input);let received=null;
 if(input.received!==undefined){const r=input.received;text(r.source,'Received source');finite(r.jointTorque,'Received torque',-1e8,1e8);const c=plan.candidates.find(c=>c.id===r.candidateId);if(!c?.withinBudget)throw Error('Received reading must identify an admitted offered profile/time pair.');const slack=128*Number.EPSILON*Math.max(1,Math.abs(r.jointTorque),plan.readingRadius),reading=[r.jointTorque-plan.readingRadius-slack,r.jointTorque+plan.readingRadius+slack];const outcomes=c.predictions.map(p=>({...p,excluded:reading[1]<p.interval[0]||reading[0]>p.interval[1]}));received={source:r.source,candidateId:c.id,jointTorque:r.jointTorque,outcomes,remaining:outcomes.filter(o=>!o.excluded).map(o=>o.id),allPriorFailed:outcomes.every(o=>o.excluded)};}
 return {...plan,received};
}
export function gainClockExample(){return {model:{schema:'worldlaw.torque-model/v1',id:'fixed-command',terms:[{id:'command',coefficient:1}]},input:{schema:SCHEMA,source:'Authored gain versus torque-clock scale control; not physical measurement',duration:5,maxAmplitude:1,maxSlew:2,readingRadius:.02,families:[{id:'sensor-gain',gain:[1.24,1.26],scale:[1,1]},{id:'clock-rate',gain:[1,1],scale:[.79,.81]}],profiles:[{id:'linear',kind:'linear'},{id:'quadratic',kind:'quadratic'},{id:'ramp',kind:'ramp'},...Array.from({length:4},(_,i)=>({id:`sine-${i+1}`,kind:'sine',cycles:i+1}))],torqueTimes:Array.from({length:16},(_,i)=>(i+1)/4)}};}
