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
const positionIds=new Set(['spring','gravity','cubic']);
const scale=(v,c)=>c===0?[0,0]:[down(Math.min(c*v[0],c*v[1])),up(Math.max(c*v[0],c*v[1]))];
const add=(a,b)=>[down(a[0]+b[0]),up(a[1]+b[1])];
function cosineRange([lo,hi]){
 const slack=64*Number.EPSILON*(1+Math.max(Math.abs(lo),Math.abs(hi))),l=down(lo-slack),h=up(hi+slack);
 if(h-l>=2*Math.PI)return[-1,1];
 let a=Math.min(Math.cos(l),Math.cos(h)),b=Math.max(Math.cos(l),Math.cos(h));
 if(Math.ceil(l/(2*Math.PI))<=Math.floor(h/(2*Math.PI)))b=1;
 if(Math.ceil((l-Math.PI)/(2*Math.PI))<=Math.floor((h-Math.PI)/(2*Math.PI)))a=-1;
 return[Math.max(-1,down(a-slack)),Math.min(1,up(b+slack))];
}
function positionRange(terms,bounds){let r=[0,0];for(const t of terms)r=add(r,scale(featureRange(t.id,bounds),t.coefficient));return r;}
function derivativeRange(terms,[lo,hi]){
 let r=[0,0];
 for(const t of terms){
  const square=[lo<=0&&hi>=0?0:Math.max(0,down(Math.min(lo*lo,hi*hi))),up(Math.max(lo*lo,hi*hi))];
  r=add(r,scale(t.id==='spring'?[1,1]:t.id==='gravity'?cosineRange([lo,hi]):scale(square,3),t.coefficient));
 }
 return r;
}
function refinePosition(terms,[lo,hi],segments){
 let result=[Infinity,-Infinity];
 for(let i=0;i<segments;i++){
  // Shared rounded split values are expanded oppositely; neighboring pieces overlap.
  const a=i===0?lo:Math.max(lo,down(lo+(hi-lo)*i/segments));
  const b=i===segments-1?hi:Math.min(hi,up(lo+(hi-lo)*(i+1)/segments));
  const mid=a+(b-a)/2,center=positionRange(terms,[mid,mid]),d=derivativeRange(terms,[a,b]);
  const radius=up(Math.max(mid-a,b-mid)),spread=up(radius*Math.max(Math.abs(d[0]),Math.abs(d[1])));
  const independent=positionRange(terms,[a,b]);
  const bound=[Math.max(independent[0],down(center[0]-spread)),Math.min(independent[1],up(center[1]+spread))];
  if(bound[0]>bound[1])return null;
  result=[Math.min(result[0],bound[0]),Math.max(result[1],bound[1])];
 }
 return result;
}
export function inspectInputEnclosures(model,observations,radii,{refinementSegments=1}={}){
 const evaluated=evaluate(model,observations),r=options(radii);
 if(![0,1,4,16,64].includes(refinementSegments))throw new RangeError('Choose 0, 1, 4, 16 or 64 refinement segments');
 const positionTerms=model.terms.filter(t=>positionIds.has(t.id)&&t.coefficient!==0);
 const eligible=positionTerms.length>1&&r.position>0,requestedRowSegments=eligible?evaluated.count*refinementSegments:0;
 const limit=8192,limited=requestedRowSegments>limit,segments=eligible&&!limited?refinementSegments:0;
 let refinedCount=0;
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
  const independentPrediction=[low,high];
  if(segments){
   const joint=refinePosition(positionTerms,boxes.position,segments);
   if(joint){let other=[0,0];
    for(const t of model.terms.filter(t=>!positionIds.has(t.id)))other=add(other,scale(t.id==='bias'?[1,1]:featureRange(t.id,boxes[t.id==='command'?'command':'rate']),t.coefficient));
    const combined=add(joint,other),a=Math.max(low,combined[0]),b=Math.min(high,combined[1]);
    if(a<=b){low=a;high=b;refinedCount++;}
   }
  }
  const observed=box(row.jointTorque,r.jointTorque);
  return{index,input:{command:row.command,position:row.position,rate:row.rate},nominalPrediction:row.prediction,
   observedTorque:row.jointTorque,prediction:[low,high],independentPrediction,observation:observed,
   status:high<observed[0]||low>observed[1]?'excluded':'not-excluded'};
 });
 return{schema:'worldlaw.input-enclosure/v1',radii:r,count:rows.length,
  excludedCount:rows.filter(row=>row.status==='excluded').length,refinement:{requestedSegments:refinementSegments,usedSegments:segments,requestedRowSegments,limit,refinedCount,status:limited?'work-limit':segments?'joint-position':'independent-terms'},rows};
}
