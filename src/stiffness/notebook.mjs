import {validateDataset, validateRows, MAX_TEXT_LENGTH} from '../data.mjs';
import {investigateStiffness, normalizeSettings, evaluateStiffness} from './science.mjs';
export const NOTEBOOK_SCHEMA='worldlaw.stiffness-notebook/v1';
export function createStiffnessStudy(dataset, settings) {
  const input=validateDataset(dataset);
  const options=normalizeSettings(settings);
  const fit=investigateStiffness(input.observations,options);
  const checks=fit.candidates.map(model=>({family:model.family,knot:model.knot,
    ...evaluateStiffness(model,input.heldOut)}));
  return {schema:NOTEBOOK_SCHEMA,dataset:input,settings:options,fit,checks};
}
export function replaceStiffnessChecks(study, incoming) {
  const checks=validateDataset(incoming);
  const dataset=structuredClone(study.dataset);
  dataset.heldOut=validateRows(checks.observations,{allowEmpty:true});
  dataset.source.metadata={...dataset.source.metadata,
    separateCheckSource:{...checks.source},checkRole:'separately supplied; independence not authenticated'};
  return createStiffnessStudy(dataset,study.settings);
}
export function exportStiffnessStudy(study) {
  const text=JSON.stringify({schema:NOTEBOOK_SCHEMA,dataset:study.dataset,settings:study.settings});
  if(text.length>MAX_TEXT_LENGTH)throw new Error('Notebook exceeds the 2 MB text limit.');
  return text;
}
export function importStiffnessStudy(text) {
  if(typeof text!=='string'||text.length>MAX_TEXT_LENGTH)throw new Error('Notebook must be text below 2 MB.');
  const value=JSON.parse(text);
  if(value?.schema!==NOTEBOOK_SCHEMA || Object.keys(value).some(k=>!['schema','dataset','settings'].includes(k)))
    throw new Error('Expected input-only stiffness notebook; saved results are not accepted.');
  return createStiffnessStudy(value.dataset,value.settings);
}
