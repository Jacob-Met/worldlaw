import {inspectClockOffsets} from './clock-offset.mjs';
import {DiscoveryError} from './torque-discovery.mjs';
const check=(ok,message)=>{if(!ok)throw new DiscoveryError(message);};
const number=(x,name,bound=1e6)=>{check(typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=bound,`${name} must be finite and bounded by ${bound}.`);return x;};
const clone=x=>JSON.parse(JSON.stringify(x));

/** A joint finite affine-clock family, evaluated through the maintained fixed-law
 * offset receiver. Origins are declarations, not fitted parameters. Every map is
 * torqueTime = torqueOrigin + scale*(stateTime-stateOrigin) + offset.
 */
export function inspectAffineClocks(model,input) {
 check(input?.schema==='worldlaw.clock-affine-input/v1','Expected affine clock input v1.');
 const stateOrigin=number(input.stateOrigin,'stateOrigin'),torqueOrigin=number(input.torqueOrigin,'torqueOrigin');
 const maxGap=number(input.maxGap,'maxGap'),tieTolerance=number(input.tieTolerance,'tieTolerance');
 check(maxGap>0&&tieTolerance>=0,'maxGap must be positive; tieTolerance must be nonnegative.');
 check(Array.isArray(input.hypotheses)&&input.hypotheses.length>=1&&input.hypotheses.length<=65,'Supply 1–65 complete affine clock hypotheses.');
 const hypotheses=input.hypotheses.map((h,i)=>{
  check(typeof h?.id==='string'&&h.id.trim().length>0&&h.id.length<=100,`Hypothesis ${i+1} requires an ID.`);
  const scale=number(h.scale,'clock scale',2),offset=number(h.offset,'clock offset',60);
  check(scale>=.5,'Clock scale must lie between 0.5 and 2.');
  return {id:h.id,scale,offset};
 });
 check(new Set(hypotheses.map(h=>h.id)).size===hypotheses.length,'Hypothesis IDs must be unique.');
 check(new Set(hypotheses.map(h=>`${h.scale}:${h.offset}`)).size===hypotheses.length,'Affine hypotheses must be distinct.');
 check(Array.isArray(input.states)&&input.states.length>=4&&input.states.length<=2048,'Supply 4–2048 original state rows.');
 check(Array.isArray(input.torques)&&input.torques.length>=2&&input.torques.length<=4096,'Supply 2–4096 original torque rows.');
 const states=input.states.map((s,i)=>{
  check(s&&['training','challenge'].includes(s.role),`State ${i+1} needs a role.`);
  return {time:number(s.time,'state time'),position:number(s.position,'position'),rate:number(s.rate,'rate'),command:number(s.command,'command'),role:s.role};
 });
 const torques=input.torques.map(t=>({time:number(t?.time,'torque time'),jointTorque:number(t?.jointTorque,'jointTorque',1e12)}));
 for(const [label,rows]of [['State',states],['Torque',torques]])for(let i=1;i<rows.length;i++)check(rows[i].time>rows[i-1].time,`${label} times must strictly increase.`);
 const mapTime=(h,time)=>number(torqueOrigin+h.scale*(time-stateOrigin)+h.offset,'mapped torque time');
 // The support pass performs no interpolation or law evaluation. The maintained
 // receiver performs those once the ONE common original-row set is known.
 function bracket(time) {
  if(time<torques[0].time||time>torques.at(-1).time)return {reason:'outside_torque_support'};
  let lo=0,hi=torques.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(torques[mid].time<time)lo=mid+1;else hi=mid;}
  if(torques[lo].time===time)return {indices:[lo]};
  if(torques[lo].time-torques[lo-1].time>maxGap)return {reason:'torque_gap_exceeds_declaration',indices:[lo-1,lo]};
  return {indices:[lo-1,lo]};
 }
 const mapped=hypotheses.map(h=>states.map(s=>mapTime(h,s.time)));
 mapped.forEach(times=>{for(let i=1;i<times.length;i++)check(times[i]>times[i-1],'An affine clock map collapses distinct state timestamps at numerical precision.');});
 const admitted=[],excluded=[],trainingUse=new Set(),challengeUse=new Set();
 states.forEach((state,i)=>{
  const supports=mapped.map(times=>bracket(times[i]));
  const failures=supports.flatMap((s,j)=>s.reason?[{hypothesisId:hypotheses[j].id,reason:s.reason,torqueTime:mapped[j][i],torqueIndices:s.indices||[]}]:[]);
  if(failures.length){excluded.push({stateIndex:i,failures});return;}
  admitted.push(i);const used=state.role==='training'?trainingUse:challengeUse;
  supports.forEach(s=>s.indices.forEach(j=>used.add(j)));
 });
 check(admitted.filter(i=>states[i].role==='training').length>=2&&admitted.filter(i=>states[i].role==='challenge').length>=2,'Joint common support must retain at least two training and two challenge states.');
 check(![...challengeUse].some(i=>trainingUse.has(i)),'Training and challenge share original torque readings across the affine family; increase the guard interval.');
 const candidates=hypotheses.map((hypothesis,j)=>{
  const received=inspectClockOffsets(model,{schema:'worldlaw.clock-offset-input/v1',source:input.source,units:input.units,maxGap,tieTolerance,offsets:[0],states:admitted.map(i=>({...states[i],time:mapped[j][i]})),torques});
  check(received.excludedStateIndices.length===0,'Affine support disagrees with the maintained receiver.');
  const c=received.candidates[0];
  return {hypothesis,training:c.training,challenge:c.challenge,rows:c.rows.map(row=>({...row,stateIndex:admitted[row.stateIndex],stateTime:states[admitted[row.stateIndex]].time,torqueTime:row.time}))};
 });
 const minimum=Math.min(...candidates.map(c=>c.training.rmse));
 const competitive=candidates.filter(c=>c.training.rmse<=minimum+tieTolerance).map(c=>c.hypothesis.id);
 return {schema:'worldlaw.clock-affine-result/v1',source:input.source,model:clone(model),origins:{stateOrigin,torqueOrigin},candidates,competitive,selectedId:competitive.length===1?competitive[0]:null,admittedStateIndices:admitted,excluded,sourceCustody:{trainingTorqueIndices:[...trainingUse].sort((a,b)=>a-b),challengeTorqueIndices:[...challengeUse].sort((a,b)=>a-b)},limitations:[
  'Only the offered affine maps are compared. Scale and offset depend on the explicitly declared clock origins.',
  'The fixed physical law is not refitted. Clock drift, changing dynamics and other instrument errors can remain observationally confounded.',
  'One common original-state set and one global original-torque custody check cover the entire family.',
  'Piecewise-linear torque interpolation is an observation assumption, not a measured value or a certified error enclosure.',
  'Training-only residual ranking and declared ties are not calibrated confidence. Separate challenge values never select a clock map.',
  'Source disjointness does not authenticate independent acquisition or remove temporal correlation.',
 ]};
}
export function exportAffineClockInvestigation(model,input){inspectAffineClocks(model,input);return JSON.stringify({schema:'worldlaw.clock-affine-investigation/v1',model:clone(model),input:clone(input)},null,2);}
export function reopenAffineClockInvestigation(text){check(typeof text==='string'&&text.length<=2_000_000,'Investigation must be at most 2 MB.');const saved=JSON.parse(text);check(saved?.schema==='worldlaw.clock-affine-investigation/v1','Expected affine clock investigation v1.');return {model:saved.model,input:saved.input,result:inspectAffineClocks(saved.model,saved.input)};}
