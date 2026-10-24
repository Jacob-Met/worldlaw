import {compareOrderArtifacts} from './periodic-order.mjs';
import {serialOrderWeights} from './serial-order.mjs';
import {serialCovariance} from './serial-covariance.mjs';
import * as Q from './chronos-exact-halfplanes.mjs';
const check=(ok,message)=>{if(!ok)throw Error(message);};
export const CORRELATION_BAND_SCHEMA='worldlaw.correlation-band/v1';
export function inspectCorrelationBand(raw){
 check(raw?.schema===CORRELATION_BAND_SCHEMA,'Expected prospective correlation-band inputs v1.');
 check(Object.keys(raw).every(k=>['schema','comparison','band','maximumVariance','maxCells','workLimit'].includes(k)),'Retain original inputs only, without cached results.');
 const band=raw.band;
 check(band&&typeof band.sourceNote==='string'&&band.sourceNote.trim()&&band.sourceNote.length<=2000,'Supply the continuous correlation assumption or source.');
 check([band.lower,band.upper].every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=.999)&&band.lower<band.upper,'Supply an increasing correlation band within −0.999 to 0.999.');
 check(typeof raw.maximumVariance==='number'&&Number.isFinite(raw.maximumVariance)&&raw.maximumVariance>=0&&raw.maximumVariance<=4,'Declare an unchanged normalized variance budget from 0 to 4.');
 check(Number.isInteger(raw.maxCells)&&raw.maxCells>=1&&raw.maxCells<=64,'Declare 1–64 retained cells per plan.');
 check(Number.isInteger(raw.workLimit)&&raw.workLimit>=100&&raw.workLimit<=40000,'Declare 100–40000 shared exact-arithmetic work units.');
 check(raw.comparison?.schema==='worldlaw.serial-orders/v2','Retain the original v2 prospective comparison.');
 const baseline=compareOrderArtifacts(raw.comparison);
 check(baseline.rows.length<=16&&baseline.rows.every(r=>r.pairCount<=16&&r.acquisitionSpan<=31),'Continuous correlation analysis supports 2–16 plans, 8–16 pairs and acquisition span at most 31. No long-gap plan was sampled or dropped.');
 const reservedWork=baseline.rows.reduce((sum,r)=>{const n=r.acquisitionSpan,m=2*r.pairCount,k=raw.maxCells;return sum+2*m*m+10*(n+1)**2+k*(n*(n+1)+2*n+8)+2*k*k+4*m+100;},0);
 check(reservedWork<=raw.workLimit,'Complete declared correlation course exceeds its conservative work reservation; reduce plans or cells explicitly.');
 let work=0;const charge=()=>{check(++work<=raw.workLimit,'Complete correlation-band arithmetic capacity exhausted; no partial course is returned.');};
 const op=name=>(...args)=>{charge();const result=Q[name](...args);if(Array.isArray(result))check(result.every(x=>x.toString(2).replace('-','').length<=2048),'Owned correlation arithmetic bit capacity exhausted; no partial course is returned.');return result;},add=op('add'),mul=op('mul'),div=op('div'),sub=op('sub'),cmp=op('cmp'),rat=op('rational');
 const zero=rat(0),one=rat(1),half=rat(.5),a=rat(band.lower),b=rat(band.upper),budget=rat(raw.maximumVariance);
 const serial=x=>Q.serial(x),enclose=x=>Q.enclosure(x),max=(x,y)=>cmp(x,y)>=0?x:y;
 const choose=(n,k)=>{let v=1n;for(let i=1;i<=k;i++)v=v*BigInt(n-i+1)/BigInt(i);return Number(v);};
 function coefficients(plan,degree){
  const ab=plan.pairs.filter(p=>p.reference<p.conditioned).length,ba=plan.pairs.length-ab;
  const points=plan.pairs.flatMap(p=>{const w=div(one,rat(2*(p.reference<p.conditioned?ab:ba)));return[{index:p.reference,w:Q.neg(w)},{index:p.conditioned,w}];});
  const maintained=serialOrderWeights(plan.pairs);points.forEach((p,i)=>{const e=enclose(p.w);check(maintained[i].sampleIndex===p.index&&maintained[i].weight>=e.lower&&maintained[i].weight<=e.upper,'Maintained signed contrast no longer matches this exact polynomial contract.');});
  const c=Array.from({length:degree+1},()=>zero);
  for(const p of points)for(const q of points){const k=Math.abs(p.index-q.index);c[k]=add(c[k],mul(p.w,q.w));}
  return c;
 }
 function bernstein(c){
  const n=c.length-1,width=sub(b,a),ap=[one],wp=[one];for(let i=1;i<=n;i++){ap.push(mul(ap.at(-1),a));wp.push(mul(wp.at(-1),width));}
  const power=[];for(let j=0;j<=n;j++){let v=zero;for(let k=j;k<=n;k++)v=add(v,mul(mul(mul(c[k],rat(choose(k,j))),ap[k-j]),wp[j]));power.push(v);}
  const beta=[];for(let i=0;i<=n;i++){let v=zero;for(let j=0;j<=i;j++)v=add(v,mul(power[j],div(rat(choose(i,j)),rat(choose(n,j)))));beta.push(v);}return beta;
 }
 const makeCell=(lo,hi,beta)=>({lo,hi,beta,upper:beta.reduce(max)});
 const rows=baseline.rows.map((base,index)=>{
  const c=coefficients(baseline.inputs.plans[index],base.acquisitionSpan),beta=bernstein(c);
  let cells=[makeCell(a,b,beta)],witness=cmp(beta[0],beta.at(-1))>=0?{rho:a,value:beta[0]}:{rho:b,value:beta.at(-1)};
  while(cells.length<raw.maxCells){
   let selected=0;for(let i=1;i<cells.length;i++)if(cmp(cells[i].upper,cells[selected].upper)>0)selected=i;
   const parent=cells[selected];
   // Equality is exact, not a floating-point convergence tolerance.
   if(cmp(parent.upper,witness.value)===0)break;
   const levels=[parent.beta];while(levels.at(-1).length>1){const prev=levels.at(-1),next=[];for(let i=1;i<prev.length;i++)next.push(mul(add(prev[i-1],prev[i]),half));levels.push(next);}
   const mid=mul(add(parent.lo,parent.hi),half),left=levels.map(r=>r[0]),right=levels.map(r=>r.at(-1)).reverse();
   if(cmp(left.at(-1),witness.value)>0)witness={rho:mid,value:left.at(-1)};
   cells.splice(selected,1,makeCell(parent.lo,mid,left),makeCell(mid,parent.hi,right));
  }
  cells.sort((x,y)=>cmp(x.lo,y.lo));const upper=cells.map(c=>c.upper).reduce(max),lower=witness.value;
  const status=cmp(lower,budget)>0?'witness-exceeds-budget':cmp(upper,budget)<0?'below-budget-entire-band':cmp(lower,budget)===0&&cmp(upper,budget)===0?'exact-budget-boundary':'unresolved-budget';
  const displayedRho=enclose(witness.rho).lower;let atDisplay=zero;const rho=rat(displayedRho);for(let k=c.length-1;k>=0;k--)atDisplay=add(mul(atDisplay,rho),c[k]);
  const maintainedVariance=serialCovariance(serialOrderWeights(baseline.inputs.plans[index].pairs),displayedRho,1).variance;
  return {...base,status,lower:enclose(lower),upper:enclose(upper),exactLower:serial(lower),exactUpper:serial(upper),
   witness:{rho:enclose(witness.rho),exactRho:serial(witness.rho),exactVariance:serial(lower),displayedRho,displayedVariance:enclose(atDisplay),maintainedVariance},
   cells:cells.map(c=>({from:enclose(c.lo),to:enclose(c.hi),upper:enclose(c.upper),exactFrom:serial(c.lo),exactTo:serial(c.hi),exactUpper:serial(c.upper)}))};
 });
 return {inputs:{schema:CORRELATION_BAND_SCHEMA,comparison:baseline.inputs,band:{lower:band.lower,upper:band.upper,sourceNote:band.sourceNote},maximumVariance:raw.maximumVariance,maxCells:raw.maxCells,workLimit:raw.workLimit},rows,workUsed:work,reservedWork,
  interpretation:'Exact rational polynomial bounds conditional on the declared stationary AR(1) covariance and exact mathematical contrast weights. JSON numbers mean their parsed binary64 values, not exact decimal text. Displayed floats are outward projections; only rational comparisons classify the unchanged budget. Finite correlation hypotheses remain separate. No fitted correlation, calibrated uncertainty, physical sensor validation or combined noise/periodic score is inferred.'};
}
export function reopenCorrelationBand(text){check(typeof text==='string'&&text.length<=200000,'Use correlation-band inputs below 200 KB.');let raw;try{raw=JSON.parse(text);}catch{throw Error('Correlation-band input must be valid JSON.');}return inspectCorrelationBand(raw);}
