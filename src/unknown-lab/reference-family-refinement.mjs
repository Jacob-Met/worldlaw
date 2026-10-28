import {analyzeReferenceSequence} from './reference-sequence.mjs';
import {analyzeReferenceStudy} from './reference-channel.mjs';
import {validateIntervalRefinement,INTERVAL_REFINEMENT_SCHEMA} from './reference-interval-refinement.mjs';
import {reserveReferenceProductWork,screenReferenceProducts} from './reference-product-faces.mjs';
export const FAMILY_REFINEMENT_SCHEMA='worldlaw.reference-family-refinement/v1';
const LIMIT=4000000,fail=m=>{throw Error(m);},size=x=>{const s=JSON.stringify(x);if(new TextEncoder().encode(s).length>LIMIT)fail('Complete retained-family refinement exceeds 4 MB.');return s;};
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
export function validateFamilyRefinement(raw){
 size(raw);const keys=['schema','account','target','offers','conditionalReferenceInterval','scope'];if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length!==keys.length||keys.some(k=>!Object.hasOwn(raw,k))||raw.schema!==FAMILY_REFINEMENT_SCHEMA||raw.scope!=='all-retained-families')fail('Complete source-only all-retained-family account required.');
 const source=validateIntervalRefinement({schema:INTERVAL_REFINEMENT_SCHEMA,account:raw.account,target:raw.target,offers:raw.offers,conditionalReferenceInterval:raw.conditionalReferenceInterval});
 const value={...source,schema:FAMILY_REFINEMENT_SCHEMA,scope:'all-retained-families'};size(value);return freeze(value);
}
export function analyzeFamilyRefinement(raw){
 // Re-admit the complete original sequence and finite family catalogue before
 // geometry reservation or scoring. No externally supplied derived set is used.
 const source=validateFamilyRefinement(raw),analysis=analyzeReferenceSequence(source.account).analysis,models=analysis.models.filter(m=>m.joint.polygons.length);
 if(!models.length)fail('No original family survives; target refinement cannot resurrect a model.');if(analysis.source.study.runs.length>=12)fail('No acquisition capacity remains.');
 const basis=(t,tau)=>tau===null?0:-Math.expm1(-t/tau),components=models.flatMap(m=>m.joint.polygons.map((p,index)=>({modelId:m.id,tau:m.tau,originalComponent:index,sign:p.sign,vertices:p.vertices}))),parts=components.map(c=>c.vertices),signs=components.map(c=>c.sign),modelIds=components.map(c=>c.modelId),targets=components.map(c=>[source.target.reference,basis(source.target.duration,c.tau)]);
 const work=reserveReferenceProductWork(parts,signs,source.offers.length),points=analyzeReferenceStudy(analysis.source.study).points;
 // Reservation covers every declared offer and original component product;
 // budget refusal occurs above before the first screen is called.
 const comparisons=source.offers.map(offer=>{
  if(work.status!=='reserved')return {offer,status:'numerically-unresolved',reason:work.reason};
  const result=screenReferenceProducts(parts,signs,components.map(c=>[offer.reference,basis(offer.duration,c.tau)]),targets,offer.referenceHalfWidth,offer.mainHalfWidth,{workLimit:250000,modelIds});
  if(result.status==='computed'){
   const checks=[];
   for(const [theta,index]of[[result.witness.left,result.witness.leftComponent],[result.witness.right,result.witness.rightComponent]]){
    const component=components[index];for(const p of points.filter(p=>p.role==='training'||p.qualified)){
     const[g,A]=theta,b=basis(p.duration,component.tau),prediction=p.reference.interval.map(r=>g*r+A*b).sort((a,b)=>a-b),main=p.main.interval,slack=1e-10*(1+Math.max(...main.map(Math.abs))+10*Math.max(...p.reference.interval.map(Math.abs))+100*Math.abs(b)),violation=Math.max(prediction[0]-main[1],main[0]-prediction[1],0);
     checks.push({modelId:component.modelId,tau:component.tau,originalComponent:component.originalComponent,runId:p.id,violation,maintainedScreeningSlack:slack});
     if(violation>slack+1e-12)return {offer,status:'numerically-unresolved',reason:'Attaining model failed its original source interval verification.'};
    }
   }
   result.witness.sourceConstraintChecks=checks;result.witness.leftFamily={modelId:components[result.witness.leftComponent].modelId,tau:components[result.witness.leftComponent].tau,originalComponent:components[result.witness.leftComponent].originalComponent};result.witness.rightFamily={modelId:components[result.witness.rightComponent].modelId,tau:components[result.witness.rightComponent].tau,originalComponent:components[result.witness.rightComponent].originalComponent};
  }
  return {offer,...result};
 });
 const computed=comparisons.filter(c=>c.status==='computed').sort((a,b)=>a.worstRemainingWidth-b.worstRemainingWidth),best=computed[0],nearTies=best?computed.filter(c=>Math.abs(c.worstRemainingWidth-best.worstRemainingWidth)<=Math.max(c.numericalGuard,best.numericalGuard)).map(c=>c.offer.id):[],recommendation=computed.length===comparisons.length&&nearTies.length===1&&best.screeningReduction>best.numericalGuard?best.offer.id:null;
 return {source,models:models.map(m=>({id:m.id,tau:m.tau,status:m.joint.status})),components:components.map(({vertices,...c})=>c),work,comparisons,recommendation,nearTies,scope:'All original surviving finite families and sign components; no interpolation across family IDs. Model-specific future and point-target bases. Conditional reported reference interval with separate latent reference per alternative and one common MAIN reading. Complete bounded binary64 screening, not certified arithmetic, calibrated probability, actual acquisition or physical identification.'};
}
export const exportFamilyRefinement=raw=>size(validateFamilyRefinement(raw));
export function importFamilyRefinement(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>LIMIT)fail('Complete retained-family refinement exceeds 4 MB.');return validateFamilyRefinement(JSON.parse(text));}
