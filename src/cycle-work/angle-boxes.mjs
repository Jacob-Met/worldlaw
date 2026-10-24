import {normalizeCycle,evaluateCycle,CycleWorkError} from './core.mjs';
export const ANGLE_BOX_SCHEMA='worldlaw.cycle-angle-boxes/v1';
export const ANGLE_BOX_ASSUMPTION='independent-row-boxes-with-shared-first-last-angle';
const check=(ok,message)=>{if(!ok)throw new CycleWorkError(message);};
const zero={n:0n,e:0};
function dyadic(value){
 if(value===0)return zero;
 const view=new DataView(new ArrayBuffer(8));view.setFloat64(0,value);
 const bits=view.getBigUint64(0),exp=Number((bits>>52n)&2047n);
 let n=(bits&((1n<<52n)-1n))|(exp?1n<<52n:0n),e=exp?exp-1075:-1074;
 while((n&1n)===0n){n>>=1n;e++;}
 return {n:bits>>63n?-n:n,e};
}
const pack=(n,e)=>({integer:n.toString(),powerOfTwo:e});
const integerAt=(d,e)=>d.n<<BigInt(d.e-e);
export function displayExact(value){
 const n=BigInt(value.integer);if(n===0n)return '0';
 const a=n<0n?-n:n,bits=a.toString(2).length,shift=Math.max(0,bits-53);
 const top=Number(a>>BigInt(shift)),approx=top*2**(value.powerOfTwo+shift),sign=n<0n?'-':'';
 return Number.isFinite(approx)&&approx!==0?sign+approx.toPrecision(8):sign+(top/2**(bits-shift-1)).toPrecision(8)+' × 2^'+(value.powerOfTwo+bits-1);
}
export function normalizeAngleBoxes(raw){
 check(raw?.schema===ANGLE_BOX_SCHEMA,'Expected '+ANGLE_BOX_SCHEMA+'.');
 check(raw.assumption===ANGLE_BOX_ASSUMPTION,'Declare independent row boxes and one shared first/last return angle.');
 const cycle=normalizeCycle(raw.cycle);
 check(Array.isArray(raw.positionRadii)&&raw.positionRadii.length===cycle.samples.length,'Supply an angular radius for every original acquisition row.');
 const positionRadii=raw.positionRadii.map((r,i)=>{
  check(typeof r==='number'&&Number.isFinite(r)&&r>=0&&r<=1e6,'Angular radius '+i+' must be finite, nonnegative and at most 1e6 rad.');return r;
 });
 check(positionRadii[0]===positionRadii.at(-1),'The shared first/last angle requires identical endpoint radii.');
 check(typeof raw.radiusSource==='string'&&raw.radiusSource.trim().length>0&&raw.radiusSource.length<=2000,'Declare the source/basis of the angular radii.');
 return {schema:ANGLE_BOX_SCHEMA,assumption:ANGLE_BOX_ASSUMPTION,radiusSource:raw.radiusSource.trim(),cycle,positionRadii};
}
function prepare(bundle){
 const rows=bundle.cycle.samples;
 const angles=rows.map((r,i)=>[dyadic(r.position),dyadic(bundle.positionRadii[i])]);
 const torques=rows.map(r=>[dyadic(r.jointTorque),dyadic(r.torqueRadius)]);
 const exponent=items=>Math.min(0,...items.flat().filter(d=>d.n!==0n).map(d=>d.e));
 const angleExponent=exponent(angles),torqueExponent=exponent(torques);
 const endpoints=(pair,e)=>{const c=integerAt(pair[0],e),r=integerAt(pair[1],e);return [c-r,c+r];};
 const x=angles.map(p=>endpoints(p,angleExponent)),y=torques.map(p=>endpoints(p,torqueExponent));
 return {x,y,angleExponent,torqueExponent,workExponent:angleExponent+torqueExponent-1};
}
const edge=(data,row,from,to)=>(data.x[row][to>>1]-data.x[row-1][from>>1])*(data.y[row][to&1]+data.y[row-1][from&1]);
function exactPath(data,corners){let sum=0n;for(let i=1;i<corners.length;i++)sum+=edge(data,i,corners[i-1],corners[i]);return sum;}
function validateCorners(corners,length){
 check(Array.isArray(corners)&&corners.length===length&&corners.every(c=>Number.isInteger(c)&&c>=0&&c<4),'Witness must retain one angle/torque endpoint flag per acquisition row.');
 check((corners[0]>>1)===(corners.at(-1)>>1),'Witness violates the shared return angle.');
}
/** Reevaluate flags with exact center ± radius endpoints; never parse displayed decimals. */
export function evaluateAngleBoxWitness(raw,corners){
 const bundle=normalizeAngleBoxes(raw);validateCorners(corners,bundle.cycle.samples.length);
 const data=prepare(bundle);return pack(exactPath(data,corners),data.workExponent);
}
export function angleBoxWitnessRow(raw,corners,index){
 const bundle=normalizeAngleBoxes(raw);validateCorners(corners,bundle.cycle.samples.length);
 check(Number.isInteger(index)&&index>=0&&index<corners.length,'Choose an original witness row.');
 const data=prepare(bundle),state=corners[index];
 return {row:index,angleEndpoint:state>>1?'upper':'lower',torqueEndpoint:state&1?'upper':'lower',position:pack(data.x[index][state>>1],data.angleExponent),jointTorque:pack(data.y[index][state&1],data.torqueExponent)};
}
/** Four endpoint states per row, four frozen initial states, exact chain extrema. */
export function analyzeAngleBoxes(raw){
 const bundle=normalizeAngleBoxes(raw),data=prepare(bundle),count=data.x.length;
 let lower=Array(16).fill(null),upper=Array(16).fill(null);
 for(let initial=0;initial<4;initial++)lower[initial*4+initial]=upper[initial*4+initial]=0n;
 const lowPrevious=new Uint8Array(count*16),highPrevious=new Uint8Array(count*16);
 for(let row=1;row<count;row++){
  const edges=Array.from({length:16},(_,i)=>edge(data,row,i>>2,i&3));
  const nextLow=Array(16).fill(null),nextHigh=Array(16).fill(null);
  for(let initial=0;initial<4;initial++)for(let to=0;to<4;to++){
   if(row===count-1&&(to>>1)!==(initial>>1))continue;
   const out=initial*4+to;
   for(let from=0;from<4;from++){
    const at=initial*4+from;if(lower[at]===null)continue;
    const e=edges[from*4+to],lo=lower[at]+e,hi=upper[at]+e;
    if(nextLow[out]===null||lo<nextLow[out]){nextLow[out]=lo;lowPrevious[row*16+out]=from;}
    if(nextHigh[out]===null||hi>nextHigh[out]){nextHigh[out]=hi;highPrevious[row*16+out]=from;}
   }
  }
  lower=nextLow;upper=nextHigh;
 }
 let minIndex=-1,maxIndex=-1;
 for(let i=0;i<16;i++)if(lower[i]!==null){if(minIndex<0||lower[i]<lower[minIndex])minIndex=i;if(maxIndex<0||upper[i]>upper[maxIndex])maxIndex=i;}
 const reconstruct=(index,previous)=>{const initial=index>>2,corners=Array(count);let state=index&3;for(let row=count-1;row>=0;row--){corners[row]=state;if(row)state=previous[row*16+initial*4+state];}return corners;};
 const minimum={corners:reconstruct(minIndex,lowPrevious),work:pack(lower[minIndex],data.workExponent)};
 const maximum={corners:reconstruct(maxIndex,highPrevious),work:pack(upper[maxIndex],data.workExponent)};
 check(exactPath(data,minimum.corners)===lower[minIndex]&&exactPath(data,maximum.corners)===upper[maxIndex],'Internal witness reevaluation failed.');
 const allowance=dyadic(bundle.cycle.integrationAllowance),e=Math.min(data.workExponent,allowance.e);
 const min=integerAt({n:lower[minIndex],e:data.workExponent},e)-integerAt(allowance,e);
 const max=integerAt({n:upper[maxIndex],e:data.workExponent},e)+integerAt(allowance,e);
 return {bundle,nominal:evaluateCycle(bundle.cycle),minimum,maximum,interval:[pack(min,e),pack(max,e)],integrationAllowance:pack(allowance.n,allowance.e),
  conclusion:min>0n?'positive-work':max<0n?'negative-work':'zero-compatible',
  operations:{rows:count,edgeEvaluations:16*(count-1),stateTransitions:64*(count-1)},
  scope:'Exact extrema of the ordered polygon over the declared independent angle/torque boxes, with one shared first/last angle. Interior repeated nominal angles remain independent. Witnesses are mathematical endpoint assignments, not acquired readings. The retained integration allowance expands the work interval separately; no uncertainty is supplied to exact-angle curvature refinement.'};
}
export function importAngleBoxes(text){
 check(typeof text==='string'&&new TextEncoder().encode(text).byteLength<=2000000,'Angle-box inputs must be at most 2 MB of UTF-8.');
 return normalizeAngleBoxes(JSON.parse(text));
}
export const exportAngleBoxes=raw=>JSON.stringify(normalizeAngleBoxes(raw),null,2);
