import {predict, DiscoveryError} from './torque-discovery.mjs';

const check = (ok, message) => { if (!ok) throw new DiscoveryError(message); };
const finite = (x, name, limit=1e6) => { check(typeof x==='number' && Number.isFinite(x) && Math.abs(x)<=limit, `${name} must be finite and bounded by ${limit}.`); return x; };
const clone = x => JSON.parse(JSON.stringify(x));

/** Compare a fixed law, not fitted laws, on identical original state support.
 * Positive offset means torque timestamp = state timestamp + offset.
 * Linear interpolation is an explicit observation model, not a new reading.
 */
export function inspectClockOffsets(model, input) {
  check(input?.schema==='worldlaw.clock-offset-input/v1','Expected clock-offset input v1.');
  check(typeof input.source==='string' && input.source.trim().length>0 && input.source.length<=300,'Declare a source label.');
  for(const [key,value] of Object.entries({time:'s',position:'rad',rate:'rad/s',command:'N·m',jointTorque:'N·m'}))
    check(input.units?.[key]===value,`Declare ${key} units as ${value}.`);
  const maxGap=finite(input.maxGap,'maxGap'), tieTolerance=finite(input.tieTolerance,'tieTolerance');
  check(maxGap>0 && tieTolerance>=0,'maxGap must be positive; tieTolerance nonnegative.');
  check(Array.isArray(input.offsets) && input.offsets.length>=1 && input.offsets.length<=65,'Supply 1–65 clock offsets.');
  const offsets=input.offsets.map(x=>finite(x,'offset',60));
  check(new Set(offsets).size===offsets.length,'Offsets must be unique.');
  check(Array.isArray(input.states) && input.states.length>=4 && input.states.length<=2048,'Supply 4–2048 state rows.');
  check(Array.isArray(input.torques) && input.torques.length>=2 && input.torques.length<=4096,'Supply 2–4096 torque rows.');
  const states=input.states.map((r,i)=>{
    check(r && ['training','challenge'].includes(r.role),`State ${i+1} requires training or challenge role.`);
    return {time:finite(r.time,'state time'),position:finite(r.position,'position'),rate:finite(r.rate,'rate'),command:finite(r.command,'command'),role:r.role,index:i};
  });
  const torques=input.torques.map((r,i)=>({time:finite(r?.time,'torque time'),jointTorque:finite(r?.jointTorque,'jointTorque',1e12),index:i}));
  for(const [name,rows] of [['State',states],['Torque',torques]]) for(let i=1;i<rows.length;i++) check(rows[i].time>rows[i-1].time,`${name} times must strictly increase.`);
  // Training and challenge must use distinct original torque readings, including
  // interpolation brackets, for every offered candidate. This guards leakage.
  function sample(time) {
    if(time<torques[0].time || time>torques.at(-1).time) return null;
    let lo=0,hi=torques.length-1;
    while(lo<hi){const mid=(lo+hi)>>1;if(torques[mid].time<time)lo=mid+1;else hi=mid;}
    const right=torques[lo];
    if(right.time===time) return {value:right.jointTorque,indices:[lo],fraction:0};
    const left=torques[lo-1],gap=right.time-left.time;
    if(gap>maxGap)return null;
    const fraction=(time-left.time)/gap;
    return {value:left.jointTorque*(1-fraction)+right.jointTorque*fraction,indices:[lo-1,lo],fraction};
  }
  const admitted=[],excluded=[];
  for(const state of states){
    const samples=offsets.map(offset=>sample(state.time+offset));
    if(samples.some(s=>!s)){excluded.push(state.index);continue;}
    admitted.push({state,prediction:predict(model,state),samples});
  }
  const training=admitted.filter(r=>r.state.role==='training'),challenge=admitted.filter(r=>r.state.role==='challenge');
  check(training.length>=2 && challenge.length>=2,'Common support must retain at least two training and two challenge states.');
  const usedTraining=new Set(training.flatMap(r=>r.samples.flatMap(s=>s.indices)));
  check(!challenge.some(r=>r.samples.some(s=>s.indices.some(i=>usedTraining.has(i)))),'Training and challenge share original torque readings across the offset grid; separate the courses with a guard interval.');
  const score=rows=>({count:rows.length,rmse:Math.hypot(...rows.map(r=>r.residual))/Math.sqrt(rows.length),maxAbsResidual:Math.max(...rows.map(r=>Math.abs(r.residual)))});
  const candidates=offsets.map((offset,j)=>{
    const rows=admitted.map(r=>({stateIndex:r.state.index,time:r.state.time,role:r.state.role,torqueTime:r.state.time+offset,prediction:r.prediction,interpolatedTorque:r.samples[j].value,residual:r.samples[j].value-r.prediction,torqueIndices:r.samples[j].indices,fraction:r.samples[j].fraction}));
    return {offset,training:score(rows.filter(r=>r.role==='training')),challenge:score(rows.filter(r=>r.role==='challenge')),rows};
  });
  const minimum=Math.min(...candidates.map(c=>c.training.rmse));
  const competitive=candidates.filter(c=>c.training.rmse<=minimum+tieTolerance).map(c=>c.offset);
  return {schema:'worldlaw.clock-offset-result/v1',source:input.source,model:clone(model),candidates,competitive,selectedOffset:competitive.length===1?competitive[0]:null,excludedStateIndices:excluded,admittedStateIndices:admitted.map(r=>r.state.index),settings:{maxGap,tieTolerance},limitations:[
    'The supplied fixed model and finite offset grid condition every comparison; a better offset does not establish clock error or a physical delay.',
    'Linear interpolation assumes the torque between samples follows its secant; maxGap is an admission setting, not an interpolation error bound.',
    'Only common-support states are compared. Excluded states remain visible and are not tested.',
    'Training-only RMSE selects candidates within a declared absolute tolerance; this is not calibrated confidence.',
    'Disjoint source readings prevent direct reuse but do not authenticate independence or prospective collection.',
  ]};
}

export function exportClockInvestigation(model,input) {
  inspectClockOffsets(model,input);
  return JSON.stringify({schema:'worldlaw.clock-investigation/v1',model:clone(model),input:clone(input)},null,2);
}
export function reopenClockInvestigation(text) {
  check(typeof text==='string' && text.length<=2_000_000,'Investigation must be at most 2 MB.');
  const saved=JSON.parse(text);
  check(saved?.schema==='worldlaw.clock-investigation/v1','Expected clock investigation v1.');
  return {model:saved.model,input:saved.input,result:inspectClockOffsets(saved.model,saved.input)};
}
