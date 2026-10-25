// Prospective fixed-basis output sensitivity. No measured torque
// input enters this calculation; unit targets are algebraic influence vectors.
import {predict, TERMS} from './torque-discovery.mjs';
import {linearReadingInfluences} from './linear-reading-influences.mjs';
const fields=['command','position','rate'];
const checked=(rows,max)=>{if(!Array.isArray(rows)||!rows.length||rows.length>max)throw Error('Invalid complete coordinate course');return rows.map(row=>Object.fromEntries(fields.map(k=>{if(typeof row?.[k]!=='number'||!Number.isFinite(row[k])||Math.abs(row[k])>1e6)throw Error('Invalid coordinate');return[k,row[k]];})));};
export function prospectiveResponse(training,offers,queries,terms,radius){
 const original=checked(training,255),permitted=checked(offers,32),targets=checked(queries,32);
 if(!Array.isArray(terms)||!terms.length||terms.length>TERMS.length||new Set(terms).size!==terms.length||terms.some(id=>!TERMS.some(t=>t.id===id)))throw Error('Invalid offered terms');
 if(!Number.isFinite(radius)||radius<0||radius>1e6)throw Error('Invalid declared radius');
 const n=original.length+1,work=permitted.length*n*n*terms.length**2;
 const base={training:original,permitted,queries:targets,terms:[...terms],radius,work,scope:'Prospective fixed-coordinate, fixed-basis least-squares reading sensitivity, not a feasible-law family or physical uncertainty.'};
 if(work>2e6)return {...base,status:'work-limit',offers:[]};
 const bases=terms.map(id=>({schema:'worldlaw.torque-model/v1',terms:[{id,coefficient:1}]}));
 const features=point=>bases.map(model=>predict(model,point));
 const results=permitted.map((point,index)=>{
  const all=[...original,point],columns=bases.map(model=>all.map(p=>predict(model,p)));
  const coefficients=linearReadingInfluences(columns,n);
  if(!coefficients)return {index,input:point,status:'rank-unavailable',queries:[]};
  const influences=all.map((_,i)=>coefficients.map(column=>column[i]));
  const output=targets.map((q,queryIndex)=>{
   const f=features(q),weights=influences.map(coefficients=>coefficients.reduce((sum,value,j)=>sum+value*f[j],0));
   const halfWidth=radius*weights.reduce((sum,w)=>sum+Math.abs(w),0),witness=weights.map(w=>Math.sign(w)*radius);
   if(![halfWidth,...weights,...witness].every(Number.isFinite))throw Error('Complete course numerical overflow');
   return {queryIndex,input:q,weights,halfWidth,upperWitnessOffsets:witness};
  });return {index,input:point,status:'computed',queries:output,maxHalfWidth:Math.max(...output.map(q=>q.halfWidth))};
 });
 return {...base,status:'computed',offers:results};
}
