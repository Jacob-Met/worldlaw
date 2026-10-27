import {FIELDS,UNITS,NOISE_RATIO_FIELD,csvRecords,validateRows,MAX_ROWS} from './data.mjs';
export const MEASUREMENT_BATCH_BYTES=2_000_000;
const decimal=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;
export function measurementSource(source){
 if(!source||typeof source!=='object'||Array.isArray(source)||Object.keys(source).some(k=>!['label','units'].includes(k))||typeof source.label!=='string'||!source.label.trim()||source.label.length>240||!source.units||FIELDS.some(k=>source.units[k]!==UNITS[k])||Object.keys(source.units).some(k=>![...FIELDS,NOISE_RATIO_FIELD].includes(k))||(source.units.torqueNoiseRatio!==undefined&&source.units.torqueNoiseRatio!=='1'))throw Error('Declare the acquisition source and standard torque/radian/rate units.');
 return {label:source.label,units:{...source.units}};
}
export function parseMeasurementBatch(text,filename='acquired-readings.csv'){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>MEASUREMENT_BATCH_BYTES)throw Error('Acquired-reading files must be UTF-8 text no larger than2MB.');
 text=text.replace(/^\uFEFF/,'').trim();if(!text)throw Error('The acquired-reading file is empty.');
 let rows,source;
 if(/^[\[{]/.test(text)){
  const input=JSON.parse(text);if(!input||input.schema!=='worldlaw.measurement-batch/v1'||Object.keys(input).some(k=>!['schema','source','rows'].includes(k)))throw Error('Use worldlaw.measurement-batch/v1 with source and rows; observation notebooks and held-out rows are not acquisition batches.');
  source=measurementSource(input.source);rows=input.rows;
 }else{
  const records=csvRecords(text),headers=records.shift()?.map(x=>x.trim());
  if(!headers||new Set(headers).size!==headers.length||FIELDS.some(k=>!headers.includes(k))||headers.some(k=>![...FIELDS,NOISE_RATIO_FIELD].includes(k)))throw Error('Acquired CSV requires exactly command,position,rate,jointTorque and optional torqueNoiseRatio.');
  if(records.length>MAX_ROWS)throw Error('Acquisition exceeds4096rows.');
  rows=records.map((record,i)=>{if(record.length!==headers.length)throw Error(`Acquired CSV row ${i+2} has wrong field count.`);return Object.fromEntries(headers.map((key,j)=>{const value=record[j].trim();if(!decimal.test(value))throw Error(`Acquired CSV row ${i+2}: ${key} is not a decimal.`);return [key,Number(value)];}));});
  source=measurementSource({label:String(filename).slice(0,240),units:{...UNITS,...(headers.includes(NOISE_RATIO_FIELD)?{torqueNoiseRatio:'1'}:{})}});
 }
 if(!Array.isArray(rows)||!rows.length||rows.some(r=>!r||Object.keys(r).some(k=>![...FIELDS,NOISE_RATIO_FIELD].includes(k))))throw Error('Provide a nonempty complete actual-reading batch without derived fields.');
 rows=validateRows(rows,{allowEmpty:true});if((rows[0].torqueNoiseRatio!==undefined)!==(source.units.torqueNoiseRatio==='1'))throw Error('Source units must match acquisition torque-noise-ratio declarations.');
 return {source,rows};
}
