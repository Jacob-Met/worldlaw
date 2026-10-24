import {serialCovariance} from './serial-covariance.mjs';
const dense=a=>Array.isArray(a)&&a.length<=128&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const require=(ok,message)=>{if(!ok)throw Error(message);};
export function compareSerialOrders(raw){
 require(raw?.schema==='worldlaw.serial-orders/v1','Expected declared serial-order inputs.');
 require(typeof raw.sourceNote==='string'&&raw.sourceNote.trim().length>0&&raw.sourceNote.length<=2000,'Declare a planning basis or source note (up to 2000 characters).');
 require(dense(raw.rhos)&&raw.rhos.length>=1&&raw.rhos.length<=16&&raw.rhos.every(r=>typeof r==='number'&&Number.isFinite(r)&&Math.abs(r)<=.999),'Offer 1–16 finite correlations within ±0.999.');
 require(new Set(raw.rhos).size===raw.rhos.length,'Correlation hypotheses must be distinct.');
 require(dense(raw.plans)&&raw.plans.length>=2&&raw.plans.length<=32,'Offer 2–32 complete plans.');
 const ids=new Set();let work=0;
 const plans=raw.plans.map(p=>{
  require(typeof p?.id==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(p.id)&&!ids.has(p.id),'Plans need distinct short identifiers.');ids.add(p.id);
  require(dense(p.pairs)&&p.pairs.length>=8&&p.pairs.length<=128,'Each plan needs 8–128 complete pairs.');
  const indices=new Set();let ab=0,ba=0;
  const pairs=p.pairs.map(pair=>{
   const {reference,conditioned}=pair||{};
   require([reference,conditioned].every(x=>Number.isSafeInteger(x)&&x>=0&&x<=1e9)&&Math.abs(reference-conditioned)===1,'Each pair needs distinct adjacent acquisition indices.');
   require(!indices.has(reference)&&!indices.has(conditioned),'Acquisition indices cannot repeat.');indices.add(reference);indices.add(conditioned);
   reference<conditioned?ab++:ba++;return {reference,conditioned};
  });
  require(ab>=4&&ba>=4,'Each plan needs at least four pairs in each order.');
  work+=4*pairs.length**2*raw.rhos.length;
  return {id:p.id,pairs,ab,ba};
 });
 require(plans.every(p=>p.pairs.length===plans[0].pairs.length),'Offer the same total pair count in every plan.');
 require(work<=2_000_000,'Complete offered course exceeds two million covariance terms; reduce plans or hypotheses explicitly.');
 const rows=plans.map(p=>{
  const weights=p.pairs.flatMap(x=>{const n=x.reference<x.conditioned?p.ab:p.ba;return [{sampleIndex:x.reference,weight:-.5/n},{sampleIndex:x.conditioned,weight:.5/n}];});
  const variances=raw.rhos.map(r=>serialCovariance(weights,r,1).variance);
  const indices=p.pairs.flatMap(x=>[x.reference,x.conditioned]);
  return {id:p.id,pairCount:p.pairs.length,firstIndex:Math.min(...indices),lastIndex:Math.max(...indices),acquisitionSpan:Math.max(...indices)-Math.min(...indices),variances,worstVariance:Math.max(...variances)};
 });
 const minimum=Math.min(...rows.map(r=>r.worstVariance)),epsilon=1e-12;
 for(const row of rows){row.minimaxTie=Math.abs(row.worstVariance-minimum)<=epsilon;row.dominatedBy=rows.filter(other=>other!==row&&other.variances.every((v,i)=>v<=row.variances[i])&&other.variances.some((v,i)=>v<row.variances[i]-epsilon)).map(x=>x.id);}
 return {inputs:{schema:raw.schema,sourceNote:raw.sourceNote,rhos:[...raw.rhos],plans:plans.map(({id,pairs})=>({id,pairs}))},rows,comparisonTolerance:epsilon,
  interpretation:'Variance per unit declared marginal sensor variance, for these offered schedules and correlations only. No future readings, empirical scatter, execution permission or globally safest order is inferred. Periodic artifacts, carryover and nonstationary noise are outside this model.'};
}
