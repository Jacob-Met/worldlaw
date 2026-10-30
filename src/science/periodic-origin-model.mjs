// Explicit retained-coordinate research evaluator, using original model admission.
import{prepareTorquePredictor}from'./torque-discovery.mjs';
import{add,mul,neg,retainedPeriodic}from'./periodic-trig.mjs';
const ids=['gravity','cosine','spring','rate','command','bias'];
const finite=(v,b)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=b;
export function preparePeriodicOrigin(model,anchor){
 if(!['worldlaw.torque-model/v1','worldlaw.split-torque-experiment/v1'].includes(model?.schema))throw Error('Supported original response schema required');
 const original=structuredClone(model);const ordinary=prepareTorquePredictor(original);
 const entries=original.schema==='worldlaw.torque-model/v1'?original.terms.map(t=>[t.id,[t.coefficient,0]]):original.schema==='worldlaw.split-torque-experiment/v1'?original.terms.map((t,i)=>[typeof t==='string'?t:t.id,original.fit.pairs[i]]):[];
 if(!finite(anchor,1e6)||!entries.length||entries.some(([id,p])=>!ids.includes(id)||!Array.isArray(p)||p.length!==2||!p.every(v=>finite(v,1e8))))throw Error('Bounded original periodic/affine terms required');
 const terms=new Map(entries);const coefficient=id=>terms.get(id)??[0,0];
 return (command,delta,rate,reading)=>{
  if(!finite(command,1e6)||!finite(delta,1)||!finite(rate,1e6)||Math.abs(anchor+delta)>1e6||reading!==undefined&&!finite(reading,1e18))throw Error('Bounded original coordinates and response required');
  const position=add([anchor,0],[delta,0]);
  if(position[0]>1e6||position[0]<-1e6||position[0]===1e6&&position[1]>0||position[0]===-1e6&&position[1]<0)throw Error('Retained original position exceeds bounds');
  const hi=retainedPeriodic(anchor,delta,coefficient('gravity')[0],coefficient('cosine')[0],coefficient('bias')[0]),lo=retainedPeriodic(anchor,delta,coefficient('gravity')[1],coefficient('cosine')[1],coefficient('bias')[1]);
  const periodic={value:add(hi.value,lo.value),derivative:add(hi.derivative,lo.derivative)};
  const affine=add(add(mul(coefficient('spring'),[anchor,delta]),mul(coefficient('command'),[command,0])),mul(coefficient('rate'),[rate,0]));
  const response=add(periodic.value,affine),derivative=add(periodic.derivative,coefficient('spring'));
  const roundedPosition=anchor+delta,roundedPrediction=ordinary(command,roundedPosition,rate);
  return {positionOrigin:anchor,positionDelta:delta,roundedPosition,response,derivative,roundedPrediction,...(reading===undefined?{}:{residual:add([reading,0],neg(response)),roundedResidual:reading-roundedPrediction})};
 };
}
