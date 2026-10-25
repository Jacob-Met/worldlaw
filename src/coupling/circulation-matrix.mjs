/** Independent matrix-entry boxes; one shared error per original torque reading. */
import {normalizeCalibration,CALIBRATION_SCHEMA,multiplyExactWork,compareExactWork} from './circulation-calibration.mjs';
import {addExactWork} from './circulation-angle-boxes.mjs';
import {exportExactDyadic} from '../cycle-work/angle-boxes.mjs';
import {requireThat} from './science.mjs';
export const MATRIX_SCHEMA='worldlaw.coupling-matrix-calibration/v1';
const zero=()=>({integer:'0',powerOfTwo:0});
const neg=x=>({...x,integer:(-BigInt(x.integer)).toString()});
const sub=(a,b)=>addExactWork(a,neg(b));
const abs=x=>({...x,integer:(BigInt(x.integer)<0n?-BigInt(x.integer):BigInt(x.integer)).toString()});
const sum=xs=>xs.reduce(addExactWork,zero());
const mul=multiplyExactWork;
export function normalizeMatrixCalibration(raw){
 requireThat(raw?.schema===MATRIX_SCHEMA,'Expected '+MATRIX_SCHEMA+'.');
 requireThat(raw.matrixAssumption==='independent-entry-boxes-in-fixed-physical-torque-axes','Declare independent matrix-entry boxes in fixed physical torque axes.');
 const base=normalizeCalibration({...raw,schema:CALIBRATION_SCHEMA,gain:[1,1]});
 requireThat(Array.isArray(raw.matrix)&&raw.matrix.length===2,'Supply a2×2 matrix of entry bounds.');
 const matrix=raw.matrix.map(row=>{requireThat(Array.isArray(row)&&row.length===2,'Each matrix row needs two entry bounds.');return row.map(b=>{requireThat(Array.isArray(b)&&b.length===2&&b.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1000)&&b[0]<=b[1],'Matrix entries require ordered finite bounds within±1000.');return [...b];});});
 const {gain,schema,...rest}=base;
 return {schema:MATRIX_SCHEMA,...rest,matrixAssumption:raw.matrixAssumption,matrix};
}
function vertices(input){return Array.from({length:16},(_,mask)=>{const matrix=input.matrix.map((row,a)=>row.map((b,k)=>b[(mask>>(a*2+k))&1]));const exact=matrix.map(row=>row.map(exportExactDyadic));return {mask,matrix,exact,determinant:sub(mul(exact[0][0],exact[1][1]),mul(exact[0][1],exact[1][0]))};});}
function prepare(input){
 const q=input.path.samples.map(s=>s.q.map(exportExactDyadic));
 const weights=q.map((row,i)=>[0,1].map(a=>{const d=sub(q[i+1]?.[a]??row[a],q[i-1]?.[a]??row[a]);return {...d,powerOfTwo:d.powerOfTwo-1};}));
 const readings=input.path.samples.map(s=>({torque:s.torque.map(exportExactDyadic),radius:s.torqueRadius.map(exportExactDyadic)}));
 return {weights,readings};
}
function atVertex(data,vertex){
 const coefficients=data.weights.map(w=>[0,1].map(a=>sum([0,1].map(b=>mul(vertex.exact[a][b],w[b])))));
 const nominal=sum(coefficients.flatMap((row,i)=>row.map((c,a)=>mul(c,data.readings[i].torque[a]))));
 const radius=sum(coefficients.flatMap((row,i)=>row.map((c,a)=>mul(abs(c),data.readings[i].radius[a]))));
 const endpoint=direction=>coefficients.map(row=>row.map(c=>(BigInt(c.integer)>=0n?direction:-direction)>0?'upper':'lower'));
 return {coefficients,minimum:{work:sub(nominal,radius),matrix:vertex.matrix,matrixMask:vertex.mask,torqueEndpoints:endpoint(-1)},maximum:{work:addExactWork(nominal,radius),matrix:vertex.matrix,matrixMask:vertex.mask,torqueEndpoints:endpoint(1)}};
}
export function analyzeMatrixCalibration(raw){
 const input=normalizeMatrixCalibration(raw),corners=vertices(input);
 let determinantMinimum=corners[0];for(const c of corners)if(compareExactWork(c.determinant,determinantMinimum.determinant)<0)determinantMinimum=c;
 requireThat(BigInt(determinantMinimum.determinant.integer)>0n,'The entire matrix box must have strictly positive determinant. Singular or orientation-reversing possibilities are not admitted; narrow or revise the declared calibration box.');
 const data=prepare(input);let minimum=null,maximum=null;
 for(const c of corners){const r=atVertex(data,c);if(!minimum||compareExactWork(r.minimum.work,minimum.work)<0)minimum=r.minimum;if(!maximum||compareExactWork(r.maximum.work,maximum.work)>0)maximum=r.maximum;}
 const allowance=exportExactDyadic(input.path.integrationAllowance),interval=[sub(minimum.work,allowance),addExactWork(maximum.work,allowance)];
 return {input,minimum,maximum,interval,allowance,determinantMinimum:{value:determinantMinimum.determinant,matrix:determinantMinimum.matrix},
  conclusion:BigInt(interval[0].integer)>0n?'positive-work':BigInt(interval[1].integer)<0n?'negative-work':'zero-compatible',
  operations:{matrixVertices:16,rows:input.path.samples.length,originalTorqueReadings:2*input.path.samples.length},
  scope:'Exact polygon extrema over independent matrix-entry bounds and independent original torque-reading boxes. Matrix contributions are combined before bounding each shared reading. Strict positive determinant at every matrix vertex certifies orientation preservation throughout the box because determinant is multi-affine. Constant offsets cancel. Integration allowance is added once after calibration. This is an explicitly supplied fixed-physical-torque-axis calibration hypothesis, not inferred sensor mixing, a conjugate-force coordinate transformation, physical-law refitting, passivity or continuous-path work.'};
}
export function matrixWitnessRow(result,which,index){
 requireThat(which==='minimum'||which==='maximum','Choose a retained matrix extremum.');
 requireThat(Number.isInteger(index)&&index>=0&&index<result.input.path.samples.length,'Choose an original acquisition row.');
 const w=result[which],row=result.input.path.samples[index];
 const torque=row.torque.map((t,a)=>addExactWork(exportExactDyadic(t),(w.torqueEndpoints[index][a]==='upper'?x=>x:neg)(exportExactDyadic(row.torqueRadius[a]))));
 const q=row.q.map(exportExactDyadic),matrix=w.matrix.map(r=>r.map(exportExactDyadic));
 return {row:index+1,original:row,matrix:w.matrix,torqueEndpoints:w.torqueEndpoints[index],torque,calibratedPositionWithoutConstantOffset:matrix.map(r=>sum(r.map((v,a)=>mul(v,q[a])))),offsetBounds:result.input.offsetBounds,work:w.work};
}
export const exportMatrixCalibration=raw=>JSON.stringify(normalizeMatrixCalibration(raw),null,2);
export function importMatrixCalibration(text){requireThat(typeof text==='string'&&new TextEncoder().encode(text).length<=4*1024*1024,'Matrix input must be at most4MiB.');return normalizeMatrixCalibration(JSON.parse(text));}
