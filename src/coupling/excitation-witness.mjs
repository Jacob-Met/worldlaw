/** Constructive affine support ambiguity, not a bounded feasible-family search. */
import {readCouplingNotebook} from './notebook.mjs';
import {discoverCoupling,predictCoupling,evaluateCoupling,requireThat} from './science.mjs';
import {exportExactDyadic as exact} from '../cycle-work/angle-boxes.mjs';
import {addExactWork as add} from './circulation-angle-boxes.mjs';
import {multiplyExactWork as mul} from './circulation-calibration.mjs';
export const EXCITATION_SCHEMA='worldlaw.coupling-excitation-witness/v1';
const neg=x=>({...x,integer:(-BigInt(x.integer)).toString()}),sub=(a,b)=>add(a,neg(b));
const sum=xs=>xs.reduce(add,exact(0)),zero=x=>BigInt(x.integer)===0n;
const dot=(a,b)=>sum(a.map((v,i)=>mul(v,b[i])));
function response(model,q){const point=q.map(exact);return model.matrix.map((row,i)=>add(dot(row.map(exact),point),exact(model.bias[i])));}
function difference(model,base,q){return response(model,q).map((v,i)=>sub(v,response(base,q)[i]));}
export function normalizeExcitation(raw){
 requireThat(raw?.schema===EXCITATION_SCHEMA,'Expected '+EXCITATION_SCHEMA+'.');
 requireThat(raw.amplitudeUnits==='N·m/rad','Declare amplitude in N·m/rad.');
 requireThat(typeof raw.amplitude==='number'&&Number.isFinite(raw.amplitude)&&Math.abs(raw.amplitude)>0&&Math.abs(raw.amplitude)<=1000,'Choose a finite nonzero illustrative coefficient amplitude within ±1000 N·m/rad.');
 const notebook=readCouplingNotebook(raw.notebook);
 requireThat(notebook.training.length+notebook.revisions.length<=256,'Exact witness inspection admits at most256 complete fitting rows; none are trimmed.');
 return {schema:EXCITATION_SCHEMA,notebook,amplitude:raw.amplitude,amplitudeUnits:'N·m/rad'};
}
export function inspectExcitation(raw){
 const input=normalizeExcitation(raw),rows=[...input.notebook.training,...input.notebook.revisions.map(r=>r.observation)],discovery=discoverCoupling(rows,input.notebook.options),base=discovery.selected;
 const result={input,fittingIds:rows.map(r=>r.id),separateCheckCount:input.notebook.challenges.length,refused:discovery.refused,base,witnesses:[],rejected:[]};
 if(!discovery.refused.some(r=>r.reason==='insufficient_excitation'))return {...result,status:'no-rank-refusal'};
 if(!base)return {...result,status:'no-executable-base'};
 const origin=rows[0].q,other=rows.find(r=>r.q.some((v,i)=>v!==origin[i]));
 if(!other)return {...result,status:'single-coordinate-support'};
 const delta=other.q.map((v,i)=>v-origin[i]),scale=Math.max(...delta.map(Math.abs)),normal=[-delta[1]/scale,delta[0]/scale];
 const offset=dot(normal.map(exact),origin.map(exact));
 // A floating rank refusal is not an exact support certificate.
 if(!rows.every(r=>zero(sub(dot(normal.map(exact),r.q.map(exact)),offset))))return {...result,status:'no-exact-line-certificate'};
 result.support={normal,offset,origin:[...origin],normalization:'max-absolute-component-one',coordinateUnits:'rad'};
 const numericOffset=normal[0]*origin[0]+normal[1]*origin[1];
 const families=[{id:'directional',vector:Math.abs(normal[1])>0?[1,0]:[0,1]}];
 if(base.matrix[0][1]===base.matrix[1][0])families.unshift({id:'reciprocal',vector:normal});
 for(const family of families){
  const model={schema:base.schema,id:family.id,label:`Illustrative ${family.id} support witness`,units:structuredClone(base.units),domain:structuredClone(base.domain),
   matrix:base.matrix.map((row,a)=>row.map((v,b)=>v+input.amplitude*family.vector[a]*normal[b])),bias:base.bias.map((v,a)=>v-input.amplitude*family.vector[a]*numericOffset)};
  try{evaluateCoupling(model,rows);}catch(error){result.rejected.push({family:family.id,reason:'model-admission',detail:error.message});continue;}
  const changed=model.matrix.some((r,a)=>r.some((v,b)=>v!==base.matrix[a][b]))||model.bias.some((v,a)=>v!==base.bias[a]);
  if(!changed){result.rejected.push({family:family.id,reason:'amplitude-rounded-away'});continue;}
  const failed=rows.find(r=>difference(model,base,r.q).some(v=>!zero(v)));
  if(failed){result.rejected.push({family:family.id,reason:'materialized-coefficients-break-exact-equality',rowId:failed.id});continue;}
  const contrasts=input.notebook.permitted.map((q,index)=>{const change=difference(model,base,q);return {index,q:[...q],change,separates:change.some(v=>!zero(v)),basePrediction:predictCoupling(base,q),witnessPrediction:predictCoupling(model,q)};});
  result.witnesses.push({family:family.id,model,exactEqualFittingRows:rows.length,contrasts,interpretation:'Distinct admitted response hypothesis with exactly equal predictions at every fitting coordinate. Rounded display predictions are illustrative; exact contrasts establish separation. No statistical detectability or physical validity is inferred.'});
 }
 return {...result,status:result.witnesses.length?'exact-support-witnesses':'materialization-refused',scope:'Only the supplied finite affine response families and exactly retained fitting coordinates. Separate checks never construct witnesses. The explicit coefficient amplitude is illustrative, not an inferred bound. A separating fresh coordinate removes this exhibited null direction only; it does not establish global identification. Fitter and acquisition planner are unchanged.'};
}
export const exportExcitation=raw=>JSON.stringify(normalizeExcitation(raw),null,2);
export function importExcitation(text){requireThat(typeof text==='string'&&new TextEncoder().encode(text).length<=3*1024*1024,'Witness input must be at most3MiB.');return normalizeExcitation(JSON.parse(text));}
