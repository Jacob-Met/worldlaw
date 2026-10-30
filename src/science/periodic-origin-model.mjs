// Immutable original-coordinate preparation; bounded14-term displacement series.
import{prepareTorquePredictor}from'./torque-discovery.mjs';
import{productPair}from'./split-column.mjs';
import{add,mul,neg,trigPair}from'./periodic-trig.mjs';
const ids=['gravity','cosine','spring','rate','command','bias'],finite=(v,b)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=b;
const div=(a,n)=>{const q=a[0]/n,r=add(a,neg(productPair(q,n)));return add([q,0],[(r[0]+r[1])/n,0]);};
function deltaTrig(x){const r=[x,0],rr=neg(mul(r,r));let st=r,ct=[1,0],sin=r,cosMinusOne=[0,0];for(let n=1;n<=14;n++){st=div(mul(st,rr),2*n*(2*n+1));ct=div(mul(ct,rr),(2*n-1)*2*n);sin=add(sin,st);cosMinusOne=add(cosMinusOne,ct);}return{sin,cos:add([1,0],cosMinusOne),cosMinusOne};}
export function preparePeriodicOrigin(model,anchor){
 if(!['worldlaw.torque-model/v1','worldlaw.split-torque-experiment/v1'].includes(model?.schema))throw Error('Supported original response schema required');
 const original=structuredClone(model),ordinary=prepareTorquePredictor(original),entries=original.schema==='worldlaw.torque-model/v1'?original.terms.map(t=>[t.id,[t.coefficient,0]]):original.terms.map((t,i)=>[typeof t==='string'?t:t.id,original.fit.pairs[i]]);
 if(!finite(anchor,1e6)||!entries.length||entries.some(([id,p])=>!ids.includes(id)||!Array.isArray(p)||p.length!==2||!p.every(v=>finite(v,1e8))))throw Error('Bounded original periodic/affine terms required');
 const terms=new Map(entries),coef=id=>terms.get(id)??[0,0],a=trigPair(anchor),A=add(mul(coef('gravity'),a.cos),neg(mul(coef('cosine'),a.sin))),B=add(mul(coef('gravity'),a.sin),mul(coef('cosine'),a.cos)),base=add(B,coef('bias'));
 return(command,delta,rate,reading)=>{
  if(!finite(command,1e6)||!finite(delta,1)||!finite(rate,1e6)||reading!==undefined&&!finite(reading,1e18))throw Error('Bounded original coordinates and response required');
  const position=add([anchor,0],[delta,0]);if(position[0]>1e6||position[0]<-1e6||position[0]===1e6&&position[1]>0||position[0]===-1e6&&position[1]<0)throw Error('Retained original position exceeds bounds');
  const d=deltaTrig(delta),periodic=add(base,add(mul(A,d.sin),mul(B,d.cosMinusOne))),affine=add(add(mul(coef('spring'),[anchor,delta]),mul(coef('command'),[command,0])),mul(coef('rate'),[rate,0])),response=add(periodic,affine),derivative=add(add(mul(A,d.cos),neg(mul(B,d.sin))),coef('spring')),roundedPosition=anchor+delta,roundedPrediction=ordinary(command,roundedPosition,rate);
  return{positionOrigin:anchor,positionDelta:delta,roundedPosition,response,derivative,roundedPrediction,...(reading===undefined?{}:{residual:add([reading,0],neg(response)),roundedResidual:reading-roundedPrediction})};
 };
}
