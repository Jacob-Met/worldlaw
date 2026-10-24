import {compareOrderArtifacts} from './periodic-order.mjs';
import {serialOrderWeights} from './serial-order.mjs';
const check=(ok,m)=>{if(!ok)throw Error(m);};
const dense=(a,max)=>Array.isArray(a)&&a.length<=max&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
function course(weights,band,budget,strategy,tolerance){
 const origin=(Math.min(...weights.map(w=>w.sampleIndex))+Math.max(...weights.map(w=>w.sampleIndex)))/2;
 const terms=weights.map(w=>({w:w.weight,omega:2*Math.PI*(w.sampleIndex-origin)}));
 const sum=terms.reduce((s,x)=>s+Math.abs(x.w),0),L=terms.reduce((s,x)=>s+Math.abs(x.w*x.omega),0),M2=terms.reduce((s,x)=>s+Math.abs(x.w)*x.omega**2,0);
 const lo=1/band.toPeriod,hi=1/band.fromPeriod;check(lo<hi,'Frequency endpoints are not distinguishable numerically; widen the band.');let used=0,witness=null,lower=0,stalled=false;
 function sample(f){let re=0,im=0,dr=0,di=0;for(const t of terms){const phase=t.omega*f;re+=t.w*Math.cos(phase);im+=t.w*Math.sin(phase);dr-=t.w*t.omega*Math.sin(phase);di+=t.w*t.omega*Math.cos(phase);}used++;
  const gain=Math.hypot(re,im),allowance=512*Number.EPSILON*sum*(1+Math.max(...terms.map(t=>Math.abs(t.omega*f))));
  if(!witness||gain>witness.gain)witness={period:1/f,gain,allowance};lower=Math.max(lower,gain-allowance);return{re,im,dr,di,gain,allowance};}
 function cell(a,b){const m=a+(b-a)/2,d=Math.max(m-a,b-m),s=sample(m);if(!(m>a&&m<b))stalled=true;
  const linear=Math.max(Math.hypot(s.re-d*s.dr,s.im-d*s.di),Math.hypot(s.re+d*s.dr,s.im+d*s.di));
  const allowance=s.allowance*(1+d*Math.max(...terms.map(t=>Math.abs(t.omega))))+512*Number.EPSILON*(1+M2*d*d)+8*Number.EPSILON*Math.max(Math.abs(lo),Math.abs(hi))*L;
  return{fromFrequency:a,toFrequency:b,upper:Math.min(sum,s.gain+L*d,linear+.5*M2*d*d)+allowance,allowance};}
 sample(lo);sample(hi);let cells=[];
 if(strategy==='uniform'){const count=budget-2;for(let i=0;i<count;i++)cells.push(cell(lo+(hi-lo)*i/count,lo+(hi-lo)*(i+1)/count));}
 else{cells=[cell(lo,hi)];while(used+2<=budget){const upper=Math.max(...cells.map(c=>c.upper));if(upper-lower<=tolerance)break;cells.sort((a,b)=>b.upper-a.upper);const parent=cells[0],mid=parent.fromFrequency+(parent.toFrequency-parent.fromFrequency)/2;if(!(mid>parent.fromFrequency&&mid<parent.toFrequency)){stalled=true;break;}cells.shift();cells.push(cell(parent.fromFrequency,mid),cell(mid,parent.toFrequency));}}
 const upper=Math.max(lower,...cells.map(c=>c.upper)),gap=upper-lower;
 return{strategy,evaluations:used,witness,lower,upper,gap,status:gap<=tolerance?'engineering-gap-met':stalled?'unresolved-resolution':'unresolved-budget',cells};
}
export function inspectPeriodBands(raw){
 check(raw?.schema==='worldlaw.period-bands/v1','Expected prospective period-band inputs.');
 check(dense(raw.bands,4)&&raw.bands.length>0,'Supply 1–4 complete sourced bands.');
 const ids=new Set(),bands=raw.bands.map(b=>{check(typeof b?.id==='string'&&/^[A-Za-z0-9_-]{1,64}$/.test(b.id)&&!ids.has(b.id),'Bands need distinct short IDs.');ids.add(b.id);check(typeof b.sourceNote==='string'&&b.sourceNote.trim()&&b.sourceNote.length<=2000,'Declare each band source.');check([b.fromPeriod,b.toPeriod].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=1&&v<=1e6)&&b.fromPeriod<b.toPeriod,'Declare increasing period bands within1–1000000steps.');return{id:b.id,sourceNote:b.sourceNote,fromPeriod:b.fromPeriod,toPeriod:b.toPeriod};});
 check(Number.isInteger(raw.evaluations)&&raw.evaluations>=5&&raw.evaluations<=255,'Declare 5–255 evaluations per strategy and plan-band pair.');
 check(typeof raw.tolerance==='number'&&Number.isFinite(raw.tolerance)&&raw.tolerance>=1e-10&&raw.tolerance<=1,'Declare engineering gap tolerance1e-10–1.');
 const comparison=compareOrderArtifacts(raw.comparison);check(comparison.inputs.schema==='worldlaw.serial-orders/v2','Retain a v2 prospective comparison.');
 const count=comparison.inputs.plans.reduce((s,p)=>s+p.pairs.length*2,0)*bands.length*raw.evaluations*2;
 check(count<=2_000_000,'Complete two-strategy course exceeds two million weighted evaluations; reduce inputs explicitly.');
 const rows=comparison.inputs.plans.flatMap(p=>bands.map(b=>({planId:p.id,bandId:b.id,strategies:['uniform','adaptive'].map(s=>course(serialOrderWeights(p.pairs),b,raw.evaluations,s,raw.tolerance))})));
 return{inputs:{schema:raw.schema,comparison:comparison.inputs,bands,evaluations:raw.evaluations,tolerance:raw.tolerance},comparison,rows,
  interpretation:'Prospective constant-frequency bands only. Exact-real variation inequalities use engineering floating-point/trigonometric allowances, not formal certified enclosures. Witnesses demonstrate sampled gain; unresolved cells and strategy differences remain. No drift-within-run, amplitude calibration, physical safety or observed-notebook inference.'};
}
