import {CouplingError,requireThat,finite,pair,observation,discoverCoupling,evaluateCoupling,planCoupling,UNITS} from './science.mjs';

export const SCHEMA='worldlaw.coupling-notebook/v1';
const clone=value=>JSON.parse(JSON.stringify(value));
function text(value,name,max=2000) {requireThat(typeof value==='string' && value.trim().length>0 && value.length<=max,`${name} needs nonempty text of at most ${max} characters.`);return value;}
function key(row) {return JSON.stringify([row.q,row.torque]);}
export function readCouplingNotebook(input) {
  if(typeof input==='string') {
    requireThat(new TextEncoder().encode(input).length<=2*1024*1024,'Notebook exceeds 2 MB.');
    try{input=JSON.parse(input);}catch{throw new CouplingError('Notebook must be valid JSON.');}
  }
  requireThat(input?.schema===SCHEMA,'Choose a WORLDLAW coupling notebook.');
  requireThat(['measured','synthetic'].includes(input.source?.kind),'Source kind must be explicitly measured or synthetic.');
  requireThat(input.units?.position===UNITS.position && input.units?.torque===UNITS.torque,'Both coordinates must declare radians and N·m.');
  requireThat(input.assumptions?.quasiStatic===true,'Explicit quasi-static acquisition must be declared; rate-dependent evidence is outside this instrument.');
  const source={kind:input.source.kind,label:text(input.source.label,'Source label',300),reference:text(input.source.reference,'Source reference')};
  const assumptions={quasiStatic:true,coordinateConvention:text(input.assumptions.coordinateConvention,'Coordinate convention')};
  const options={noiseSigma:finite(input.options?.noiseSigma,'noiseSigma'),ambiguityDelta:finite(input.options?.ambiguityDelta??6,'ambiguityDelta',100)};
  requireThat(options.noiseSigma>=1e-12 && options.ambiguityDelta>=0,'Noise must be positive and ambiguity nonnegative.');
  requireThat(Array.isArray(input.training)&&input.training.length>=8&&input.training.length<=2048,'Training needs 8–2048 paired observations.');
  requireThat(Array.isArray(input.challenges)&&input.challenges.length<=2048,'Separate checks must contain 0–2048 observations.');
  requireThat(Array.isArray(input.permitted)&&input.permitted.length<=512,'Explicitly permit at most 512 angle pairs.');
  const training=input.training.map(observation),challenges=input.challenges.map(observation),permitted=input.permitted.map((q,i)=>pair(q,`permitted[${i}]`));
  requireThat(new Set(permitted.map(q=>JSON.stringify(q))).size===permitted.length,'Permitted inputs must be distinct.');
  const rawRevisions=input.revisions??[];
  requireThat(Array.isArray(rawRevisions)&&rawRevisions.length<=64&&training.length+rawRevisions.length<=2048,'At most 64 revisions and 2048 total fitting observations are supported.');
  const seenIds=new Set(),fitEvidence=new Set(),checkEvidence=new Set();
  for(const row of [...training,...challenges]){requireThat(!seenIds.has(row.id),'Observation IDs overlap or repeat.','reused_evidence');seenIds.add(row.id);}
  training.forEach(row=>fitEvidence.add(key(row)));
  for(const row of challenges){requireThat(!fitEvidence.has(key(row)),'A separate check repeats fitting evidence, even if its ID was renamed.','reused_evidence');checkEvidence.add(key(row));}
  const revisions=rawRevisions.map((event,i)=>{
    requireThat(Number.isInteger(event?.candidateIndex)&&event.candidateIndex>=0&&event.candidateIndex<permitted.length,`Revision ${i+1} needs a permitted input index.`);
    const row=observation(event.observation);
    requireThat(row.q.every((v,a)=>v===permitted[event.candidateIndex][a]),`Revision ${i+1} does not match its permitted input.`);
    requireThat(!seenIds.has(row.id)&&!fitEvidence.has(key(row))&&!checkEvidence.has(key(row)),'Revision repeats retained evidence; provide a separately acquired response.','reused_evidence');
    seenIds.add(row.id);fitEvidence.add(key(row));
    return {candidateIndex:event.candidateIndex,observation:row};
  });
  return {schema:SCHEMA,source,units:{...UNITS},assumptions,options,training,challenges,permitted,revisions};
}
export function analyzeCouplingNotebook(raw) {
  const notebook=readCouplingNotebook(raw);
  let fitting=[...notebook.training], discovery=discoverCoupling(fitting,notebook.options);
  const baseline=discovery,history=[];
  for(const event of notebook.revisions) {
    const prior=discovery;
    const frozen=prior.candidates.map(model=>({modelId:model.id,...evaluateCoupling(model,[event.observation])}));
    fitting=[...fitting,event.observation];discovery=discoverCoupling(fitting,notebook.options);
    history.push({observation:event.observation,candidateIndex:event.candidateIndex,beforeModel:prior.selected?.id??null,afterModel:discovery.selected?.id??null,frozen});
  }
  const evaluations=discovery.candidates.map(model=>({modelId:model.id,...evaluateCoupling(model,notebook.challenges)}));
  return {notebook,baseline,discovery,evaluations,history,plan:planCoupling(discovery,notebook.permitted),
    baselineEvaluation:baseline.selected?evaluateCoupling(baseline.selected,notebook.challenges):null};
}
export function addCouplingObservation(raw,candidateIndex,rawObservation) {
  const notebook=readCouplingNotebook(raw);
  const next={...clone(notebook),revisions:[...clone(notebook.revisions),{candidateIndex,observation:rawObservation}]};
  return readCouplingNotebook(next);
}
export function exportCouplingNotebook(raw) {
  const text=JSON.stringify(readCouplingNotebook(raw));
  requireThat(new TextEncoder().encode(text).length<=2*1024*1024,'Notebook exceeds 2 MB.');
  return text;
}
