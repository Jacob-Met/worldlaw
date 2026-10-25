/** Original Franka/NAD link-side response, deliberately separate from net dynamics. */
import {csvRecords,MAX_ROWS,MAX_TEXT_LENGTH} from '../data.mjs';
import {compareCommandDeadzones,evaluateDeadzone} from './command-deadzone.mjs';

export const RESPONSE_SCHEMA='worldlaw.link-sensor-response-inputs/v1';
export const RESPONSE_ROLE='link-side-torque-sensor';
export const RESPONSE_CONVENTION='NAD-Franka-link-side-SI/v1';
export const MAX_RESPONSE_NOTEBOOK_BYTES=5_000_000;
const sources=new WeakMap(),fits=new WeakMap();
const decimal=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const requireThat=(ok,message)=>{if(!ok)throw Error(message);};
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
export function decodeSensorCSV(bytes){return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}
function exactKeys(object,keys,label){requireThat(object&&typeof object==='object'&&!Array.isArray(object)&&Object.keys(object).length===keys.length&&keys.every(k=>Object.hasOwn(object,k)),`${label} must contain only original inputs and declarations.`);}

export async function readSensorRecording(csv,{joint,label,convention}={}) {
  requireThat(convention===RESPONSE_CONVENTION,'Declare NAD Franka link-side SI channel conventions before interpreting the CSV.');
  requireThat(Number.isInteger(joint)&&joint>=1&&joint<=7,'Declare joint 1–7.');
  requireThat(typeof label==='string'&&label.trim().length>0&&label.length<=500,'Declare a source identity of 1–500 characters.');
  requireThat(typeof csv==='string'&&csv.isWellFormed(),'Original CSV must be well-formed Unicode decoded from valid UTF-8 bytes.');
  requireThat(new TextEncoder().encode(csv).length<=MAX_TEXT_LENGTH,'Original CSV must be no larger than 2 MB.');
  const records=csvRecords(csv.replace(/^\uFEFF/,'')),headers=records.shift()?.map(x=>x.trim());
  const columns={time:'timestamp',command:`tau_d${joint}`,position:`pos${joint}`,rate:`vel${joint}`,response:`tau${joint}`};
  requireThat(headers&&new Set(headers).size===headers.length&&Object.values(columns).every(c=>headers.includes(c)),'Original CSV requires unique timestamp, commanded torque, position, rate and link-side torque columns for the declared joint.');
  requireThat(records.length>=8&&records.length<=MAX_ROWS,`Supply 8–${MAX_ROWS} original rows; no thinning is performed.`);
  const rows=records.map((record,index)=>{
    requireThat(record.length===headers.length,`Original row ${index+2} has the wrong field count.`);
    const row={sourceRow:index+2};
    for(const [field,column] of Object.entries(columns)){
      const cell=record[headers.indexOf(column)].trim();
      requireThat(decimal.test(cell),`Original row ${index+2}: ${column} must be a decimal number.`);
      const value=Number(cell);requireThat(Number.isFinite(value)&&Math.abs(value)<=1e6,`Original row ${index+2}: ${column} exceeds the finite range.`);row[field]=value;
    }
    requireThat(row.time>=0&&(index===0||row.time>Number(records[index-1][headers.indexOf(columns.time)])),`Original row ${index+2}: timestamps must increase strictly from a nonnegative origin.`);
    return row;
  });
  const source=freeze({schema:'worldlaw.link-sensor-recording/v1',role:RESPONSE_ROLE,convention,joint,label:label.trim(),sha256:await hash(csv),columns,units:{time:'s',command:'N·m',position:'rad',rate:'rad/s',response:'N·m'},rows});
  sources.set(source,{csv,declaration:{joint,label:label.trim(),convention}});return source;
}
// Adaptation is private. No ordinary observation/model envelope is emitted.
const internalRows=source=>source.rows.map(r=>({command:r.command,position:r.position,rate:r.rate,jointTorque:r.response}));
function admittedSource(source){requireThat(sources.has(source),'Use an admitted original sensor recording, not derived or forged rows.');return source;}
export function freezeSensorResponse(source,widths,options,budget) {
  admittedSource(source);
  const fit=compareCommandDeadzones(internalRows(source),widths,options,budget);
  const result=freeze({schema:'worldlaw.link-sensor-response-fit/v1',role:RESPONSE_ROLE,source,
    candidates:fit.candidates.map(c=>({width:c.width,terms:c.model.terms,equation:c.model.equation,metrics:c.model.metrics,diagnostics:c.diagnostics})),
    selectedWidth:fit.selected.width,competitiveWidths:fit.competitiveWidths,options:fit.options,work:fit.work,
    interpretation:'Conditional sensor response at supplied contemporaneous position/rate/command. Algebraic coefficients are not identified mechanical properties. This is not net torque, a causal command effect or a free-running motion forecast.'});
  fits.set(result,fit);return result;
}
export function receiveSensorResponse(frozen,source) {
  requireThat(fits.has(frozen),'Freeze an admitted training fit before receiving another recording.');admittedSource(source);
  requireThat(source.joint===frozen.source.joint&&source.convention===frozen.source.convention,'Receiving must preserve the declared joint and channel convention.');
  requireThat(source.sha256!==frozen.source.sha256&&source.label!==frozen.source.label,'Receiving requires a separately identified recording, not the training source.');
  const fit=fits.get(frozen);
  return freeze({schema:'worldlaw.link-sensor-response-receiving/v1',source,trainingSha256:frozen.source.sha256,selectedWidth:frozen.selectedWidth,
    candidates:fit.candidates.map(c=>{const result=evaluateDeadzone(c,internalRows(source));return {width:c.width,rmse:result.rmse,maxAbsResidual:result.maxAbsResidual,
      rows:result.rows.map((r,i)=>({...source.rows[i],mappedCommand:r.mappedCommand,prediction:r.prediction,residual:r.residual}))};})});
}
export function sensorTrainingPredictions(frozen){
  requireThat(fits.has(frozen),'Freeze an admitted training fit first.');
  return freeze(fits.get(frozen).candidates.map(c=>{const result=evaluateDeadzone(c,internalRows(frozen.source));return {width:c.width,rmse:result.rmse,rows:result.rows.map((r,i)=>({...frozen.source.rows[i],prediction:r.prediction,residual:r.residual}))};}));
}
export function sensorResponseDynamics(){throw Error('Link-side sensor response cannot be adopted as net torque or simulated as motion. A separate calibrated dynamics contract is required.');}
export function exportSensorResponseInputs(frozen,receiving=null){
  requireThat(fits.has(frozen),'Freeze original training inputs before saving.');
  if(receiving)receiveSensorResponse(frozen,receiving);
  const text=JSON.stringify({schema:RESPONSE_SCHEMA,training:sources.get(frozen.source),widths:frozen.candidates.map(c=>c.width),options:frozen.options,receiving:receiving?sources.get(receiving):null},null,2);
  requireThat(new TextEncoder().encode(text).length<=MAX_RESPONSE_NOTEBOOK_BYTES,'Original response inputs exceed the 5 MB portable notebook limit; no incomplete notebook is saved.');return text;
}
export async function restoreSensorResponseInputs(text){
  requireThat(typeof text==='string'&&new TextEncoder().encode(text).length<=MAX_RESPONSE_NOTEBOOK_BYTES,'Response input notebook must be no larger than 5 MB.');
  const input=JSON.parse(text);exactKeys(input,['schema','training','widths','options','receiving'],'Response notebook');
  requireThat(input.schema===RESPONSE_SCHEMA,'Unsupported response input notebook schema.');
  const read=async value=>{exactKeys(value,['csv','declaration'],'Recording');exactKeys(value.declaration,['joint','label','convention'],'Source declaration');return readSensorRecording(value.csv,value.declaration);};
  const training=await read(input.training),frozen=freezeSensorResponse(training,input.widths,input.options);
  // Recompute/freeze exclusively from training before reading receiving rows.
  const receiving=input.receiving?await read(input.receiving):null;
  return {frozen,receiving,result:receiving?receiveSensorResponse(frozen,receiving):null};
}
