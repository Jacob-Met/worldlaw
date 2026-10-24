// Conditional all-pair bounded model check; no physical identification or calibrated coverage.
import {inspectPeriodicContrast} from './periodic-contrast.mjs';
import {fitLinearColumns,linearColumnRank} from '../science/linear-fit.mjs';
const require=(ok,message)=>{if(!ok)throw Error(message);};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const PERIODIC_COURSE_SCHEMA='worldlaw.periodic-course/v1';
function prepare(raw,fixedHistory=null){
 require(raw?.schema===PERIODIC_COURSE_SCHEMA,'Expected periodic-course inputs v1.');
 require(raw.boundUnits?.history==='N*m'&&raw.boundUnits?.drift==='N*m/acquisition_step'&&raw.boundUnits?.pair==='N*m','Declare N*m history/pair bounds and N*m/acquisition_step drift bounds.');
 const aggregate=inspectPeriodicContrast(raw.evidence);
 if(fixedHistory!==null)require(Number.isFinite(fixedHistory)&&Math.abs(fixedHistory)<=raw.historyBound,'Fixed history must lie inside the original prior bound.');
 for(const k of ['historyBound','driftBound','pairRadius'])require(typeof raw[k]==='number'&&Number.isFinite(raw[k])&&raw[k]>=0&&raw[k]<=1000,`${k} requires an explicit bound from 0 to 1000.`);
 require(typeof raw.discrepancyBasis==='string'&&raw.discrepancyBasis.trim()&&raw.discrepancyBasis.length<=2000,'Declare the pair-discrepancy basis.');
 const search=raw.search??{maxIterations:1024,maxProducts:16777216};
 require(search&&typeof search==='object'&&!Array.isArray(search)&&Object.keys(search).every(k=>['maxIterations','maxProducts'].includes(k))&&Object.hasOwn(search,'maxIterations')&&Object.hasOwn(search,'maxProducts')&&Number.isSafeInteger(search.maxIterations)&&search.maxIterations>=0&&search.maxIterations<=4096&&Number.isSafeInteger(search.maxProducts)&&search.maxProducts>=0&&search.maxProducts<=67108864,'Declare bounded search iteration/product budgets.');
 const inputs={search:{...search},schema:PERIODIC_COURSE_SCHEMA,boundUnits:{history:'N*m',drift:'N*m/acquisition_step',pair:'N*m'},evidence:aggregate.inputs,historyBound:raw.historyBound,driftBound:raw.driftBound,pairRadius:raw.pairRadius,discrepancyBasis:raw.discrepancyBasis};
 const origin=aggregate.origin,components=aggregate.inputs.components;
 const phase=(index,period)=>2*Math.PI*((index-origin)%period)/period;
 const rows=aggregate.original.pairs.map(p=>({id:p.id,reference:p.reference,conditioned:p.conditioned,y:p.difference,
  x:[1,p.conditioned.sampleIndex-p.reference.sampleIndex,...components.flatMap(c=>[Math.cos(phase(p.conditioned.sampleIndex,c.period))-Math.cos(phase(p.reference.sampleIndex,c.period)),Math.sin(phase(p.conditioned.sampleIndex,c.period))-Math.sin(phase(p.reference.sampleIndex,c.period))])]}));
 const columns=rows[0].x.map((_,i)=>rows.map(r=>r.x[i]));
 const active=columns.map((_,i)=>i).filter(i=>i===0?raw.historyBound>0&&fixedHistory===null:i===1?raw.driftBound>0:components[Math.floor((i-2)/2)].amplitudeBound>0);
 return {inputs,aggregate,origin,components,rows,columns,active,phase,fixedHistory,sourceKey:fixedHistory===null?JSON.stringify(inputs):JSON.stringify({schema:'worldlaw.fixed-periodic-history-context/v1',inputs,fixedHistory})};
}
function tolerance(c,magnitude){return 1024*Number.EPSILON*Math.max(1,magnitude,c.rows.reduce((s,r)=>s+Math.abs(r.y),0));}
function checkPrepared(c,certificate){
 const raw=c.inputs;
 require(certificate?.schema==='worldlaw.periodic-course-certificate/v1'&&certificate.sourceKey===c.sourceKey,'Source or declarations changed.');
 const values=certificate.values;
 require(Array.isArray(values)&&values.length<=128&&Array.from({length:values.length},(_,i)=>Object.hasOwn(values,i)).every(Boolean)&&values.every(Number.isFinite),'Certificate must retain finite dense values.');
 if(certificate.kind==='parameters'){
  require(values.length===c.columns.length,'Require every declared coefficient.');
  require(c.fixedHistory===null||values[0]===c.fixedHistory,'Witness changes its fixed history.');
  require(Math.abs(values[0])<=raw.historyBound&&Math.abs(values[1])<=raw.driftBound,'Witness exceeds history/drift bound.');
  c.components.forEach((component,k)=>require(Math.hypot(values[2+2*k],values[3+2*k])<=component.amplitudeBound,'Witness exceeds a phasor disk.'));
  const rows=c.rows.map(row=>{
   const offset=index=>c.components.reduce((s,component,k)=>s+values[2+2*k]*Math.cos(c.phase(index,component.period))+values[3+2*k]*Math.sin(c.phase(index,component.period)),0);
   const prediction=values[0]+values[1]*(row.conditioned.sampleIndex-row.reference.sampleIndex)+offset(row.conditioned.sampleIndex)-offset(row.reference.sampleIndex);
   const residual=row.y-prediction,margin=raw.pairRadius-Math.abs(residual),numericalTolerance=tolerance(c,Math.abs(prediction)+Math.abs(row.reference.jointTorque)+Math.abs(row.conditioned.jointTorque)+raw.historyBound+raw.driftBound+4*c.components.reduce((s,k)=>s+k.amplitudeBound,0));
   return {id:row.id,prediction,observed:row.y,residual,margin,numericalTolerance,interior:margin>numericalTolerance};
  });
  return {status:rows.every(r=>r.interior)?'verified-course-witness':'unresolved',rows};
 }
 require(certificate.kind==='separator'&&values.length===c.rows.length&&values.every(v=>Math.abs(v)<=1)&&values.some(v=>v!==0),'Require one nonzero bounded separator weight per pair.');
 // Reconstruct support from original reading endpoints, not the search matrix.
 let discrepancy=0,history=0,drift=0,errorSupport=0;
 const phasors=c.components.map(()=>({cosine:0,sine:0}));
 c.rows.forEach((row,j)=>{
  const v=values[j];history+=v;drift+=v*(row.conditioned.sampleIndex-row.reference.sampleIndex);errorSupport+=raw.pairRadius*Math.abs(v);
  for(const [reading,sign] of [[row.conditioned,1],[row.reference,-1]]){
   const w=v*sign;discrepancy+=w*reading.jointTorque;
   c.components.forEach((component,k)=>{const phase=c.phase(reading.sampleIndex,component.period);phasors[k].cosine+=w*Math.cos(phase);phasors[k].sine+=w*Math.sin(phase);});
  }
 });
 const historySupport=c.fixedHistory===null?raw.historyBound*Math.abs(history):c.fixedHistory*history,driftSupport=raw.driftBound*Math.abs(drift);
 const artifactSupport=phasors.reduce((s,p,k)=>s+c.components[k].amplitudeBound*Math.hypot(p.cosine,p.sine),0);
 const support=historySupport+driftSupport+artifactSupport+errorSupport;
 // Include raw readings in the scale: pair subtraction can cancel large baselines.
 const magnitude=c.rows.reduce((s,row,j)=>s+Math.abs(values[j])*(Math.abs(row.reference.jointTorque)+Math.abs(row.conditioned.jointTorque)),0);
 const absoluteWeight=values.reduce((s,v)=>s+Math.abs(v),0);
 const uncancelledBound=absoluteWeight*(raw.historyBound+raw.driftBound+4*c.components.reduce((s,k)=>s+k.amplitudeBound,0));
 const numericalTolerance=tolerance(c,magnitude+support+uncancelledBound),gap=discrepancy-support;
 return {status:gap>numericalTolerance?'verified-course-separation':'unresolved',discrepancy,support,historySupport,driftSupport,artifactSupport,errorSupport,gap,numericalTolerance,uncancelledBound,phasors};
}
function checkContext(raw,certificate,fixedHistory=null){return checkPrepared(prepare(raw,fixedHistory),certificate);}
function searchContext(raw,options,fixedHistory=null){
 if(options!==undefined)raw={...raw,search:{maxIterations:1024,maxProducts:16777216,...options}};
 const c=prepare(raw,fixedHistory);raw=c.inputs;const {maxIterations,maxProducts}=raw.search;const rank=linearColumnRank(c.active.map(i=>c.columns[i]));
 const fit=fitLinearColumns(c.active.map(i=>c.columns[i]),c.rows.map(r=>r.y-(fixedHistory??0)));
 const project=p=>{
  p[0]=fixedHistory??Math.max(-raw.historyBound,Math.min(raw.historyBound,p[0]));p[1]=Math.max(-raw.driftBound,Math.min(raw.driftBound,p[1]));
  c.components.forEach((component,k)=>{const a=2+2*k,b=a+1,norm=Math.hypot(p[a],p[b]);if(norm>component.amplitudeBound){const scale=component.amplitudeBound/norm*(1-4*Number.EPSILON);p[a]*=scale;p[b]*=scale;}});return p;
 };
 let p=Array(c.columns.length).fill(0);if(fit)c.active.forEach((i,j)=>p[i]=fit.coefficients[j]);p=project(p);
 const scale=c.rows.reduce((s,r)=>s+dot(r.x,r.x),0),perIteration=4*c.rows.length*c.columns.length;
 let products=0,iterations=0;
 const base={...(fixedHistory===null?{}:{fixedHistory}),inputs:c.inputs,aggregate:c.aggregate,rank,activeColumns:c.active.length,qualification:'One shared constant preparation offset, linear acquisition-index drift and common fixed-period sensor process, under explicit coefficient and pair-discrepancy bounds. A witness is conditional compatibility, never identified phase/amplitude/history. A numerical separator rejects only this declared family. Exhaustion remains unresolved; no calibrated probability or certified floating-point interval arithmetic.'};
 const finish=(kind,values)=>{const certificate={schema:'worldlaw.periodic-course-certificate/v1',sourceKey:c.sourceKey,kind,values:[...values]},check=checkPrepared(c,certificate);return {certificate,check};};
 const admit=result=>{const independent=checkContext(raw,result.certificate,fixedHistory);require(independent.status===result.check.status,'Independent raw-source certificate check disagrees.');return {...base,...result,check:independent,status:independent.status,iterations,products};};
 for(let iteration=0;iteration<maxIterations;iteration++){
  if(products+perIteration>maxProducts)return {...base,status:'unresolved',reason:'product-budget',iterations,products};
  products+=perIteration;iterations++;
  const residual=c.rows.map(r=>r.y-dot(r.x,p));
  if(residual.every(r=>Math.abs(r)<raw.pairRadius)){
   const result=finish('parameters',p);if(result.check.status==='verified-course-witness')return admit(result);
  }
  const v=residual.map(r=>Math.sign(r)*Math.max(0,Math.abs(r)-raw.pairRadius/2)),norm=Math.max(...v.map(Math.abs));
  if(norm>0){const result=finish('separator',v.map(r=>r/norm));if(result.check.status==='verified-course-separation')return admit(result);}
  if(!scale)return {...base,status:'unresolved',reason:'zero-scale',iterations,products};
  p=project(p.map((value,i)=>value+dot(c.columns[i],v)/scale));
 }
 return {...base,status:'unresolved',reason:'iteration-budget',iterations,products};
}

