import {analyzeReferenceSequence} from './reference-sequence.mjs';
import {analyzeReferenceStudy} from './reference-channel.mjs';
export const REFINEMENT_SCHEMA='worldlaw.reference-refinement/v1';
const LIMIT=4000000,EPS=Number.EPSILON;
const fail=m=>{throw Error(m);},finite=x=>typeof x==='number'&&Number.isFinite(x),dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
function closed(x,keys){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).length!==keys.length||keys.some(k=>!Object.hasOwn(x,k)))fail('Complete source-only refinement fields required.');}
function size(x){const s=JSON.stringify(x);if(new TextEncoder().encode(s).length>LIMIT)fail('Complete refinement account exceeds 4 MB.');return s;}
function condition(x,offer){closed(x,offer?['id','duration','reference','mainHalfWidth']:['duration','reference']);if(!finite(x.duration)||x.duration<=0||x.duration>30||!finite(x.reference)||Math.abs(x.reference)>1e6)fail('Use duration in (0,30] and finite point reference within ±1e6.');if(offer&&(typeof x.id!=='string'||!x.id.trim()||x.id.length>80||!finite(x.mainHalfWidth)||x.mainHalfWidth<0||x.mainHalfWidth>1e6))fail('Offer needs a distinct short ID and finite MAIN contrast half-width in [0,1e6].');return {...x};}
export function validateReferenceRefinement(raw){
 size(raw);closed(raw,['schema','account','target','offers','conditionalPointReference']);if(raw.schema!==REFINEMENT_SCHEMA||raw.conditionalPointReference!==true)fail('Declare the future point reference as a conditional assumption, not a controlled input.');
 const account=analyzeReferenceSequence(raw.account).account,target=condition(raw.target,false);
 if(!Array.isArray(raw.offers)||!raw.offers.length||raw.offers.length>32)fail('Supply 1–32 explicit offers.');const offers=raw.offers.map(o=>condition(o,true));if(new Set(offers.map(o=>o.id)).size!==offers.length)fail('Offer IDs must be distinct.');
 const value={schema:REFINEMENT_SCHEMA,account,target,offers,conditionalPointReference:true};size(value);return freeze(value);
}
class NumericalFailure extends Error {}
const numeric=m=>{throw new NumericalFailure(m);};
function hull(nodes){
 const p=[...new Map(nodes.map(n=>[JSON.stringify(n.d),n])).values()].sort((a,b)=>a.d[0]-b.d[0]||a.d[1]-b.d[1]);if(p.length<=2)return p;
 const ranges=[0,1].map(k=>Math.max(...p.map(x=>x.d[k]))-Math.min(...p.map(x=>x.d[k]))||1);
 function turn(a,b,c){const x=(b.d[0]-a.d[0])/ranges[0],y=(b.d[1]-a.d[1])/ranges[1],z=(c.d[0]-a.d[0])/ranges[0],w=(c.d[1]-a.d[1])/ranges[1],v=x*w-y*z;
  if(!finite(v))numeric('Nonfinite hull orientation.');if(v!==0&&Math.abs(v)<=32*EPS*(Math.abs(x*w)+Math.abs(y*z)))numeric('Hull orientation is numerically unresolved.');return v;
 }
 const half=xs=>{const h=[];for(const x of xs){while(h.length>1&&turn(h.at(-2),h.at(-1),x)<=0)h.pop();h.push(x);}return h;};return [...half(p).slice(0,-1),...half([...p].reverse()).slice(0,-1)];
}
function mix(a,b,t){if(!finite(t)||t<0||t>1)numeric('Unresolved strip intersection.');return Object.fromEntries(['d','p','q'].map(k=>[k,a[k].map((x,i)=>x+t*(b[k][i]-x))]));}
function clip(poly,u,b){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],z=poly[(i+1)%poly.length],s=dot(u,a.d)-b,t=dot(u,z.d)-b;if(!finite(s)||!finite(t))numeric('Nonfinite strip residual.');if(s<=0)out.push(a);if(s<0&&t>0||s>0&&t<0)out.push(mix(a,z,s/(s-t)));}return out;}
function inside(vertices,p){
 // Independent original-component half-plane/segment verification; the tolerance
 // is a screening guard, not an interval-arithmetic certificate.
 const h=hull(vertices.map(d=>({d}))),guard=1e-9*(1+Math.max(...vertices.flat().map(Math.abs)));
 if(h.length===1)return Math.hypot(...p.map((x,i)=>x-h[0].d[i]))<=guard;
 if(h.length===2){const [a,b]=h.map(x=>x.d),d=b.map((x,i)=>x-a[i]),v=p.map((x,i)=>x-a[i]);return Math.abs(d[0]*v[1]-d[1]*v[0])<=guard&&dot(v,d)>=-guard&&dot(v,d)<=dot(d,d)+guard;}
 return h.every((a,i)=>{const b=h[(i+1)%h.length].d;return (b[0]-a.d[0])*(p[1]-a.d[1])-(b[1]-a.d[1])*(p[0]-a.d[0])>=-guard;});
}
export function screenDifferenceRefinement(parts,u,v,epsilon){
 if(!Array.isArray(parts)||!parts.length||parts.length>2||parts.some(p=>!Array.isArray(p)||!p.length||p.length>64||p.some(x=>!Array.isArray(x)||x.length!==2||!x.every(finite)||x.some(y=>Math.abs(y)>100))))fail('Use at most two complete bounded coefficient polygons, at most 64 vertices each.');
 if(![u,v].every(x=>Array.isArray(x)&&x.length===2&&x.every(finite))||!finite(epsilon)||epsilon<0)fail('Finite projection vectors and nonnegative MAIN half-width required.');
 try{
  let best=null;const pairs=[];
  for(let i=0;i<parts.length;i++)for(let j=0;j<parts.length;j++){
   const difference=hull(parts[i].flatMap(p=>parts[j].map(q=>({d:p.map((x,k)=>x-q[k]),p,q}))));
   const cut=clip(clip(difference,u,2*epsilon),u.map(x=>-x),2*epsilon);let local=null;
   for(const w of cut){const width=Math.abs(dot(v,w.d));if(!finite(width))numeric('Nonfinite target projection.');if(!local||width>local.width)local={width,i,j,...w};}
   pairs.push({leftComponent:i,rightComponent:j,differenceVertices:difference.length,clippedVertices:cut.length,maximum:local?.width??null});if(local&&(!best||local.width>best.width))best=local;
  }
  if(!best)numeric('No computed diagonal pair survived; refinement unresolved.');
  if(!inside(parts[best.i],best.p)||!inside(parts[best.j],best.q))numeric('Attaining pair failed original-component verification.');
  const values=parts.flatMap(p=>p.map(t=>dot(v,t))),baseline=Math.max(...values)-Math.min(...values),y=(dot(u,best.p)+dot(u,best.q))/2;
  const guard=1e-9*(1+Math.max(...values.map(Math.abs),Math.abs(y),baseline));
  const residuals=[Math.abs(dot(u,best.p)-y),Math.abs(dot(u,best.q)-y)];if(residuals.some(x=>!finite(x)||x>epsilon+guard)||best.width>baseline+guard)numeric('Attaining pair failed main-band or baseline verification.');
  return {status:'computed',baselineWidth:baseline,worstRemainingWidth:best.width,screeningReduction:baseline-best.width,numericalGuard:guard,pairs,witness:{left:best.p,right:best.q,leftComponent:best.i,rightComponent:best.j,commonMainReading:y,mainResiduals:residuals,targetValues:[dot(v,best.p),dot(v,best.q)]}};
 }catch(e){if(e instanceof NumericalFailure)return {status:'numerically-unresolved',reason:e.message};throw e;}
}
export function analyzeReferenceRefinement(raw){
 const source=validateReferenceRefinement(raw),analysis=analyzeReferenceSequence(source.account).analysis,models=analysis.models.filter(m=>m.joint.polygons.length);
 if(models.length!==1||models[0].tau===null)fail('This refinement requires exactly one surviving fixed-tau additional-response family. Existing family-separation planning remains separate.');
 const runCount=analysis.source.study.runs.length;if(runCount>=12)fail('No acquisition capacity remains for a new offer.');
 const model=models[0],basis=t=>-Math.expm1(-t/model.tau),v=[source.target.reference,basis(source.target.duration)],points=analyzeReferenceStudy(analysis.source.study).points;
 const comparisons=source.offers.map(offer=>{
  const result=screenDifferenceRefinement(model.joint.polygons.map(p=>p.vertices),[offer.reference,basis(offer.duration)],v,offer.mainHalfWidth);
  if(result.status==='computed'){
   const checks=[];for(const theta of [result.witness.left,result.witness.right])for(const p of points.filter(p=>p.role==='training'||p.qualified)){
    const [g,A]=theta,b=basis(p.duration),prediction=p.reference.interval.map(r=>g*r+A*b).sort((a,b)=>a-b),main=p.main.interval;
    const slack=1e-10*(1+Math.max(...main.map(Math.abs))+10*Math.max(...p.reference.interval.map(Math.abs))+100*Math.abs(b));
    const violation=Math.max(prediction[0]-main[1],main[0]-prediction[1],0);checks.push({runId:p.id,violation,maintainedScreeningSlack:slack});
    if(violation>slack+1e-12)return {offer,status:'numerically-unresolved',reason:'Attaining pair failed original source interval verification.'};
   }
   result.witness.sourceConstraintChecks=checks;
  }
  return {offer,...result};
 });
 const computed=comparisons.filter(c=>c.status==='computed').sort((a,b)=>a.worstRemainingWidth-b.worstRemainingWidth),best=computed[0];
 const nearTies=best?computed.filter(c=>Math.abs(c.worstRemainingWidth-best.worstRemainingWidth)<=Math.max(c.numericalGuard,best.numericalGuard)).map(c=>c.offer.id):[];
 const recommendation=computed.length===comparisons.length&&nearTies.length===1&&best.screeningReduction>best.numericalGuard?best.offer.id:null;
 return {source,modelId:model.id,tau:model.tau,comparisons,recommendation,nearTies,scope:'Conditional exact point-reference assumption and future MAIN contrast half-width. Worst remaining target diameter over every compatible future main reading, using all component pairs and one shared coefficient tuple per explanation. Binary64 screening with heuristic numerical guards; not certified arithmetic, calibrated uncertainty, controlled intervention or physical identification.'};
}
export const exportReferenceRefinement=raw=>size(validateReferenceRefinement(raw));
export function importReferenceRefinement(text){if(typeof text!=='string'||new TextEncoder().encode(text).length>LIMIT)fail('Complete refinement account exceeds 4 MB.');return validateReferenceRefinement(JSON.parse(text));}
