// A prospective, user-declared measurement course. This module generates an
// order, never observations, and preserves the paired-history evaluator's gates.
import {SCHEMA as NOTEBOOK_SCHEMA,exportNotebook,importNotebook} from './paired-history.mjs';

export const SCHEMA='worldlaw.history-acquisition/v1';
const ACTUAL_FIELDS=['command','position','rate','jointTorque'];
const STATE_FIELDS=['command','position','rate'];
const REQUEST_FIELDS=['id','count','seed','noiseSigma','command','position','rate','preparation','sourceNote'];
const READING_FIELDS=['pairId','history','sampleIndex',...ACTUAL_FIELDS];
const TARGET_TOLERANCE=.001;

function fail(message){throw new Error(message);}
function shape(value,keys,name){
 if(!value||typeof value!=='object'||Array.isArray(value)||
    ![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail(name+' must be an input object.');
 if(Reflect.ownKeys(value).length!==keys.length||keys.some(key=>!Object.hasOwn(value,key))||
    Reflect.ownKeys(value).some(key=>!keys.includes(key)))fail(name+' contains missing or unsupported fields.');
}
function finite(value,name,bound=1e6){
 if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>bound)
  fail(name+' must be a bounded finite number.');
 return value;
}
function declaration(value,name,max){
 if(typeof value!=='string'||!value.trim()||value.trim().length>max)
  fail(name+' must be nonblank text of at most '+max+' characters.');
 return value.trim();
}
function request(raw){
 shape(raw,REQUEST_FIELDS,'Acquisition request');
 if(typeof raw.id!=='string'||!/^[a-zA-Z0-9_-]{1,24}$/.test(raw.id))fail('Course identifier must contain 1–24 letters, digits, underscores or hyphens.');
 if(!Number.isInteger(raw.count)||raw.count<8||raw.count>128||raw.count%2!==0)
  fail('Require an even count from 8 through 128 pairs.');
 if(!Number.isSafeInteger(raw.seed)||Math.abs(raw.seed)>1e9)fail('Order seed must be an integer between -1e9 and 1e9.');
 const noiseSigma=finite(raw.noiseSigma,'Declared noise',1000);
 if(noiseSigma<1e-8)fail('Declared noise must be at least 1e-8 N·m.');
 return {id:raw.id,count:raw.count,seed:raw.seed,noiseSigma,
  command:finite(raw.command,'Target command'),position:finite(raw.position,'Target angle'),rate:finite(raw.rate,'Target rate'),
  preparation:declaration(raw.preparation,'Preparation and reset procedure',160),
  sourceNote:declaration(raw.sourceNote,'Measurement source',120)};
}
function schedule(r){
 // Balanced AB/BA counts support the existing linear-drift contrast. Seeded
 // shuffling is reproducible, not an assurance against unmodelled confounders.
 let state=(r.seed^0x9e3779b9)>>>0;
 const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state+.5)/4294967296;};
 const first=Array.from({length:r.count},(_,i)=>i<r.count/2);
 for(let i=first.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[first[i],first[j]]=[first[j],first[i]];}
 return first.flatMap((referenceFirst,i)=>{
  const pairId=r.id+':p'+String(i+1).padStart(3,'0');
  return (referenceFirst?['reference','conditioned']:['conditioned','reference']).map((history,j)=>
   ({pairId,history,sampleIndex:2*i+j}));
 });
}
function freeze(value){
 if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}
 return value;
}

export function createHistoryAcquisition(settings){
 const declared=request(settings);
 return freeze({schema:SCHEMA,request:declared,readings:schedule(declared).map(slot=>
  ({...slot,command:null,position:null,rate:null,jointTorque:null})),orderConfirmed:false});
}

export function validateHistoryAcquisition(raw){
 shape(raw,['schema','request','readings','orderConfirmed'],'Acquisition worksheet');
 if(raw.schema!==SCHEMA)fail('Expected a WORLDLAW history-acquisition/v1 worksheet.');
 const declared=request(raw.request),planned=schedule(declared);
 if(typeof raw.orderConfirmed!=='boolean')fail('Acquisition order confirmation must be an explicit boolean declaration.');
 if(!Array.isArray(raw.readings)||raw.readings.length!==planned.length)
  fail('The worksheet must retain every declared reading slot.');
 const readings=new Array(planned.length);
 for(const input of raw.readings){
  shape(input,READING_FIELDS,'Actual reading');
  const index=input.sampleIndex;
  if(!Number.isSafeInteger(index)||index<0||index>=planned.length||readings[index])
   fail('Each reading must retain its unique declared sampleIndex.');
  const slot=planned[index];
  if(input.pairId!==slot.pairId||input.history!==slot.history)
   fail('Reading '+(index+1)+' does not match its declared pair and preparation.');
  const reading={...slot};
  for(const field of ACTUAL_FIELDS)reading[field]=input[field]===null?null:finite(input[field],'Reading '+(index+1)+' '+field);
  readings[index]=reading;
 }
 // The returned array is chronological even when a portable file is reordered.
 // No caller-owned data is retained or modified.
 return freeze({schema:SCHEMA,request:declared,readings,orderConfirmed:raw.orderConfirmed});
}

export function exportHistoryAcquisition(raw){
 return JSON.stringify(validateHistoryAcquisition(raw),null,2)+'\n';
}
export function importHistoryAcquisition(text){
 if(typeof text!=='string'||text.length>500000)fail('Use acquisition JSON below 500 KB.');
 let raw;try{raw=JSON.parse(text);}catch{fail('Invalid acquisition JSON.');}
 return validateHistoryAcquisition(raw);
}
export function completeHistoryAcquisition(raw){
 const course=validateHistoryAcquisition(raw),r=course.request;
 if(!course.orderConfirmed)fail('Explicitly declare that the readings were acquired in the displayed order with the stated preparation.');
 for(const reading of course.readings){
  for(const field of ACTUAL_FIELDS)if(reading[field]===null)fail('Reading '+(reading.sampleIndex+1)+' is missing actual '+field+'.');
  for(const field of STATE_FIELDS)if(Math.abs(reading[field]-r[field])>TARGET_TOLERANCE)
   fail('Reading '+(reading.sampleIndex+1)+' actual '+field+' is outside the declared target tolerance of '+TARGET_TOLERANCE+'.');
 }
 // Retain the unchanged pair-matching, chronology and numerical gates. The
 // completed worksheet is the full protocol record; the compatible notebook
 // identifies that record without claiming instrument-authenticated custody.
 return importNotebook(exportNotebook({schema:NOTEBOOK_SCHEMA,source:'measured',
  sourceNote:'User-declared measurements; worksheet '+r.id+'. '+r.sourceNote,
  noiseSigma:r.noiseSigma,trials:course.readings}));
}
