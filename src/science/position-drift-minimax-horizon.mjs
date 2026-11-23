/** Binary robust horizon bounds for families of persistent convex rate mixtures. */
import {ACTIVE_LINEAR_EXACT_ARITHMETIC} from './active-linear-family.mjs';
import {parseAllHorizonRational as rational,planBinaryPositionDriftMinimum,openBinaryPositionDriftMinimum} from './persistent-position-drift-all-horizon.mjs';
import {CATALOG_SCHEMA,equalPositionDriftData} from './persistent-position-drift-planner.mjs';
import {feedbackGCD,intersectFeedbackHalfspaces} from './exact-feedback-feasibility.mjs';
import {openRateAlias} from './position-drift-rate-segments.mjs';
import {parseRatePolytopeSource,primitiveRateInequality as exactRow,mixRateRows,rateWorkBudget,RATE_WORK_EXHAUSTED,observeRatePolytopeSchedule} from './position-drift-rate-polytopes.mjs';
const {Q,Z,add,sub,mul,div,fmt}=ACTIVE_LINEAR_EXACT_ARITHMETIC;
const one=Q(1n),neg=x=>sub(Z(),x),sum=xs=>xs.reduce(add,Z()),dot=(a,b)=>sum(a.map((v,i)=>mul(v,b[i])));
const cmp=(a,b)=>a.n*b.d<b.n*a.d?-1:a.n*b.d>b.n*a.d?1:0;
function need(ok,reason){if(!ok)throw Error('Binary rate-family horizon: '+reason);}
export const MINIMAX_SOURCE='worldlaw.position-drift-minimax-source/v1';
export const MINIMAX_PLAN='worldlaw.position-drift-minimax-policy/v1';
function findEquilibrium(A,B,spend){
 const m=A[0].length,sizes=[A.length,B.length,m,m],offsets=[];let next=0;
 for(const size of sizes){offsets.push(next);next+=size-1;}
 const g=next,width=g+1,rows=[];
 const zeros=()=>Array.from({length:width},Z);
 function row(a,b){spend();rows.push(exactRow(a,b));}
 function affine(a,group,values,sign){
   const last=values.at(-1),offset=offsets[group];
   values.slice(0,-1).forEach((v,i)=>{a[offset+i]=add(a[offset+i],mul(sign,sub(v,last)));});
   return mul(sign,last);
 }
 for(const [group,size] of sizes.entries()){if(size<=1)continue;const total=zeros();
   for(let i=0;i<size-1;i++){const a=zeros(),idx=offsets[group]+i;a[idx]=neg(one);row(a,Z());total[idx]=one;}
   row(total,one);
 }
 // Mixture of nature's pure families giving range at most g.
 for(let u=0;u<m;u++)for(let v=0;v<m;v++){if(u===v)continue;const a=zeros();a[g]=neg(one);
   const constant=add(affine(a,0,A.map(r=>sub(r[u],r[v])),one),affine(a,1,B.map(r=>sub(r[u],r[v])),neg(one)));
   row(a,neg(constant));
 }
 // Experimental action distributions achieving at least g against all endpoint pairs.
 for(const aa of A)for(const bb of B){const diff=aa.map((x,i)=>sub(x,bb[i])),a=zeros();a[g]=one;
   const constant=add(affine(a,2,diff,neg(one)),affine(a,3,diff,one));row(a,neg(constant));
 }
 const fit=intersectFeedbackHalfspaces(rows,width,spend);need(fit.point,'equilibrium infeasible');
 const groups=sizes.map((size,k)=>{const xs=fit.point.slice(offsets[k],offsets[k]+size-1);return [...xs,sub(one,sum(xs))];});
 return {gap:fit.point[g],groups};
}

