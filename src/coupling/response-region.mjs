/** Joint two-torque sensitivity to one shared bounded training-reading change.
 * This is the image of an error box through fixed-structure least squares, not
 * a feasible physical-law set, confidence region, or joint whole-course fit.
 */
import {STRUCTURES,predictCoupling,requireThat,finite} from './science.mjs';
import {fitLinearColumns} from '../science/linear-fit.mjs';
import {analyzeCouplingNotebook,readCouplingNotebook} from './notebook.mjs';
import {normalizeCirculation} from './circulation.mjs';
export const RESPONSE_REGION_LIMITS=Object.freeze({trainingRows:128,receivingRows:128,workUnitBudget:16000000});
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],sumAbs=a=>a.reduce((s,x)=>s+Math.abs(x),0);
const numericQualification='Floating-point QR and support calculations with an engineering roundoff screen, not certified interval arithmetic or a bound on all QR error.';
function basis(model,term,terms){
 const v=Object.fromEntries(terms.map(t=>[t,t===term?1:0]));
 return {...model,matrix:[[v.k11??0,v.cross??v.k12??0],[v.cross??v.k21??0,v.k22??0]],bias:[v.b1??0,v.b2??0]};
}
function influences(model,training){
 const terms=STRUCTURES.find(s=>s.id===model.id).terms,bases=terms.map(term=>basis(model,term,terms));
 const columns=bases.map(b=>training.flatMap(row=>predictCoupling(b,row.q))),target=training.flatMap(row=>row.torque),fit=fitLinearColumns(columns,target);
 requireThat(fit,'The retained structure has no executable QR sensitivity.');
 const coefficients=terms.map(()=>[]);
 for(let i=0;i<target.length;i++){
  const unit=Array(target.length).fill(0);unit[i]=1;const response=fitLinearColumns(columns,unit);
  requireThat(response,'A training-reading influence could not be computed.');
  response.coefficients.forEach((v,j)=>coefficients[j].push(v));
 }
 return {terms,bases,coefficients,fit,target};
}
/** Ordered vertices for drawing the computed planar zonotope; no membership proof. */
export function responseRegionVertices(center,generators){
 const half=generators.filter(g=>g[0]!==0||g[1]!==0).map(g=>(g[1]<0||g[1]===0&&g[0]<0)?g.map(x=>-x):[...g]);
 half.sort((a,b)=>Math.atan2(a[1],a[0])-Math.atan2(b[1],b[0]));
 let point=center.map((x,a)=>x-half.reduce((s,g)=>s+g[a],0));const vertices=[[...point]];
 for(const sign of [1,-1])for(const g of half){point=point.map((x,a)=>x+sign*2*g[a]);vertices.push([...point]);}
 requireThat(vertices.flat().every(Number.isFinite),'Response-region drawing became nonfinite.');return vertices;
}
function screen(center,generators,observation,readingRadius){
 const all=[...generators,[readingRadius[0],0],[0,readingRadius[1]]],residual=observation.map((x,a)=>x-center[a]);
 const directions=[[1,0],[0,1]];
 for(const g of all){const norm=Math.hypot(...g);requireThat(Number.isFinite(norm),'Response generator became nonfinite.');if(norm)directions.push([-g[1]/norm,g[0]/norm]);}
 let witness=null;
 for(const direction of directions){
  const signed=dot(direction,residual),normal=direction.map(x=>x*(signed<0?-1:1));
  const products=all.map(g=>dot(normal,g)),support=sumAbs(products),gap=Math.abs(signed)-support;
  // Preserve pre-cancellation source/evaluation magnitudes in the screen.
  const scale=Math.max(1,...center.map(Math.abs),...observation.map(Math.abs),all.reduce((s,g)=>s+Math.abs(normal[0]*g[0])+Math.abs(normal[1]*g[1]),0));
  const numericalTolerance=512*Number.EPSILON*scale;
  requireThat([support,gap,numericalTolerance,...products].every(Number.isFinite),'Response support arithmetic became nonfinite.');
  if(!witness||gap-numericalTolerance>witness.gap-witness.numericalTolerance)witness={normal,support,gap,numericalTolerance,trainingSigns:products.slice(0,generators.length).map(x=>Math.sign(x))};
 }
 const marginalRadii=[0,1].map(a=>generators.reduce((s,g)=>s+Math.abs(g[a]),0));
 const marginalGaps=residual.map((x,a)=>Math.abs(x)-marginalRadii[a]-readingRadius[a]);
 return {status:witness.gap>witness.numericalTolerance?'outside':witness.gap>=-witness.numericalTolerance?'numerical-boundary':'not-excluded',witness,marginalRadii,marginalGaps,testedDirections:directions.length};
}
export function inspectCoupledResponseRegions(rawNotebook,rawPath,trainingRadius=.01){
 finite(trainingRadius,'training torque-reading radius');requireThat(trainingRadius>=0,'Training torque-reading radius must be nonnegative.');
 const notebook=readCouplingNotebook(rawNotebook),path=normalizeCirculation(rawPath),rows=path.samples;
 requireThat(path.source.coordinateConvention===notebook.assumptions.coordinateConvention,'Loop and training coordinate conventions must match exactly.');
 const trainingCount=notebook.training.length+notebook.revisions.length;
 requireThat(trainingCount<=RESPONSE_REGION_LIMITS.trainingRows&&rows.length<=RESPONSE_REGION_LIMITS.receivingRows,'The complete sensitivity course exceeds the 128 training / 128 receiving row limit.');
 // Conservative deterministic work units reserve all offered families before QR.
 const n=trainingCount*2,work=STRUCTURES.reduce((sum,s)=>sum+n*n*s.terms.length**2+rows.length*(n+4)*(n+2),0);
 requireThat(work<=RESPONSE_REGION_LIMITS.workUnitBudget,'The complete shared-error response course exceeds its work-unit budget.');
 const analysis=analyzeCouplingNotebook(notebook),training=analysis.discovery.observations,models=analysis.discovery.candidates;
 const candidates=models.map(model=>{
  const base={modelId:model.id,label:model.label};
  try{
   const operator=influences(model,training);
   const results=rows.map((row,index)=>{
    const features=operator.bases.map(b=>predictCoupling(b,row.q));
    const weights=[0,1].map(axis=>operator.target.map((_,i)=>features.reduce((s,f,j)=>s+f[axis]*operator.coefficients[j][i],0)));
    const center=[0,1].map(axis=>features.reduce((s,f,j)=>s+f[axis]*operator.fit.coefficients[j],0));
    const generators=operator.target.map((_,i)=>weights.map(w=>w[i]*trainingRadius));
    requireThat([...center,...weights.flat(),...generators.flat()].every(Number.isFinite),'Response influence arithmetic became nonfinite.');
    const result=screen(center,generators,row.torque,row.torqueRadius);
    const marginalTolerance=512*Number.EPSILON*Math.max(1,...center.map(Math.abs),...row.torque.map(Math.abs),...result.marginalRadii);
    return {index,q:[...row.q],observed:[...row.torque],readingRadius:[...row.torqueRadius],center,generators,...result,
     marginalStatus:result.marginalGaps.map(g=>g>marginalTolerance?'outside':g>=-marginalTolerance?'numerical-boundary':'not-excluded'),
     jointOnlyContradiction:result.status==='outside'&&result.marginalGaps.every(g=>g < -marginalTolerance),
     extrapolatedAxes:row.q.flatMap((q,a)=>q<model.domain[a].min||q>model.domain[a].max?[a]:[])};
   });
   return {...base,status:'computed',rows:results,conditionEstimate:operator.fit.conditionEstimate,outsideCount:results.filter(r=>r.status==='outside').length,jointOnlyCount:results.filter(r=>r.jointOnlyContradiction).length};
  }catch(error){return {...base,status:'unavailable',reason:error.message,rows:[]};}
 });
 return {schema:'worldlaw.coupled-response-region/v1',notebook:analysis.notebook,path,trainingRadius,trainingCount:training.length,trainingIds:training.map(r=>r.id),receivingCount:rows.length,reservedWorkUnits:work,limits:RESPONSE_REGION_LIMITS,candidates,
  interpretation:'Each planar region uses one shared change to the retained training torque readings for its two outputs. Coordinates and model structure are fixed; receiving readings never fit the model. Each receiving row can require a different change, so per-row agreement does not establish one perturbation explaining the whole course. This is least-squares sensitivity, not a feasible physical-law set or a confidence region.',numericQualification};
}