// Ordinary v1 calls and certificate keys remain unchanged. Fixed-history checks
// bind the additional model context without altering any supplied observations.
export function normalizePeriodicCourse(raw){return prepare(raw).inputs;}
export function checkPeriodicCourse(raw,certificate){return checkContext(raw,certificate);}
export function searchPeriodicCourse(raw,options){return searchContext(raw,options);}
export function checkFixedPeriodicHistory(raw,fixedHistory,certificate){require(Number.isFinite(fixedHistory),'Declare a finite fixed preparation offset.');return checkContext(raw,certificate,fixedHistory);}
export function searchFixedPeriodicHistory(raw,fixedHistory,options){require(Number.isFinite(fixedHistory),'Declare a finite fixed preparation offset.');return searchContext(raw,options,fixedHistory);}

export function comparePeriodicCourses(raw,options){
 if(options!==undefined)raw={...raw,search:{maxIterations:1024,maxProducts:16777216,...options}};
 const admitted=prepare(raw);
 const zero=searchPeriodicCourse({...admitted.inputs,historyBound:0});
 const constant=searchPeriodicCourse(admitted.inputs);
 return {inputs:admitted.inputs,aggregate:admitted.aggregate,zero,constant,
 interpretation:'The two families share exactly the same original pairs, periodic bounds, drift bound and pair-discrepancy bound. Neither is refitted by separate evidence; these are simultaneous feasibility checks of the supplied course, not held-out predictions. Zero-history compatibility does not establish memorylessness; requiring the offered constant term does not identify a physical preparation cause.'};
}
