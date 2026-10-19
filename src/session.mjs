import {discover, evaluate, revise, planExperiment} from './science/torque-discovery.mjs';
import {createLab, executeLab} from './science/virtual-lab.mjs';
import {validateDataset, validateRows, candidateGrid, FIELDS, MAX_ROWS, MAX_TEXT_LENGTH} from './data.mjs';

export const SESSION_SCHEMA='worldlaw.session/v1';
export const DEFAULT_OPTIONS=Object.freeze({noiseSigma:0.01,maxTerms:4,ambiguityDelta:6});
const MAX_EVENTS=128;
function validSeed(seed){if(!Number.isSafeInteger(seed)||Math.abs(seed)>1e9)throw new Error('Invalid virtual instrument seed. Use an integer between −1000000000 and 1000000000.');return seed;}
function matchesVirtualSeed(rows,expected) {
  // Math.sin/cos can differ by a few rounding bits between JS runtimes. This is
  // only a seed-baseline compatibility check; the supplied evidence is retained.
  return rows.length===expected.length && rows.every((row,i)=>FIELDS.every(field=>
    Number.isFinite(row[field]) && Number.isFinite(expected[i][field]) &&
    Math.abs(row[field]-expected[i][field])<=16*Number.EPSILON*Math.max(1,Math.abs(row[field]),Math.abs(expected[i][field]))));
}
const cleanOptions = options => {
  const result={...DEFAULT_OPTIONS};
  for (const key of Object.keys(DEFAULT_OPTIONS)) if(options?.[key] !== undefined) result[key]=options[key];
  if(!Number.isFinite(result.noiseSigma) || result.noiseSigma<1e-7 || result.noiseSigma>1000) throw new Error('Assumed sensor noise must be between 0.0000001 and 1000 N·m.');
  if(!Number.isInteger(result.maxTerms) || result.maxTerms<1 || result.maxTerms>7 || !Number.isFinite(result.ambiguityDelta) || result.ambiguityDelta<0 || result.ambiguityDelta>100) throw new Error('Unsupported discovery options.');
  return result;
};
function summary(discovery,heldOut,label,kind) {
  return {label,kind,count:discovery.observations.length,modelId:discovery.selected.id,equation:discovery.selected.equation,rmse:discovery.selected.metrics.rmse,heldOutRMSE:evaluate(discovery.selected,heldOut).rmse};
}
export function createSession(dataset,options=DEFAULT_OPTIONS,{labSeed=null}={}) {
  const base=validateDataset(dataset,dataset?.source?.label); const lab=labSeed === null ? null : {seed:validSeed(labSeed)};
  if(lab) {
    const fixture=createLab({seed:labSeed});
    if(!matchesVirtualSeed(base.observations,validateRows(fixture.initialSamples)) || !matchesVirtualSeed(base.heldOut,validateRows(fixture.evaluationSamples,{allowEmpty:true}))) throw new Error('Virtual instrument data does not match its declared seed.');
    base.source={label:fixture.label,kind:'synthetic-virtual-instrument',units:{...base.source.units}};
  }
  const initialOptions=cleanOptions(options); const discovery=discover(base.observations,initialOptions);
  return {schema:SESSION_SCHEMA,base,lab,initialOptions,options:initialOptions,events:[],discovery,history:[summary(discovery,base.heldOut,'Initial observations','initial')]};
}
export function newVirtualSession(seed=17) {
  validSeed(seed);const lab=createLab({seed});
  return createSession({source:{label:lab.label},observations:lab.initialSamples,heldOut:lab.evaluationSamples},lab.options,{labSeed:seed});
}
function eventState(state,event,discovery,options=state.options) {
  if(state.events.length>=MAX_EVENTS) throw new Error(`This notebook supports ${MAX_EVENTS} revisions. Export it before starting a new notebook.`);
  return {...state,options,discovery,events:[...state.events,event],history:[...state.history,summary(discovery,state.base.heldOut,event.label,event.kind)]};
}
export function appendMeasurements(state,rows,label='Measured outcome') {
  if(state.lab) throw new Error('This notebook is connected to a virtual instrument. Import measured observations to start an instrument notebook.');
  rows=validateRows(rows,{allowEmpty:true});
  if(!rows.length || state.discovery.observations.length+rows.length>MAX_ROWS) throw new Error('The measurement batch is empty or exceeds the observation limit.');
  const event={kind:'measurement',label:String(label).slice(0,160),rows};
  return eventState(state,event,revise(state.discovery,rows));
}
export function runVirtualExperiment(state,input) {
  if(!state.lab) throw new Error('Virtual experiments are available only in the virtual instrument notebook. Enter a measured outcome for your imported data.');
  const experimentIndex=state.events.filter(e=>e.kind==='virtual').length;
  const row=executeLab(input,{experimentIndex,seed:state.lab.seed});
  if(state.discovery.observations.length+1>MAX_ROWS) throw new Error('Observation limit reached. Export this notebook before starting another.');
  const event={kind:'virtual',label:`Virtual experiment ${experimentIndex+1}`,input:{command:row.command,position:row.position,rate:row.rate}};
  return eventState(state,event,revise(state.discovery,[row]));
}
export function refitSession(state,options) {
  options=cleanOptions({...state.options,...options});
  return eventState(state,{kind:'options',label:'Revised noise assumption',options},discover(state.discovery.observations,options),options);
}
export function sessionPlan(state) {
  const source=state.lab ? createLab({seed:state.lab.seed}).candidateInputs : candidateGrid(state.base.observations);
  const key = p => ['command','position','rate'].map(f=>p[f].toPrecision(12)).join('|');
  const observed=new Set(state.discovery.observations.map(key));
  const candidates=source.filter(p=>!observed.has(key(p)));
  return candidates.length ? planExperiment(state.discovery,candidates) : {status:'no_unobserved_inputs',selected:null,ranked:[],modelIds:[]};
}
export function exportSession(state) {
  return JSON.stringify({schema:SESSION_SCHEMA,base:state.base,lab:state.lab,initialOptions:state.initialOptions,events:state.events},null,2);
}
export function restoreSession(text) {
  if(typeof text!=='string' || text.length>MAX_TEXT_LENGTH) throw new Error('Notebook must be JSON smaller than 2 MB.');
  let raw; try{raw=JSON.parse(text);}catch{throw new Error('The notebook JSON could not be read.');}
  if(raw?.schema!==SESSION_SCHEMA || !Array.isArray(raw.events) || raw.events.length>MAX_EVENTS) throw new Error('Unsupported or incomplete WORLDLAW notebook.');
  if(raw.lab) validSeed(raw.lab.seed);
  let state=createSession(raw.base,raw.initialOptions,{labSeed:raw.lab?.seed??null});
  for(const event of raw.events) {
    if(event?.kind==='virtual') state=runVirtualExperiment(state,event.input);
    else if(event?.kind==='measurement') state=appendMeasurements(state,event.rows,event.label);
    else if(event?.kind==='options') state=refitSession(state,event.options);
    else throw new Error('Notebook contains an unknown event.');
  }
  return state;
}
export function undoSession(state) {
  if(!state.events.length) return state;
  const raw=JSON.parse(exportSession(state)); raw.events.pop(); return restoreSession(JSON.stringify(raw));
}
