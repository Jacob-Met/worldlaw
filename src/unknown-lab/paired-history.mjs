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
  if(input.sampleIndex!==undefined) {
    if(!Number.isSafeInteger(input.sampleIndex)||input.sampleIndex<0||input.sampleIndex>1e9)
      fail('sampleIndex must be a nonnegative safe measurement order index at most 1e9.');
    result.sampleIndex=input.sampleIndex;
  }
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
  const all=[...groups.values()].flat();
  const indexed=all.some(trial=>trial.sampleIndex!==undefined);
  if(indexed) {
    if(all.some(trial=>trial.sampleIndex===undefined)) fail('sampleIndex must be supplied on every trial when declaring measurement order.');
    if(new Set(all.map(trial=>trial.sampleIndex)).size!==all.length) fail('Measurement sampleIndex must be unique across all trials.');
  }
  const pairs=[];
  for(const [id,entries] of groups) {
    if(entries.length!==2 || entries[0].history===entries[1].history) fail('Each pair needs one reference and one conditioned observation.');
    const reference=entries.find(e=>e.history==='reference'), conditioned=entries.find(e=>e.history==='conditioned');
    for(const field of Object.keys(MATCH)) {
      if(Math.abs(reference[field]-conditioned[field])>MATCH[field]) fail('Pair '+id+' is not matched on '+field+' (tolerance '+MATCH[field]+').');
    }
    if(indexed && Math.abs(reference.sampleIndex-conditioned.sampleIndex)!==1)
      fail('Each declared measurement-order pair needs adjacent sampleIndex values.');
    pairs.push({id,reference,conditioned,difference:conditioned.jointTorque-reference.jointTorque});
  }
  const sourceNote=typeof raw.sourceNote==='string' ? raw.sourceNote.slice(0,240):'';
  let simulation;
  // Measured imports intentionally discard any incidental virtual-only metadata.
  // Their declared provenance remains sourceNote; synthetic params cannot authenticate them.
  if(raw.simulation!==undefined && raw.source==='synthetic') {
    if(!raw.simulation || typeof raw.simulation!=='object' || Array.isArray(raw.simulation))
      fail('Invalid virtual simulation metadata.');
    const x=raw.simulation;
    if(!Number.isSafeInteger(x.seed)||Math.abs(x.seed)>1e9 ||
      !Number.isInteger(x.count)||x.count!==pairs.length ||
      !['oneway','alternating','shuffled'].includes(x.orderStrategy))
      fail('Simulation seed, count or orderStrategy is invalid.');
    for(const key of ['effect','duration','driftPerReading','cycleDriftAmplitude']) finite(x[key],key,100);
    if(x.duration<0 || x.duration>30 || Math.abs(x.driftPerReading)>10 || Math.abs(x.cycleDriftAmplitude)>10)
      fail('Simulation parameter is out of range.');
    simulation={seed:x.seed,count:x.count,effect:x.effect,duration:x.duration,
      driftPerReading:x.driftPerReading,cycleDriftAmplitude:x.cycleDriftAmplitude,orderStrategy:x.orderStrategy};
  }
  return {schema:SCHEMA,source:raw.source,sourceNote,noiseSigma:sigma,trials:pairs.flatMap(p=>[p.reference,p.conditioned]),pairs,
    ...(simulation?{simulation}:{})};
}
const average=values=>values.reduce((sum,value)=>sum+value,0)/values.length;
function sampleVariance(values) {
  const center=average(values);
  return values.reduce((sum,value)=>sum+(value-center)**2,0)/(values.length-1);
}
export function evaluateHistory(raw) {
  const notebook=validateNotebook(raw), differences=notebook.pairs.map(p=>p.difference);
  const count=differences.length, mean=average(differences);
  const naiveError=Math.sqrt((sampleVariance(differences)+2*notebook.noiseSigma**2)/count);
  const naiveBoundary=3*naiveError;
  const naiveVerdict=Math.abs(mean)>naiveBoundary?'challenged':'inconclusive';
  let order={status:'unrecorded',referenceFirst:null,conditionedFirst:null,historyEstimate:null,driftPerStep:null,boundary:null};
  let decisionDifference=mean, standardError=naiveError, verdict=naiveVerdict;
  if(notebook.pairs[0].reference.sampleIndex!==undefined) {
    const referenceFirst=notebook.pairs.filter(p=>p.reference.sampleIndex<p.conditioned.sampleIndex).map(p=>p.difference);
    const conditionedFirst=notebook.pairs.filter(p=>p.conditioned.sampleIndex<p.reference.sampleIndex).map(p=>p.difference);
    order={status:'unbalanced',referenceFirst:referenceFirst.length,conditionedFirst:conditionedFirst.length,
      historyEstimate:null,driftPerStep:null,boundary:null};
    // Linear drift per consecutive instrument reading enters the pair
    // difference with opposite signs in the two orders. A balanced crossover
    // separates the two mean effects, but NOT nonlinear or preparation drift.
    if(referenceFirst.length>=4 && conditionedFirst.length>=4) {
      const plus=average(referenceFirst), minus=average(conditionedFirst);
      const historyEstimate=(plus+minus)/2, driftPerStep=(plus-minus)/2;
      const correctionVariance=.25*((sampleVariance(referenceFirst)+2*notebook.noiseSigma**2)/referenceFirst.length+
        (sampleVariance(conditionedFirst)+2*notebook.noiseSigma**2)/conditionedFirst.length);
      standardError=Math.sqrt(correctionVariance);
      decisionDifference=historyEstimate;
      order={status:'counterbalanced',referenceFirst:referenceFirst.length,conditionedFirst:conditionedFirst.length,
        historyEstimate,driftPerStep,boundary:3*standardError};
      verdict=Math.abs(historyEstimate)>3*standardError?'challenged':'inconclusive';
    } else {
      // A one-order or sparse-order dataset can demonstrate disagreement but
      // cannot separate the preparation effect from linear acquisition drift.
      verdict='inconclusive';
    }
  }
  const boundary=3*standardError;
  const errors=differences.filter(d=>Math.abs(d)>3*Math.SQRT2*notebook.noiseSigma).length;
  const interpretation=order.status==='unbalanced'
    ? 'Paired readings differ, but chronological AB/BA order is not sufficiently counterbalanced (four pairs per order are required). A sequential instrument drift could mimic a history effect; no corrected history conclusion is admitted.'
    : verdict==='challenged'
      ? order.status==='counterbalanced'
        ? 'The counterbalanced preparation contrast exceeds its three-standard-error screen after allowing for linear per-reading drift. The current-state-only law is challenged under that model. Nonlinear drift, carryover, hidden confounders and measurement provenance remain open.'
        : 'The pair contrast exceeds its declared screening bound, but measurement order was not recorded. Current-state-only torque is challenged under that assumption, not proven physically history-dependent.'
      : order.status==='counterbalanced'
        ? 'After counterbalancing the measurement order, the preparation contrast does not clear the screening bound. An apparent unadjusted offset may be instrument drift. A smaller history effect cannot be excluded.'
        : 'Paired readings do not clear the declared screening bound. This does not establish memorylessness or rule out smaller effects.';
  return {schema:'worldlaw.history-result/v1',source:notebook.source,count,meanDifference:mean,
    naiveBoundary,naiveVerdict,decisionDifference,standardError,boundary,
    interval:[decisionDifference-boundary,decisionDifference+boundary],verdict,
    order,pairsAboveInstrumentNoise:errors,pairs:notebook.pairs,interpretation};
}
function generator(seed) {
  let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return (s+.5)/4294967296;};
}
export function syntheticChallenge({count=16,seed=41,noiseSigma=.02,effect=.7,duration=2.4,
  driftPerReading=0,counterbalanced=true,cycleDriftAmplitude=0,orderStrategy=null}={}) {
  if(!Number.isInteger(count)||count<4||count>MAX_PAIRS) fail('count must be an integer from 4 through 128.');
  if(!Number.isSafeInteger(seed)||Math.abs(seed)>1e9) fail('seed must be a bounded integer.');
  finite(noiseSigma,'noiseSigma',1000);if(noiseSigma<1e-8) fail('noiseSigma must be positive.');
  finite(effect,'effect',100);finite(duration,'duration',30);if(duration<0) fail('duration must be nonnegative.');
  finite(driftPerReading,'driftPerReading',10);
  finite(cycleDriftAmplitude,'cycleDriftAmplitude',10);
  if(typeof counterbalanced!=='boolean') fail('counterbalanced must be boolean.');
  const strategy=orderStrategy??(counterbalanced?'shuffled':'oneway');
  if(!['oneway','alternating','shuffled'].includes(strategy)) fail('Unsupported measurement order strategy.');
  // A separate generator means changing the order cannot change the physical
  // state/noise oracle; the intended comparison is strictly equal-input.
  const random=generator(seed);
  const orderRandom=generator(seed ^ 0x9e3779b9);
  const sequence=Array.from({length:count},(_,i)=>i<count/2);
  if(strategy==='shuffled')for(let i=sequence.length-1;i>0;i--){
    const j=Math.floor(orderRandom()*(i+1));
    [sequence[i],sequence[j]]=[sequence[j],sequence[i]];
  }
  // Independent, declared synthetic oracle. Reference/conditioned share exactly
  // the same visible state; the unobserved preparation is not a measured fact.
  const memory=effect*(1-Math.exp(-duration/1.3));
  const trials=[];
  for(let i=0;i<count;i++) {
    const state={command:(random()-.5)*1.1,position:(random()-.5)*1.8,rate:(random()-.5)*1.3};
    const base=1.45*state.command-2.2*Math.sin(state.position)-.34*state.rate;
    const perturb=()=>noiseSigma*Math.sqrt(12)*(random()-.5);
    const pairId='synthetic-'+String(i+1).padStart(3,'0');
    const referenceFirst=strategy==='oneway'||(strategy==='alternating'?i%2===0:sequence[i]);
    const referenceIndex=2*i+(referenceFirst?0:1);
    const conditionedIndex=2*i+(referenceFirst?1:0);
    const drift=index=>driftPerReading*index+cycleDriftAmplitude*Math.sin(Math.PI*index/2);
    trials.push({pairId,history:'reference',...state,sampleIndex:referenceIndex,
      jointTorque:base+drift(referenceIndex)+perturb()});
    trials.push({pairId,history:'conditioned',...state,sampleIndex:conditionedIndex,
      jointTorque:base+memory+drift(conditionedIndex)+perturb()});
  }
  return {schema:SCHEMA,source:'synthetic',noiseSigma,
    sourceNote:'Declared virtual history oracle; sensor drift and preparation parameters are simulated, not physical observations.',
    simulation:{seed,count,effect,duration,driftPerReading,cycleDriftAmplitude,orderStrategy:strategy},
    trials};
}
export function exportNotebook(raw) {
  const n=validateNotebook(raw);
  return JSON.stringify({schema:SCHEMA,source:n.source,sourceNote:n.sourceNote,noiseSigma:n.noiseSigma,
    ...(n.simulation?{simulation:n.simulation}:{}),trials:n.trials},null,2)+'\n';
}
export function importNotebook(source) {
  if(typeof source!=='string'||source.length>200000) fail('Use UTF-8 JSON under 200 KB.');
  let parsed;try{parsed=JSON.parse(source);}catch{fail('Invalid JSON notebook.');}
  const n=validateNotebook(parsed);
  return JSON.parse(exportNotebook(n));
}
