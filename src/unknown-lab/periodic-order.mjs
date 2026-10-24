import {compareSerialOrders,serialOrderWeights} from './serial-order.mjs';
const check=(ok,message)=>{if(!ok)throw Error(message);};
export function compareOrderArtifacts(raw){
 if(raw?.schema==='worldlaw.serial-orders/v1')return compareSerialOrders(raw);
 check(raw?.schema==='worldlaw.serial-orders/v2','Expected serial-order inputs v1 or v2.');
 const family=raw.periodic;
 check(typeof family?.sourceNote==='string'&&family.sourceNote.trim()&&family.sourceNote.length<=2000,'Declare the periodic-family basis (up to 2000 characters).');
 const periods=family.periods;
 check(Array.isArray(periods)&&periods.length>=1&&periods.length<=16&&Array.from({length:periods.length},(_,i)=>Object.hasOwn(periods,i)).every(Boolean)&&periods.every(p=>typeof p==='number'&&Number.isFinite(p)&&p>=1&&p<=1e6),'Offer 1–16 explicit periods from 1 to 1000000 acquisition steps.');
 check(new Set(periods).size===periods.length,'Periodic hypotheses must be distinct.');
 const baseline=compareSerialOrders({...raw,schema:'worldlaw.serial-orders/v1'});
 check(baseline.rows.every(r=>r.acquisitionSpan<=1e6),'Periodic evaluation supports acquisition spans at most 1000000 steps; no plans were dropped.');
 const rows=baseline.rows.map((row,i)=>{
  const weights=serialOrderWeights(baseline.inputs.plans[i].pairs);
  const artifacts=periods.map(period=>{
   return periodicContrastGain(weights,period,row.firstIndex);
  });
  return {...row,artifacts};
 });
 return {...baseline,inputs:{...baseline.inputs,schema:raw.schema,periodic:{sourceNote:family.sourceNote,periods:[...periods]}},rows,
  interpretation:'Noise variance and normalized arbitrary-phase sinusoid gain are separate conditional quantities. Each gain applies only to its declared period in acquisition steps. Near cancellation is a floating-point diagnostic, not certified zero or immunity. No combined score, phase estimate, calibration, elapsed-time frequency or general artifact resistance is inferred.'};
}

// Shared conditional linear response; callers admit indices/periods and work bounds.
export function periodicContrastGain(weights,period,origin){
 let cosine=0,sine=0;
 for(const {sampleIndex,weight} of weights){
  const phase=2*Math.PI*((sampleIndex-origin)%period)/period;
  cosine+=weight*Math.cos(phase);sine+=weight*Math.sin(phase);
 }
 const gain=Math.hypot(cosine,sine);
 return {period,gain,cosine,sine,nearCancellation:gain<=1e-10};
}
