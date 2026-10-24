// UNKNOWN LAB: state sufficiency challenge. Local, dependency-free browser ESM.
// A paired difference challenges a memoryless model; it cannot prove hidden state.
export const SCHEMA = 'worldlaw.history-challenge/v1';
const MAX_PAIRS = 128;
const FIELDS = ['command', 'position', 'rate', 'jointTorque'];
const MATCH = Object.freeze({command:0.001,position:0.001,rate:0.001});
function fail(message) { throw new Error(message); }
function finite(value, name, bound=1e6) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value)>bound) fail(name+' must be a bounded finite number.');
  return value;
}
function text(value, name) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_:-]{1,64}$/.test(value)) fail(name+' must be a short safe identifier.');
  return value;
}
function row(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('A trial must be an object.');
  const pairId=text(input.pairId,'pairId'), history=input.history;
  if (history !== 'reference' && history !== 'conditioned') fail('history must be reference or conditioned.');
  const result={pairId,history};
  for(const field of FIELDS) result[field]=finite(input[field],field);
  return result;
}
export function validateNotebook(raw) {
  if (!raw || raw.schema!==SCHEMA || (raw.source!=='synthetic' && raw.source!=='measured')) fail('Expected a WORLDLAW history-challenge notebook with declared source.');
  const sigma=finite(raw.noiseSigma,'noiseSigma',1e3);
  if (sigma < 1e-8) fail('noiseSigma must be at least 1e-8 N·m.');
  if (!Array.isArray(raw.trials) || raw.trials.length<8 || raw.trials.length>MAX_PAIRS*2 || raw.trials.length%2!==0) fail('Require 4 to 128 complete pairs.');
  const groups=new Map();
  for (const trial of raw.trials.map(row)) {
    if(!groups.has(trial.pairId)) groups.set(trial.pairId,[]);
    groups.get(trial.pairId).push(trial);
  }
  if(groups.size*2!==raw.trials.length) fail('Each pair needs exactly two trials.');
  const pairs=[];
  for(const [id,entries] of groups) {
    if(entries.length!==2 || entries[0].history===entries[1].history) fail('Each pair needs one reference and one conditioned observation.');
    const reference=entries.find(e=>e.history==='reference'), conditioned=entries.find(e=>e.history==='conditioned');
    for(const field of Object.keys(MATCH)) {
      if(Math.abs(reference[field]-conditioned[field])>MATCH[field]) fail('Pair '+id+' is not matched on '+field+' (tolerance '+MATCH[field]+').');
    }
    pairs.push({id,reference,conditioned,difference:conditioned.jointTorque-reference.jointTorque});
  }
  const sourceNote=typeof raw.sourceNote==='string' ? raw.sourceNote.slice(0,240):'';
  return {schema:SCHEMA,source:raw.source,sourceNote,noiseSigma:sigma,trials:pairs.flatMap(p=>[p.reference,p.conditioned]),pairs};
}
export function evaluateHistory(raw) {
  const n=validateNotebook(raw), differences=n.pairs.map(p=>p.difference);
  const count=differences.length, mean=differences.reduce((a,b)=>a+b,0)/count;
  const sampleVar=differences.reduce((s,x)=>s+(x-mean)**2,0)/(count-1);
  // Instrument noise and inter-pair variation are conservatively combined.
  // Three standard errors is a screening boundary, not a calibrated p-value.
  const standardError=Math.sqrt((sampleVar+2*n.noiseSigma**2)/count);
  const boundary=3*standardError;
  const verdict=Math.abs(mean)>boundary?'challenged':'inconclusive';
  const errors=differences.filter(d=>Math.abs(d)>3*Math.SQRT2*n.noiseSigma).length;
  return {schema:'worldlaw.history-result/v1',source:n.source,count,meanDifference:mean,
    standardError,boundary,interval:[mean-boundary,mean+boundary],verdict,
    pairsAboveInstrumentNoise:errors,pairs:n.pairs,
    interpretation:verdict==='challenged'
      ? 'Matched visible states produced systematic history-associated torque differences above the declared screening bound. A current-state-only deterministic torque law is challenged; sensor drift, unmeasured conditions and provenance still require investigation.'
      : 'The observed pair differences do not clear the declared screening bound. This does not establish memorylessness or rule out smaller effects.'};
}
function generator(seed) {
  let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return (s+.5)/4294967296;};
}
export function syntheticChallenge({count=16,seed=41,noiseSigma=.02,effect=.7,duration=2.4}={}) {
  if(!Number.isInteger(count)||count<4||count>MAX_PAIRS) fail('count must be an integer from 4 through 128.');
  if(!Number.isSafeInteger(seed)||Math.abs(seed)>1e9) fail('seed must be a bounded integer.');
  finite(noiseSigma,'noiseSigma',1000);if(noiseSigma<1e-8) fail('noiseSigma must be positive.');
  finite(effect,'effect',100);finite(duration,'duration',30);if(duration<0) fail('duration must be nonnegative.');
  const random=generator(seed);
  // Independent, declared synthetic oracle. Reference/conditioned share exactly
  // the same visible state; the unobserved preparation is not a measured fact.
  const memory=effect*(1-Math.exp(-duration/1.3));
  const trials=[];
  for(let i=0;i<count;i++) {
    const state={command:(random()-.5)*1.1,position:(random()-.5)*1.8,rate:(random()-.5)*1.3};
    const base=1.45*state.command-2.2*Math.sin(state.position)-.34*state.rate;
    const perturb=()=>noiseSigma*Math.sqrt(12)*(random()-.5);
    const pairId='synthetic-'+String(i+1).padStart(3,'0');
    trials.push({pairId,history:'reference',...state,jointTorque:base+perturb()});
    trials.push({pairId,history:'conditioned',...state,jointTorque:base+memory+perturb()});
  }
  return {schema:SCHEMA,source:'synthetic',noiseSigma,sourceNote:'Declared virtual preconditioning oracle; latent effect and duration are simulation parameters, not physical observations.',trials};
}
export function exportNotebook(raw) {
  const n=validateNotebook(raw);
  return JSON.stringify({schema:SCHEMA,source:n.source,sourceNote:n.sourceNote,noiseSigma:n.noiseSigma,trials:n.trials},null,2)+'\n';
}
export function importNotebook(source) {
  if(typeof source!=='string'||source.length>200000) fail('Use UTF-8 JSON under 200 KB.');
  let parsed;try{parsed=JSON.parse(source);}catch{fail('Invalid JSON notebook.');}
  const n=validateNotebook(parsed);
  return JSON.parse(exportNotebook(n));
}
