/** Exact point-box compatibility with a declared coordinate-sensitivity envelope. */
import {normalizeCirculation,evaluateCirculation} from './circulation.mjs';
import {pair,requireThat} from './science.mjs';
import {exportExactDyadic as exact} from '../cycle-work/angle-boxes.mjs';
import {addExactWork as add} from './circulation-angle-boxes.mjs';
import {multiplyExactWork as mul,compareExactWork as compare} from './circulation-calibration.mjs';
export const POINT_RESPONSE_SCHEMA='worldlaw.coupling-point-response/v1';
const neg=x=>({...x,integer:(-BigInt(x.integer)).toString()}),sub=(a,b)=>add(a,neg(b)),abs=x=>BigInt(x.integer)<0n?neg(x):x;
const zero=()=>exact(0),sum=values=>values.reduce(add,zero());
export function normalizePointResponse(raw){
 requireThat(raw?.schema===POINT_RESPONSE_SCHEMA,'Expected '+POINT_RESPONSE_SCHEMA+'.');
 requireThat(raw.sensitivityUnits==='N·m/rad','Declare coordinate sensitivity in N·m/rad.');
 requireThat(typeof raw.sensitivityBasis==='string'&&raw.sensitivityBasis.trim().length>0&&raw.sensitivityBasis.length<=2000,'Supply an explicit sensitivity basis of1–2000 characters; it is not inferred from these readings.');
 requireThat(Array.isArray(raw.sensitivity)&&raw.sensitivity.length===2,'Supply two output rows of coordinate-sensitivity limits.');
 const sensitivity=raw.sensitivity.map((row,a)=>{const values=pair(row,`sensitivity[${a}]`,1e6);requireThat(values.every(v=>v>=0),'Sensitivity limits must be nonnegative.');return values;});
 const path=normalizeCirculation(raw.path);requireThat(path.samples.length<=128,'Point compatibility admits at most128 complete original readings; none are trimmed.');
 return {schema:POINT_RESPONSE_SCHEMA,path,sensitivity,sensitivityUnits:'N·m/rad',sensitivityBasis:raw.sensitivityBasis.trim()};
}
function prepare(input){
 return {q:input.path.samples.map(r=>r.q.map(exact)),bounds:input.path.samples.map(r=>r.torque.map((v,a)=>[sub(exact(v),exact(r.torqueRadius[a])),add(exact(v),exact(r.torqueRadius[a]))])),limits:input.sensitivity.map(row=>row.map(exact))};
}
const distance=(a,b,limits)=>sum(a.map((v,k)=>mul(limits[k],abs(sub(v,b[k])))));
function envelope(data,q){return [0,1].map(a=>{let best=null;for(let i=0;i<data.q.length;i++){const value=sub(data.bounds[i][a][0],distance(q,data.q[i],data.limits[a]));if(best===null||compare(value,best.value)>0)best={value,supportingRow:i};}return best;});}
export function inspectPointResponse(raw){
 const input=normalizePointResponse(raw),data=prepare(input),n=data.q.length,axes=[];let repeatedStateConflict=null;
 for(let a=0;a<2;a++){
  let worst=null;const values=[];
  for(let j=0;j<n;j++){
   let maximum=null;
   for(let i=0;i<n;i++){
    const allowance=distance(data.q[i],data.q[j],data.limits[a]),candidate=sub(data.bounds[i][a][0],allowance),gap=sub(candidate,data.bounds[j][a][1]);
    if(maximum===null||compare(candidate,maximum.value)>0)maximum={value:candidate,supportingRow:i};
    if(compare(gap,zero())>0){const conflict={axis:a,lowerRow:i,upperRow:j,lower:data.bounds[i][a][0],upper:data.bounds[j][a][1],sensitivityAllowance:allowance,gap};if(!worst||compare(gap,worst.gap)>0)worst=conflict;
     if(input.path.samples[i].q.every((v,k)=>v===input.path.samples[j].q[k])&&(!repeatedStateConflict||compare(gap,repeatedStateConflict.gap)>0))repeatedStateConflict=conflict;
    }
   }
   values.push(maximum);
  }
  axes.push({axis:a,conflict:worst,sourceValues:values});
 }
 const compatible=axes.every(a=>!a.conflict);
 return {input,status:compatible?'compatible':'incompatible',axes,repeatedStateConflict,work:evaluateCirculation(input.path),
  witness:compatible?{formula:'f_a(q) = max_i(lower_i,a − Σ_b L_a,b |q_b − q_i,b|)',sourceValues:input.path.samples.map((r,i)=>({row:i,q:r.q,torque:axes.map(a=>a.sourceValues[i].value),supportingRows:axes.map(a=>a.sourceValues[i].supportingRow)}))}:null,
  operations:{rows:n,orderedAxisPairChecks:2*n*n},
  scope:'Only original point-reading boxes, declared exact coordinates, and explicitly supplied coordinate-sensitivity limits. Compatibility constructs a single-valued response through these boxes; it does not fit a physical mechanism, a conservative potential, or the declared between-reading torque interpolation. A repeated-coordinate contradiction excludes any single-valued q-only response under the supplied error bounds. Other contradictions are conditional on the declared sensitivity limits. Omitted rates, history, drift, calibration and wrong bounds remain alternative explanations. Integration allowance affects the separate work result only. No cause, statistical confidence, passivity or global identification is established.'};
}
/** Recompute from source inputs; never trust a saved or mutated derived witness. */
export function pointResponseAt(raw,q){const result=inspectPointResponse(raw);requireThat(result.witness,'No compatible response witness is available.');return {q:pair(q,'query'),torque:envelope(prepare(result.input),q.map(exact)).map(v=>v.value)};}
export const exportPointResponse=raw=>JSON.stringify(normalizePointResponse(raw),null,2);
export function importPointResponse(text){requireThat(typeof text==='string'&&new TextEncoder().encode(text).length<=4*1024*1024,'Point-response input must be at most4MiB.');return normalizePointResponse(JSON.parse(text));}
