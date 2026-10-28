import {screenReferenceProducts} from './reference-product-faces.mjs';
import {analyzeReferenceSequence} from './reference-sequence.mjs';
import {analyzeReferenceStudy} from './reference-channel.mjs';
import {validateReferenceRefinement,REFINEMENT_SCHEMA} from './reference-refinement.mjs';
export const INTERVAL_REFINEMENT_SCHEMA='worldlaw.reference-interval-refinement/v1';
const EPS=Number.EPSILON,LIMIT=4000000,MAX_WORK=100000;
const finite=x=>typeof x==='number'&&Number.isFinite(x),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),fail=m=>{throw Error(m);};
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const size=x=>{const s=JSON.stringify(x);if(new TextEncoder().encode(s).length>LIMIT)fail('Complete interval refinement exceeds 4 MB.');return s;};
const closed=(x,ks)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===ks.length&&ks.every(k=>Object.hasOwn(x,k));
export function validateIntervalRefinement(raw){
 size(raw);if(!closed(raw,['schema','account','target','offers','conditionalReferenceInterval'])||raw.schema!==INTERVAL_REFINEMENT_SCHEMA||raw.conditionalReferenceInterval!==true)fail('Declare the reported reference interval as conditional, not controlled or authenticated.');
 if(!Array.isArray(raw.offers)||!raw.offers.length||raw.offers.length>32)fail('Supply 1–32 explicit offered reference intervals.');
 const offers=raw.offers.map(o=>{if(!closed(o,['id','duration','reference','referenceHalfWidth','mainHalfWidth'])||!finite(o.referenceHalfWidth)||o.referenceHalfWidth<0||o.referenceHalfWidth>1e6||!finite(o.reference)||Math.abs(o.reference)+o.referenceHalfWidth>1e6)fail('Reference half-width must be explicit, nonnegative and keep the complete interval within ±1e6.');return {...o};});
 const point=validateReferenceRefinement({schema:REFINEMENT_SCHEMA,account:raw.account,target:raw.target,offers:offers.map(({referenceHalfWidth,...o})=>o),conditionalPointReference:true});
 const source={schema:INTERVAL_REFINEMENT_SCHEMA,account:point.account,target:point.target,offers,conditionalReferenceInterval:true};size(source);return freeze(source);
}
export function screenIntervalRefinement(parts,signs,u,v,rho,epsilon,{workLimit=100000}={}){
 if(!Array.isArray(parts)||parts.length<1||parts.length>2)fail('Use at most two original bounded components with at most 64 vertices each.');
 if(!Number.isSafeInteger(workLimit)||workLimit<1||workLimit>100000)fail('Finite projections, explicit nonnegative half-widths and bounded work required.');
 const result=screenReferenceProducts(parts,signs,parts.map(()=>u),parts.map(()=>v),rho,epsilon,{workLimit});
 if(result.status==='computed'){result.pairs=result.pairs.map(({leftModel,rightModel,...pair})=>pair);const {leftModel,rightModel,...witness}=result.witness;result.witness=witness;}
 return result;
}
export function analyzeIntervalRefinement(raw){
 const source=validateIntervalRefinement(raw),analysis=analyzeReferenceSequence(source.account).analysis,models=analysis.models.filter(m=>m.joint.polygons.length);
 if(models.length!==1||models[0].tau===null)fail('Finite reference refinement requires exactly one surviving fixed-tau additional-response family.');if(analysis.source.study.runs.length>=12)fail('No acquisition capacity remains.');
 const model=models[0],basis=t=>-Math.expm1(-t/model.tau),v=[source.target.reference,basis(source.target.duration)],points=analyzeReferenceStudy(analysis.source.study).points;
 const comparisons=source.offers.map(offer=>{const result=screenIntervalRefinement(model.joint.polygons.map(p=>p.vertices),model.joint.polygons.map(p=>p.sign),[offer.reference,basis(offer.duration)],v,offer.referenceHalfWidth,offer.mainHalfWidth);
  if(result.status==='computed'){const checks=[];for(const[g,A]of[result.witness.left,result.witness.right])for(const p of points.filter(p=>p.role==='training'||p.qualified)){const b=basis(p.duration),prediction=p.reference.interval.map(r=>g*r+A*b).sort((a,b)=>a-b),main=p.main.interval,slack=1e-10*(1+Math.max(...main.map(Math.abs))+10*Math.max(...p.reference.interval.map(Math.abs))+100*Math.abs(b)),violation=Math.max(prediction[0]-main[1],main[0]-prediction[1],0);checks.push({runId:p.id,violation,maintainedScreeningSlack:slack});if(violation>slack+1e-12)return {offer,status:'numerically-unresolved',reason:'Attaining pair failed original source interval verification.'};}result.witness.sourceConstraintChecks=checks;}return {offer,...result};});
 const computed=comparisons.filter(c=>c.status==='computed').sort((a,b)=>a.worstRemainingWidth-b.worstRemainingWidth),best=computed[0],nearTies=best?computed.filter(c=>Math.abs(c.worstRemainingWidth-best.worstRemainingWidth)<=Math.max(c.numericalGuard,best.numericalGuard)).map(c=>c.offer.id):[],recommendation=computed.length===comparisons.length&&nearTies.length===1&&best.screeningReduction>best.numericalGuard?best.offer.id:null;
 return {source,modelId:model.id,tau:model.tau,comparisons,recommendation,nearTies,scope:'One conditional reported reference interval per offer; each alternative may have its own latent reference within it. MAIN contrast half-width is separate. Point-reference target; one fixed-tau original family. Complete product-face binary64 screening, with exact stored-value rank predicates only; not certified enclosures, calibrated uncertainty, authenticated acquisition or physically controlled input.'};
}
export const exportIntervalRefinement=raw=>size(validateIntervalRefinement(raw));
export function importIntervalRefinement(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>LIMIT)fail('Complete interval refinement exceeds 4 MB.');return validateIntervalRefinement(JSON.parse(text));}
