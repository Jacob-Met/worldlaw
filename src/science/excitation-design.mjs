/** Input-only exploration of one declared scalar design, using the maintained
 * feature evaluator and normalized QR. Numerical rank is not physical truth. */
import {predict, TERMS} from './torque-discovery.mjs';
import {linearColumnRank, RANK_TOLERANCE} from './linear-fit.mjs';
export const EXCITATION_WORK_LIMIT=2_000_000;
const fields=['command','position','rate'];
function requireThat(value,message){if(!value)throw new Error(message);}
function points(rows,max,label){
 requireThat(Array.isArray(rows)&&rows.length>0&&rows.length<=max,`${label} must contain 1–${max} complete input states.`);
 return rows.map(row=>Object.fromEntries(fields.map(field=>{
  const value=row?.[field];requireThat(typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1e6,`${label}: ${field} must be finite and within ±1000000.`);return [field,value];
 })));
}
export function inspectScalarExcitation(training,permitted,terms){
 const observed=points(training,4096,'Training'),offered=points(permitted,128,'Permitted states');
 requireThat(Array.isArray(terms)&&terms.length>0&&terms.length<=TERMS.length&&new Set(terms).size===terms.length&&terms.every(id=>TERMS.some(term=>term.id===id)),'Declare unique known scalar terms.');
 const base={trainingCount:observed.length,terms:[...terms],permitted:offered,rankTolerance:RANK_TOLERANCE,workLimit:EXCITATION_WORK_LIMIT,
  interpretation:'Numerical design rank for the explicitly offered scalar basis. Torque readings, held-out values and fitted-model ranking are not used. Rank gain does not establish response adequacy, coefficient precision, physical identification or permission to actuate.'};
 const work=(offered.length+1)*(observed.length+1)*terms.length**2;
 if(work>EXCITATION_WORK_LIMIT)return {...base,status:'work-limit',work,results:[],selected:null};
 const models=terms.map(id=>({schema:'worldlaw.torque-model/v1',terms:[{id,coefficient:1}]}));
 const columns=models.map(model=>observed.map(point=>predict(model,point)));
 const rank=linearColumnRank(columns);
 const results=offered.map((point,index)=>{
  const nextRank=linearColumnRank(columns.map((column,j)=>[...column,predict(models[j],point)]));
  return {index,input:point,rank:nextRank,gain:nextRank-rank,unresolved:terms.length-nextRank,
   repeated:observed.some(row=>fields.every(field=>row[field]===point[field]))};
 });
 // No partial scan, response score or hidden tie-breaker. Original order wins ties.
 const useful=results.filter(row=>row.gain>0).sort((a,b)=>b.gain-a.gain||a.index-b.index);
 return {...base,work,rank,unresolved:terms.length-rank,results,selected:useful[0]||null,
  status:rank===terms.length?'full-rank':useful.length?'rank-gain-offered':'no-rank-gain'};
}