function checkedGame(vertices,e,spend){
  const [left,right,P,Qdist]=e.groups,g=e.gap;
  for(const group of e.groups)need(group.every(x=>x.n>=0n)&&cmp(sum(group),one)===0,'invalid simplex witness');
  const rates=[mixRateRows(vertices[0],left),mixRateRows(vertices[1],right)];
  const d=rates[0].map((x,i)=>sub(x,rates[1][i])).sort(cmp);
  need(cmp(sub(d.at(-1),d[0]),g)===0,'primal rate range differs from claimed minimax gap');
  const weights=P.map((x,i)=>sub(x,Qdist[i]));
  const bands=vertices.map(rows=>{
    const values=rows.map(r=>{spend();return dot(weights,r);}).sort(cmp);
    return [values[0],values.at(-1)];
  });
  need(cmp(sub(bands[0][0],bands[1][1]),g)===0,'dual worst vertex gap differs from primal range');
  return {rates,bands};
}
const lcm=(a,b)=>a/feedbackGCD(a,b)*b;
const modulo=(a,m)=>(a%m+m)%m;
function inverse(a,m){
  let x=a,y=m,u=1n,v=0n;
  while(y){const q=x/y;[x,y]=[y,x%y];[u,v]=[v,u-q*v];}
  need(x===1n,'reduced congruence is not coprime');return modulo(u,m);
}
function blockLengths(P,Qdist,lower,gap,error){
  const [a,b]=[P,Qdist].map(row=>row.reduce((d,x)=>lcm(d,x.d),1n));
  const round=(n,d)=>((n+d-1n)/d)*d;
  const candidates=[],left=lower/2n,right=lower-left;
  function consider(x,y){
    if(x<=0n||y<=0n||x%a||y%b)return;
    const departure=mul(gap,Q(x*y,x+y));
    if(cmp(departure,mul(Q(4n),error))>0)candidates.push({x,y,departure});
  }
  consider(round(left,a),round(right,b));consider(round(right,a),round(left,b));
  // At the causal lower horizon search the entire congruence class: the
  // largest x*(N−x) lies nearest N/2, including non-balanced integer splits.
  const gcd=feedbackGCD(a,b);
  if(lower%gcd===0n){
    const m=b/gcd,period=a*m,first=m===1n?0n:a*modulo((lower/gcd)*inverse(a/gcd,m),m);
    const center=(lower/2n-first)/period;
    for(const shift of [-1n,0n,1n]){const x=first+(center+shift)*period;consider(x,lower-x);}
  }
  need(candidates.length,'rounded blocks cannot realize the uniform separation');
  return candidates.reduce((best,r)=>r.x+r.y<best.x+best.y||(r.x+r.y===best.x+best.y&&cmp(r.departure,best.departure)>0)?r:best);
}
function compressedCommands(commands,weights,n){
  return weights.flatMap((w,k)=>{
    const amount=mul(Q(n),w);need(amount.d===1n,'a fractional repeat reached the schedule');
    return amount.n?[{command:commands[k],repeats:fmt(amount)}]:[];
  });
}
function binarySource(cat,rates){
  return {schema:CATALOG_SCHEMA,commands:cat.commands.slice(),noiseBound:fmt(cat.error),
    laws:cat.ids.map((id,i)=>({id,rates:rates[i].map(fmt)}))};
}
export function planMinimaxHorizon(request){
  need(request?.schema===MINIMAX_SOURCE&&Object.keys(request).sort().join(',')==='catalog,schema','supply one binary rate-polytope catalog');
  const source=request.catalog,cat=parseRatePolytopeSource(source);
  need(cat.ids.length===2,'the minimax horizon comparison requires exactly two families');
  const canonical={schema:source.schema,commands:cat.commands.slice(),noiseBound:fmt(cat.error),limits:{...source.limits},
    laws:cat.ids.map((id,i)=>({id,vertices:cat.vertices[i].map(row=>row.map(fmt))}))};
  const base={schema:MINIMAX_PLAN,source:canonical},work=rateWorkBudget(source.limits.designWork);
  let e,verified;
  try{e=findEquilibrium(...cat.vertices,work.spend);verified=checkedGame(cat.vertices,e,work.spend);}
  catch(err){if(err!==RATE_WORK_EXHAUSTED)throw err;return {...base,status:'design-budget-exhausted',work:work.used};}
  const parameters=e.groups.slice(0,2).map(r=>r.map(fmt)),distributions=e.groups.slice(2).map(r=>r.map(fmt));
  const common={...base,work:work.used,equilibrium:{gap:fmt(e.gap),parameters,commandDistributions:distributions,
    hardestRates:verified.rates.map(r=>r.map(fmt)),unitResponseBands:verified.bands.map(r=>r.map(fmt))}};
  if(!e.gap.n)return {...common,status:'indistinguishable',aliases:[{laws:cat.ids.slice(),parameters,
    driftShift:fmt(sub(verified.rates[0][0],verified.rates[1][0]))}]};
  const hard=binarySource(cat,verified.rates),binary=planBinaryPositionDriftMinimum(hard),lower=BigInt(binary.minimumPulses);
  const {x,y,departure}=blockLengths(...e.groups.slice(2),lower,e.gap,cat.error);
  const blocks=[compressedCommands(cat.commands,e.groups[2],x),compressedCommands(cat.commands,e.groups[3],y)];
  const runs=blocks.flat(),readAt=['0'];let tick=0n;
  for(const r of runs){tick+=BigInt(r.repeats);readAt.push(String(tick));}
  const scale=Q(x*y,x+y),radius=mul(Q(2n),cat.error);
  const intervals=verified.bands.map(([lo,hi])=>[fmt(sub(mul(scale,lo),radius)),fmt(add(mul(scale,hi),radius))]);
  return {...common,status:tick===lower?'minimum-certified':'horizon-bounded',
    adaptiveLower:String(lower),pulseUpperBound:String(tick),previousDistance:binary.previousDistance,
    runs,readAt,blockLengths:[String(x),String(y)],certificateTicks:['0',String(x),String(tick)],
    chordIntervals:intervals,chordSeparation:fmt(departure),noiseRadius:fmt(radius),margin:fmt(sub(departure,add(radius,radius)))};
}
export function openMinimaxHorizon(request,policy){
  const p=planMinimaxHorizon(request);need(equalPositionDriftData(p,policy),'saved minimax plan differs from source');
  const cat=parseRatePolytopeSource(p.source);
  if(p.status==='indistinguishable')return openRateAlias(p,cat.commands,(id,weights)=>mixRateRows(cat.vertices[cat.ids.indexOf(id)],weights.map(rational)));
  need(p.status!=='design-budget-exhausted','the design work limit left the horizon open');
  const hard=binarySource(cat,p.equilibrium.hardestRates.map(r=>r.map(rational)));
  const lower=openBinaryPositionDriftMinimum(hard,planBinaryPositionDriftMinimum(hard));
  const observe=values=>observeRatePolytopeSchedule(p,values);
  return {observe,midpointAdversary:lower.midpointAdversary,replay:record=>{
    const actual=observe(record.readings);need(equalPositionDriftData(actual,record),'saved minimax observations changed');return actual;
  }};
}
