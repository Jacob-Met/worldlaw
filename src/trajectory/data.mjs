/** Portable run evidence. Values have explicit SI conventions; no units guessed. */
export const BUNDLE_SCHEMA = 'worldlaw.trajectory-bundle/v1';
export const RUN_UNITS = Object.freeze({time:'s',position:'rad',command:'N·m',inertia:'kg·m²',initialRate:'rad/s'});
export const MAX_TEXT_LENGTH = 3_000_000;
export class TrajectoryDataError extends Error {
  constructor(message, code='invalid_evidence') { super(message); this.name='TrajectoryDataError'; this.code=code; }
}
const fail=(message,code)=>{throw new TrajectoryDataError(message,code);};
const object=value=>value!==null && typeof value==='object' && !Array.isArray(value);
function finite(value,name,bound=1e6) {
  if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>bound)fail(`${name} must be a finite number with magnitude at most ${bound}.`);
  return value;
}
function label(value,name,max=240) {
  if(typeof value!=='string'||!value.trim()||value.length>max)fail(`${name} must be nonempty text of at most ${max} characters.`);
  return value.trim();
}
function units(value,name) {
  if(!object(value)||Object.entries(RUN_UNITS).some(([k,v])=>value[k]!==v))fail(`${name} must declare seconds, unwrapped radians, N·m, kg·m² and rad/s. Convert other units before importing.`, 'unsupported_units');
  return {...RUN_UNITS};
}
function metadata(value) {
  if(!object(value))fail('Every run needs source metadata with a label.');
  let text;
  try{text=JSON.stringify(value);}catch{fail('Source metadata must be ordinary JSON.');}
  if(typeof text!=='string')fail('Source metadata must serialize to an ordinary JSON object.');
  if(text.length>32_000)fail('Source metadata must be smaller than 32 KB per run.');
  const result=JSON.parse(text);
  if(!object(result))fail('Source metadata must serialize to an ordinary JSON object.');
  result.label=label(result.label,'Source label');
  if(result.recordingId!==undefined)result.recordingId=label(result.recordingId,'Source recordingId');
  return result;
}
export function validateRun(raw,{role='challenge',inheritedUnits}={}) {
  if(!object(raw))fail('Each run must be an object.');
  const id=label(raw.id,'Run id',120), runLabel=label(raw.label??id,'Run label');
  if(!['synthetic','measured','unknown'].includes(raw.kind))fail(`Run ${id} must declare kind synthetic, measured, or unknown.`);
  const declaredUnits=units(raw.units??inheritedUnits,`Run ${id} units`);
  const source=metadata(raw.source);
  const inertia=finite(raw.inertia,`Run ${id} inertia`,1e12);
  if(inertia<=0)fail(`Run ${id} needs a known positive constant inertia in kg·m².`);
  const initialRate=finite(raw.initialRate,`Run ${id} initialRate`);
  const min=role==='training'?17:2;
  if(!Array.isArray(raw.samples)||raw.samples.length<min||raw.samples.length>4096)fail(`Run ${id} needs ${min}–4096 samples.`);
  const samples=Array.from(raw.samples,(row,i)=>{
    if(!object(row))fail(`Run ${id}, sample ${i+1} must contain time, position and command.`);
    return {time:finite(row.time,`Run ${id}, sample ${i+1} time`,1e12),position:finite(row.position,`Run ${id}, sample ${i+1} position`),command:finite(row.command,`Run ${id}, sample ${i+1} command`)};
  });
  for(let i=1;i<samples.length;i++)if(samples[i].time<=samples[i-1].time)fail(`Run ${id} timestamps must increase strictly. Samples are never silently sorted or interpolated.`,'invalid_time');
  const duration=samples.at(-1).time-samples[0].time;
  if(duration>300)fail(`Run ${id} exceeds the 300-second interactive limit. Use a shorter recorded run.`,'resource_limit');
  return {id,label:runLabel,kind:raw.kind,units:declaredUnits,inertia,initialRate,source,samples};
}
export function validateBundle(raw) {
  if(!object(raw)||raw.schema!==BUNDLE_SCHEMA)fail('Expected a WORLDLAW trajectory bundle (worldlaw.trajectory-bundle/v1).','unsupported_schema');
  const declaredUnits=units(raw.units,'Bundle units');
  for(const name of ['trainingRuns','challengeRuns'])if(!Array.isArray(raw[name])||raw[name].length<1||raw[name].length>4)fail(`Provide 1–4 ${name==='trainingRuns'?'training':'challenge'} runs.`);
  const trainingRuns=Array.from(raw.trainingRuns,r=>validateRun(r,{role:'training',inheritedUnits:declaredUnits}));
  const challengeRuns=Array.from(raw.challengeRuns,r=>validateRun(r,{role:'challenge',inheritedUnits:declaredUnits}));
  const all=[...trainingRuns,...challengeRuns];
  if(all.reduce((sum,r)=>sum+r.samples.length,0)>8192)fail('The interactive bundle supports at most 8192 total samples.','resource_limit');
  if(new Set(all.map(r=>r.id)).size!==all.length)fail('Every training and challenge run needs a distinct id.','shared_evidence');
  // This screens obvious shared evidence, not acquisition independence. Short
  // quantized sensor sequences can recur naturally in different recordings.
  // Keep complete-run/subset checks, but use a longer partial-match window.
  const partialWindow=32;
  const key=(run,start,size)=>JSON.stringify(run.samples.slice(start,start+size).map(s=>[s.position,s.command]));
  function sameClock(a,startA,b,startB,size){
    const originA=a.samples[startA].time,originB=b.samples[startB].time;
    for(let offset=1;offset<size;offset++){
      const timeA=a.samples[startA+offset].time,timeB=b.samples[startB+offset].time;
      // Adding an epoch can round timestamps; preserve representable clocks.
      const tolerance=8*Number.EPSILON*Math.max(1,Math.abs(originA),Math.abs(originB),Math.abs(timeA),Math.abs(timeB));
      if(Math.abs((timeA-originA)-(timeB-originB))>tolerance)return false;
    }
    return true;
  }
  function completeSubset(a,b){
    const [short,long]=a.samples.length<=b.samples.length?[a,b]:[b,a];
    const size=short.samples.length,needle=key(short,0,size);
    for(let start=0;start<=long.samples.length-size;start++){
      if(long.samples[start].position!==short.samples[0].position||long.samples[start].command!==short.samples[0].command)continue;
      if(key(long,start,size)===needle&&sameClock(short,0,long,start,size))return true;
    }
    return false;
  }
  const trainingRecordings=new Set(trainingRuns.map(r=>r.source.recordingId).filter(Boolean));
  const trainingWindows=new Map();
  for(const run of trainingRuns)for(let start=0;start<=run.samples.length-partialWindow;start++){
    const signature=key(run,start,partialWindow);
    if(!trainingWindows.has(signature))trainingWindows.set(signature,[]);
    trainingWindows.get(signature).push({run,start});
  }
  for(const run of challengeRuns){
    if(run.source.recordingId&&trainingRecordings.has(run.source.recordingId))fail(`Challenge run ${run.id} shares a declared recording with training evidence.`,'shared_evidence');
    if(trainingRuns.some(training=>completeSubset(training,run)))fail(`Challenge run ${run.id} matches a complete training run or contiguous subset. Supply separately acquired evidence.`,'shared_evidence');
    for(let start=0;start<=run.samples.length-partialWindow;start++){
      const matches=trainingWindows.get(key(run,start,partialWindow))??[];
      if(matches.some(prior=>sameClock(prior.run,prior.start,run,start,partialWindow)))fail(`Challenge run ${run.id} matches a ${partialWindow}-sample training window. This independence screen cannot authenticate separate acquisition; inspect the original recordings.`,'shared_evidence');
    }
  }
  return {schema:BUNDLE_SCHEMA,label:label(raw.label??'Imported trajectory challenge','Bundle label'),units:declaredUnits,trainingRuns,challengeRuns};
}
export function parseBundleText(text) {
  if(typeof text!=='string'||text.length>MAX_TEXT_LENGTH)fail('Trajectory files must be JSON smaller than 3 MB.');
  let raw;try{raw=JSON.parse(text.replace(/^\uFEFF/,''));}catch{fail('The trajectory JSON could not be read. Check its syntax.');}
  return validateBundle(raw);
}
