import {readInertiaRecord} from './inertia-record.mjs';
import {requireThat} from './science.mjs';

export const INERTIA_INVESTIGATION_SCHEMA='worldlaw.coupled-inertia-investigation/v1';
function keys(value,expected,label){
  requireThat(value&&typeof value==='object'&&!Array.isArray(value),label+' must be an object.');
  requireThat(Object.keys(value).sort().join('|')===expected.slice().sort().join('|'),label+' contains missing or unsupported fields.');
  for(const key of expected)requireThat(Object.hasOwn(Object.getOwnPropertyDescriptor(value,key)??{},'value'),label+' cannot contain accessors.');
}
export function readInertiaSettings(value){
  keys(value,['windowSamples','stride'],'Weak-window settings');
  const {windowSamples,stride}=value;
  requireThat(Number.isInteger(windowSamples)&&windowSamples>=5&&windowSamples<=401,'Use 5–401 source rows per weak window.');
  requireThat(Number.isInteger(stride)&&stride>=1&&stride<windowSamples,'Window stride must be a positive integer smaller than its width.');
  return {windowSamples,stride};
}
export function readInertiaInvestigation(value){
  if(typeof value==='string'){
    requireThat(value.length<=3*1024*1024,'Inertia investigation exceeds 3 MB.');
    try{value=JSON.parse(value);}catch{throw new Error('Inertia investigation is not valid JSON.');}
  }
  requireThat(value&&typeof value==='object'&&!Array.isArray(value),'Inertia investigation must be an object.');
  const descriptor=Object.getOwnPropertyDescriptor(value,'schema');
  requireThat(descriptor&&Object.hasOwn(descriptor,'value'),'Inertia schema must be an ordinary own field.');
  if(descriptor.value==='worldlaw.coupled-inertia-observations/v1'){
    const record=readInertiaRecord(value),windowSamples=Math.min(81,...record.courses.map(c=>c.rows.length));
    return {record,settings:{windowSamples,stride:Math.max(1,Math.floor(windowSamples/2))}};
  }
  keys(value,['schema','record','settings'],'Inertia investigation');
  requireThat(value.schema===INERTIA_INVESTIGATION_SCHEMA,'Unsupported inertia investigation schema.');
  return {record:readInertiaRecord(value.record),settings:readInertiaSettings(value.settings)};
}
export function exportInertiaInvestigation(record,settings){
  return JSON.stringify({schema:INERTIA_INVESTIGATION_SCHEMA,record:readInertiaRecord(record),settings:readInertiaSettings(settings)},null,2)+'\n';
}
