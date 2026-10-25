/** Systematic encoder calibration hypotheses over original polygon readings. */
import {normalizeCirculation} from './circulation.mjs';
import {requireThat} from './science.mjs';
import {analyzeCirculationBoxes,addExactWork,CIRCULATION_BOX_SCHEMA,CIRCULATION_BOX_ASSUMPTION} from './circulation-angle-boxes.mjs';
import {exportExactDyadic} from '../cycle-work/angle-boxes.mjs';
export const CALIBRATION_SCHEMA='worldlaw.coupling-encoder-calibration/v1';
const negate=x=>({...x,integer:(-BigInt(x.integer)).toString()});
const multiply=(a,b)=>({integer:(BigInt(a.integer)*BigInt(b.integer)).toString(),powerOfTwo:a.powerOfTwo+b.powerOfTwo});
const compare=(a,b)=>{const e=Math.min(a.powerOfTwo,b.powerOfTwo),x=BigInt(a.integer)<<BigInt(a.powerOfTwo-e),y=BigInt(b.integer)<<BigInt(b.powerOfTwo-e);return x<y?-1:x>y?1:0;};
function product(work,gain){
 const corners=work.flatMap((w,wi)=>gain.map((g,gi)=>({work:multiply(w,g),workEndpoint:wi,gainEndpoint:gi})));
 corners.sort((a,b)=>compare(a.work,b.work));return [corners[0],corners.at(-1)];
}
export function normalizeCalibration(raw){
 requireThat(raw?.schema===CALIBRATION_SCHEMA,'Expected '+CALIBRATION_SCHEMA+'.');
 requireThat(raw.offsetAssumption==='constant-per-coordinate','Declare offsets constant per coordinate throughout this course.');
 requireThat(raw.torqueAssumption==='independent-reading-boxes-in-physical-convention','Declare torque reading boxes independent of angle calibration in the supplied physical convention.');
 requireThat(typeof raw.calibrationSource==='string'&&raw.calibrationSource.trim().length>0&&raw.calibrationSource.length<=2000,'Declare a calibration source/basis (1–2000 characters).');
 const path=normalizeCirculation(raw.path);
 requireThat(Array.isArray(raw.gain)&&raw.gain.length===2&&raw.gain.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<=1000)&&raw.gain[0]<=raw.gain[1],'Supply a positive ordered gain interval, at most1000.');
 requireThat(Array.isArray(raw.offsetBounds)&&raw.offsetBounds.length===2,'Supply constant offset bounds on each coordinate.');
 const offsetBounds=raw.offsetBounds.map(b=>{requireThat(Array.isArray(b)&&b.length===2&&b.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=1e6)&&b[0]<=b[1],'Offsets require ordered finite radian bounds within±1e6.');return [...b];});
 return {schema:CALIBRATION_SCHEMA,offsetAssumption:raw.offsetAssumption,torqueAssumption:raw.torqueAssumption,calibrationSource:raw.calibrationSource.trim(),path,gain:[...raw.gain],offsetBounds};
}
export function analyzeCalibration(raw){
 const input=normalizeCalibration(raw),base=analyzeCirculationBoxes({schema:CIRCULATION_BOX_SCHEMA,assumption:CIRCULATION_BOX_ASSUMPTION,radiusSource:'Nominal angles for systematic calibration; no independent coordinate errors',path:{...input.path,integrationAllowance:0},positionRadii:input.path.samples.map(()=>[0,0])});
 const gain=input.gain.map(exportExactDyadic),allowance=exportExactDyadic(input.path.integrationAllowance);
 const bounds=base.axes.map(a=>[a.minimum.work,a.maximum.work]);
 const total=[0,1].map(i=>addExactWork(bounds[0][i],bounds[1][i]));
 const common=product(total,gain),separate=bounds.map(b=>product(b,gain));
 const build=(mode,extrema)=>{
  const interval=[addExactWork(extrema[0].work,negate(allowance)),addExactWork(extrema[1].work,allowance)];
  return {mode,extrema,interval,conclusion:BigInt(interval[0].integer)>0n?'positive-work':BigInt(interval[1].integer)<0n?'negative-work':'zero-compatible'};
 };
 const shared=build('shared-gain',common.map(c=>({work:c.work,gainEndpoints:[c.gainEndpoint,c.gainEndpoint],axisWorkEndpoints:[c.workEndpoint,c.workEndpoint],axisCorners:base.axes.map(a=>a[c.workEndpoint?'maximum':'minimum'].corners)})));
 const independent=build('independent-gains',[0,1].map(i=>({work:addExactWork(separate[0][i].work,separate[1][i].work),gainEndpoints:separate.map(a=>a[i].gainEndpoint),axisWorkEndpoints:separate.map(a=>a[i].workEndpoint),axisCorners:base.axes.map((a,k)=>a[separate[k][i].workEndpoint?'maximum':'minimum'].corners)})));
 return {input,base,shared,independent,allowance,
  scope:'Two explicitly offered calibration-dependence hypotheses with the same marginal positive gain bounds. Constant coordinate offsets cancel segment differences exactly. Torque errors remain independent in the supplied physical convention; no conjugate-force transformation is inferred. Exact extrema describe calibrated polygon work, with the supplied physical-J integration allowance added afterward once. Witnesses are mathematical endpoint assignments, not acquired calibrated measurements. No calibration, mechanism, passivity, statistical confidence or continuous-path work is established.'};
}
export const exportCalibration=raw=>JSON.stringify(normalizeCalibration(raw),null,2);
export function importCalibration(text){requireThat(typeof text==='string'&&new TextEncoder().encode(text).length<=4*1024*1024,'Calibration input must be at most4MiB.');return normalizeCalibration(JSON.parse(text));}

export {multiply as multiplyExactWork,compare as compareExactWork};
