/** Internal exact course check. Call only with freshly prepared owned source/bounds.
 * This is not a wire-format reader or an alternative public confinement API. */
import {rational,add,sub,mul,div,cmp,serial} from '../unknown-lab/chronos-exact-halfplanes.mjs';
const HARD_LIMIT=140000,MAX_BITS=4096;
const insist=(ok,message)=>{if(!ok)throw Error(message);};
function integer(text){
 insist(typeof text==='string'&&text.length>0&&text.length<=1250&&/^-?(?:0|[1-9]\d*)$/.test(text),'Bounded exact integer required');
 const n=BigInt(text);insist((n<0n?-n:n).toString(2).length<=MAX_BITS,'Exact integer capacity exceeded');return n;
}
export function compareOwnedEnergyCourse(initial,positionRaw,rateRaw,rows,{workLimit=HARD_LIMIT}={}){
 insist(Array.isArray(rows)&&rows.length>=2&&rows.length<=4096,'Complete original reading population required');
 const entries=rows.length+1,reservation=34*entries+16;
 insist(Number.isSafeInteger(workLimit)&&workLimit>=reservation&&workLimit<=HARD_LIMIT,'Complete course work reservation refused');
 let operations=0;
 const Q=x=>{operations++;return rational(x);},A=(a,b)=>{operations++;return add(a,b);},S=(a,b)=>{operations++;return sub(a,b);},M=(a,b)=>{operations++;return mul(a,b);},C=(a,b)=>{operations++;return cmp(a,b);};
 const decode=x=>{insist(x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===2&&Object.hasOwn(x,'numerator')&&Object.hasOwn(x,'denominator'),'Exact endpoint fields required');const n=integer(x.numerator),d=integer(x.denominator);insist(d>0n,'Positive exact denominator required');operations++;return div([n,1n],[d,1n]);};
 const pair=value=>{insist(Array.isArray(value)&&value.length===2,'Exactly two endpoints required');const out=value.map(decode);insist(C(out[0],out[1])<=0,'Ordered interval required');return out;};
 insist(Array.isArray(positionRaw)&&positionRaw.length===2&&Array.isArray(rateRaw)&&rateRaw.length===2,'Exactly two raw bound endpoints required');
 const dyadic=value=>({numerator:value,denominator:String(1n<<80n)});
 const [L,U]=pair(positionRaw.map(dyadic)),[vlow,V]=pair(rateRaw.map(dyadic));
 insist(C(V,Q(0))>=0&&C(vlow,[-V[0],V[1]])===0,'Symmetric nonnegative certified speed required');
 const start=pair(initial);insist(C(start[0],L)>=0&&C(start[1],U)<=0,'Starting box must lie inside certified position bounds');
 // Admit complete internal data before producing any partial result. The public
 // caller has already normalized original rows; repeat identity/time checks here.
 const admitted=rows.map((row,index)=>{insist(row&&row.index===index&&typeof row.time==='number'&&Number.isFinite(row.time)&&typeof row.position==='number'&&Number.isFinite(row.position),'Original row identity/time/angle required');const interval=pair(row.interval),time=Q(row.time);if(index)insist(row.time>rows[index-1].time,'Original times must strictly increase');return {kind:'original-reading',index,time:row.time,t:time,position:row.position,interval};});
 admitted.unshift({kind:'original-initial-box',index:null,time:rows[0].time,t:admitted[0].t,interval:start});
 let low=null,high=null,lowerSource=null,upperSource=null,first=null;const accounts=[];
 for(const e of admitted){
  const vt=M(V,e.t),lo=C(e.interval[0],L)<0?L:e.interval[0],hi=C(e.interval[1],U)>0?U:e.interval[1];
  const source={kind:e.kind,index:e.index,time:e.time,...(e.position===undefined?{}:{position:e.position}),interval:e.interval.map(serial),clipped:[serial(lo),serial(hi)]};
  if(C(lo,hi)>0&&!first)first={kind:'position-limit',source};
  const incomingLow=low===null?lo:S(low,vt),incomingHigh=high===null?hi:A(high,vt);
  if(C(lo,incomingHigh)>0&&!first)first=certificate(upperSource,source,'increasing');
  if(C(incomingLow,hi)>0&&!first)first=certificate(lowerSource,source,'decreasing');
  accounts.push({kind:e.kind,index:e.index,time:e.time,prefixCompatible:first===null});
  const nextLow=A(lo,vt),nextHigh=S(hi,vt);
  if(low===null||C(nextLow,low)>0){low=nextLow;lowerSource=source;}
  if(high===null||C(nextHigh,high)<0){high=nextHigh;upperSource=source;}
 }
 function certificate(earlier,later,direction){
  const a=earlier.clipped.map(decode),b=later.clipped.map(decode),dt=S(Q(later.time),Q(earlier.time)),allowed=M(V,dt),distance=direction==='increasing'?S(b[0],a[1]):S(a[0],b[1]),gap=S(distance,allowed);
  insist(C(dt,Q(0))>=0&&C(gap,Q(0))>0,'Exact original witness replay failed');
  return {kind:'speed-limit',earlier,later,direction,speed:serial(V),elapsed:serial(dt),allowedTravel:serial(allowed),requiredTravel:serial(distance),gap:serial(gap)};
 }
 insist(operations<=reservation,'Course work accounting exceeded reservation');
 return {status:first?'conjunction_rejected':'inconclusive',first,rows:accounts,work:{originalRows:rows.length,entries,reservation,operations,hardLimit:HARD_LIMIT,scope:'Rational arithmetic/comparison calls only; bounded decoding, BigInt cost and upstream invariant preparation are separate.'},boundary:'Necessary bounded-speed course condition only. Survival does not establish an ODE trajectory, phase, sensor accuracy or physical validity.'};
}
