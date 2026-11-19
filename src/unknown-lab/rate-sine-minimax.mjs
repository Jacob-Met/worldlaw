import {coefficientBounds} from './probe-coefficient-bounds.mjs';
import {add,sub,mul,div,neg,cmp,rational,clip,enclosure,serial} from './chronos-exact-halfplanes.mjs';

/*
 * Minimax experiment design for a shared rate + sin(position) law.
 * For a feasible coefficient set P and future bounded-error readings,
 * possible pairs of surviving laws differ by d in P-P, restricted by
 * |feature_j . d| <= 2*errorRadius_j for each chosen future reading.
 * Clip P-P exactly to find the worst remaining posterior coefficient widths,
 * without seeing or synthesizing future outcomes.
 */
const ZERO=rational(0),TWO=rational(2);
const fail=message=>{throw Error(message);};
const valid=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
const same=(a,b)=>cmp(a[0],b[0])===0&&cmp(a[1],b[1])===0;
const cross=(o,a,b)=>sub(mul(sub(a[0],o[0]),sub(b[1],o[1])),
  mul(sub(a[1],o[1]),sub(b[0],o[0])));
function hull(points){
 const sorted=[...points].sort((a,b)=>cmp(a[0],b[0])||cmp(a[1],b[1]));
 const unique=sorted.filter((p,i)=>!i||!same(p,sorted[i-1]));
 if(unique.length<=2)return unique;
 const half=seq=>{
  const out=[];
  for(const p of seq){
   while(out.length>=2&&cmp(cross(out.at(-2),out.at(-1),p),ZERO)<=0)out.pop();
   out.push(p);
  }
  return out.slice(0,-1);
 };
 return [...half(unique),...half([...unique].reverse())];
}
function extent(polygon,axis){
 if(!polygon.length)fail('No feasible difference polygon remains.');
 let low=polygon[0][axis],high=low;
 for(const p of polygon){
  if(cmp(p[axis],low)<0)low=p[axis];
  if(cmp(p[axis],high)>0)high=p[axis];
 }
 return cmp(neg(low),high)>0?
  {width:neg(low),witness:polygon.find(p=>cmp(p[axis],low)===0)}:
  {width:high,witness:polygon.find(p=>cmp(p[axis],high)===0)};
}
const ratio=(width,base)=>cmp(base,ZERO)>0?div(width,base):ZERO;
const max=(a,b)=>cmp(a,b)>0?a:b;
const upper=x=>enclosure(x).upper;
const approximate=x=>{const p=enclosure(x);return p.lower+(p.upper-p.lower)/2;};
const displayPolygon=p=>p.map(pair=>pair.map(approximate));
function offersChecked(offers){
 if(!Array.isArray(offers)||offers.length<2||offers.length>16)
  fail('Offer 2–16 candidate future states with declared noise radii and costs.');
 const ids=new Set(),points=new Set();
 return offers.map(p=>{
  if(!p||typeof p.id!=='string'||!/^[A-Za-z0-9_-]{1,48}$/.test(p.id)||ids.has(p.id))
   fail('Offer IDs must be unique short safe identifiers.');
  ids.add(p.id);
  if(!valid(p.rate,-1e6,1e6)||!valid(p.position,-1e6,1e6)||
    !valid(p.radius,0,1000)||!valid(p.cost,0,1e6))
   fail('Each offer requires finite bounded rate, angle, future noise radius, and cost.');
  const key=JSON.stringify([p.rate,p.position]);
  if(points.has(key))fail('Offered rate and angle states must be distinct.');
  points.add(key);
  return {id:p.id,rate:p.rate,position:p.position,radius:p.radius,cost:p.cost,
   feature:[rational(p.rate),rational(Math.sin(p.position))]};
 });
}
function scoreCourse(difference,sequence,baseline,work){
 let polygon=difference;
 for(const row of sequence){
  const bound=mul(TWO,rational(row.radius));
  polygon=clip(polygon,row.feature[0],row.feature[1],bound,work);
  polygon=clip(polygon,neg(row.feature[0]),neg(row.feature[1]),bound,work);
 }
 const widths=[extent(polygon,0),extent(polygon,1)];
 const fractions=widths.map((w,i)=>ratio(w.width,baseline[i].width));
 return {polygon,widths,fractions,worst:max(fractions[0],fractions[1]),sum:add(fractions[0],fractions[1])};
}
function compare(a,b){
 if(!b)return -1;
 return cmp(a.worst,b.worst)||cmp(a.sum,b.sum)||
  (a.cost<b.cost?-1:a.cost>b.cost?1:0)||
  a.ids.length-b.ids.length||a.ids.join('|').localeCompare(b.ids.join('|'));
}
/** Exact worst-case future diameter design, not a structural identification. */
export function planRateSineMinimax(readouts,offers,{budget=2,maxReadings=2}={}){
 if(!valid(budget,0,2e6)||![1,2].includes(maxReadings))
  fail('Declare a finite budget and one or two future readings.');
 const states=offersChecked(offers),prior=coefficientBounds(readouts);
 const assumptions='One shared rate+sine law, binary64 sine features, bounded deterministic reading errors and user-declared feasible costs. No future outcome is used. No probability, sensor fidelity, physical safety, structural absence or mechanism identity is established.';
 if(prior.status==='inconsistent')return {schema:'worldlaw.rate-sine-minimax/v1',status:'inconsistent',selected:null,courses:[],assumptions};
 const polygon=prior.vertices.map(p=>p.map(v=>[BigInt(v.numerator),BigInt(v.denominator)]));
 const difference=hull(polygon.flatMap(a=>polygon.map(b=>[sub(a[0],b[0]),sub(a[1],b[1])])));
 const baseline=[extent(difference,0),extent(difference,1)],work={count:0,limit:200000};
 const candidates=[];let best=null;
 function inspect(sequence){
  const cost=sequence.reduce((s,x)=>s+x.cost,0);
  if(cost>budget)return;
  const candidate={ids:sequence.map(s=>s.id),cost,...scoreCourse(difference,sequence,baseline,work)};
  candidates.push(candidate);
  if(compare(candidate,best)<0)best=candidate;
 }
 states.forEach(p=>inspect([p]));
 if(maxReadings===2)for(let i=0;i<states.length;i++)
  for(let j=i+1;j<states.length;j++)inspect([states[i],states[j]]);
 const show=c=>({offers:c.ids,cost:c.cost,worstFraction:upper(c.worst),
  sumFraction:upper(c.sum),rateWidth:upper(c.widths[0].width),
  sineWidth:upper(c.widths[1].width),widthRatios:c.fractions.map(upper),
  exactWorstFraction:serial(c.worst),
  witnessDifferences:c.widths.map(w=>w.witness.map(serial))});
 return {schema:'worldlaw.rate-sine-minimax/v1',
  status:best?'computed':'no-affordable-course',selected:best?show(best):null,
  courses:candidates.map(show),originalWidths:baseline.map(w=>upper(w.width)),
  originalBounds:{rate:prior.rate.outward,restoring:prior.restoring.outward},
  differenceGeometry:{current:displayPolygon(difference),projectedFuture:best?displayPolygon(best.polygon):null,axisLabels:['Δ rate-law coefficient','Δ sine-law coefficient'],meaning:'Difference of two mechanisms jointly consistent with the original readouts; future silhouette preserves differences that some common bounded-noise future outcomes cannot separate.'},
  source:{readouts:readouts.map(x=>({...x})),offers:states.map(({feature,...p})=>p),budget,maxReadings},
  structuralExclusionGuaranteed:false,
  exactArithmetic:'Exact rational half-plane clipping of the Minkowski difference of the feasible coefficient polygon.',
  work:{constraintVertices:work.count,candidateCourses:candidates.length},assumptions};
}
