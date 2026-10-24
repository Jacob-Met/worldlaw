import {evaluate} from './torque-discovery.mjs';
const buffer=new ArrayBuffer(8),view=new DataView(buffer);
function adjacent(x,up){
 if(!Number.isFinite(x))throw new RangeError('Nonfinite enclosure arithmetic');
 if(x===0)return up?Number.MIN_VALUE:-Number.MIN_VALUE;
 view.setFloat64(0,x);let bits=view.getBigUint64(0);bits+=(x>0)===up?1n:-1n;view.setBigUint64(0,bits);return view.getFloat64(0);
}
const down=x=>adjacent(x,false),up=x=>adjacent(x,true);
const validRadius=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1e6;
function options(radii){
 if(!radii||!['command','position','rate','jointTorque'].every(k=>validRadius(radii[k])))throw new RangeError('Declare four finite nonnegative SI radii, each at most one million');
 return Object.fromEntries(['command','position','rate','jointTorque'].map(k=>[k,radii[k]]));
}
function box(value,radius){if(radius===0)return[value,value];const l=value-radius,h=value+radius;return[l===0?0:down(l),h===0?0:up(h)];}
function featureRange(id,[lo,hi]){
 if(id==='coulomb')return[Math.sign(lo),Math.sign(hi)];
 if(id==='gravity'){
  // Explicit engineering allowance, not a formally certified transcendental interval.
  const slack=64*Number.EPSILON*(1+Math.max(Math.abs(lo),Math.abs(hi)));
  const l=down(lo-slack),h=up(hi+slack);
  if(h-l>=2*Math.PI)return[-1,1];
  let a=Math.min(Math.sin(l),Math.sin(h)),b=Math.max(Math.sin(l),Math.sin(h));
  if(Math.ceil((l-Math.PI/2)/(2*Math.PI))<=Math.floor((h-Math.PI/2)/(2*Math.PI)))b=1;
  if(Math.ceil((l+Math.PI/2)/(2*Math.PI))<=Math.floor((h+Math.PI/2)/(2*Math.PI)))a=-1;
  return[Math.max(-1,down(a-slack)),Math.min(1,up(b+slack))];
 }
 if(id==='quadratic')return[down(lo*Math.abs(lo)),up(hi*Math.abs(hi))];
 if(id==='cubic'){
  const cube=x=>{const value=x*x*x;const slack=8*Number.EPSILON*Math.abs(value);return[value-slack,value+slack];};
  return[down(cube(lo)[0]),up(cube(hi)[1])];
 }
 return[lo,hi];
}
export function inspectInputEnclosures(model,observations,radii){
 const evaluated=evaluate(model,observations),r=options(radii);
 const rows=evaluated.rows.map((row,index)=>{
  const boxes=Object.fromEntries(['command','position','rate'].map(k=>[k,box(row[k],r[k])]));
  if(Object.values(boxes).flat().some(v=>Math.abs(v)>1e6))throw new RangeError('Coordinate box exceeds the maintained input domain');
  let low=0,high=0;
  for(const term of model.terms){
   if(term.coefficient===0)continue;
   const coordinate=term.id==='command'?'command':['rate','coulomb','quadratic'].includes(term.id)?'rate':'position';
   const [a,b]=term.id==='bias'?[1,1]:featureRange(term.id,boxes[coordinate]);
   const products=[term.coefficient*a,term.coefficient*b];
   low=down(low+down(Math.min(...products)));high=up(high+up(Math.max(...products)));
  }
  const observed=box(row.jointTorque,r.jointTorque);
  return{index,input:{command:row.command,position:row.position,rate:row.rate},nominalPrediction:row.prediction,
   observedTorque:row.jointTorque,prediction:[low,high],observation:observed,
   status:high<observed[0]||low>observed[1]?'excluded':'not-excluded'};
 });
 return{schema:'worldlaw.input-enclosure/v1',radii:r,count:rows.length,
  excludedCount:rows.filter(row=>row.status==='excluded').length,rows};
}
