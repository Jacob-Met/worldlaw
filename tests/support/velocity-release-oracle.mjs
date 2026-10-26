/** Independent affine exponential ranking oracle. No production integrator reuse. */
import assert from 'node:assert/strict';

const product=(a,b)=>a.map(row=>b[0].map((_,j)=>row.reduce((s,x,k)=>s+x*b[k][j],0)));
const identity=n=>Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>Number(i===j)));
const norm=a=>Math.max(...a.map(row=>row.reduce((s,x)=>s+Math.abs(x),0)));
function exponential(a){
 const squarings=Math.max(0,Math.ceil(Math.log2(norm(a)/.25)));
 const scaled=a.map(row=>row.map(x=>x/2**squarings));
 let answer=identity(a.length),term=identity(a.length),converged=false;
 for(let k=1;k<=100;k++){
  term=product(term,scaled).map(row=>row.map(x=>x/k));
  answer=answer.map((row,i)=>row.map((x,j)=>x+term[i][j]));
  if(norm(term)<2e-18){converged=true;break;}
 }
 assert.ok(converged,'independent exponential must converge');
 for(let k=0;k<squarings;k++)answer=product(answer,answer);
 return answer;
}
function transition(model,p,time){
 const [a,b]=p.inertia,c=p.inertiaCross,det=a*b-c*c;
 assert.ok(a>0&&det>0);
 const inverse=[[b/det,-c/det],[-c/det,a/det]],g=p.velocitySkew??0,d=p.dampingCross??0;
 const force=product(inverse,model.matrix),velocity=product(inverse,[[p.damping[0],d+g],[d-g,p.damping[1]]]);
 const bias=product(inverse,model.bias.map(x=>[x]));
 const A=[[0,0,1,0,0],[0,0,0,1,0],[...force[0],-velocity[0][0],-velocity[0][1],bias[0][0]],[...force[1],-velocity[1][0],-velocity[1][1],bias[1][0]],[0,0,0,0,0]];
 return exponential(A.map(row=>row.map(x=>x*time)));
}
const at=(transition,q)=>transition.slice(0,2).map(row=>row[0]*q[0]+row[1]*q[1]+row[4]);

export const models=[
 {schema:'worldlaw.coupled-torque-model/v1',id:'reciprocal',label:'Dense restoring control',matrix:[[-2.7,.63],[.63,-1.9]],bias:[.17,-.23]},
 {schema:'worldlaw.coupled-torque-model/v1',id:'directional',label:'Directional affine control',matrix:[[-1.4,-.37],[.29,-2.2]],bias:[-.11,.31]},
];
export const positions=[[-.9,.2],[.35,-.75],[.8,.55],[-.45,-.65],[.12,.08],[.7,-.4]];
export const settings={correspondence:"Independent affine analytic control; matched coordinates and torque conventions.",duration:1.7,samples:87,maxStep:.008,positionTolerance:1e-6,rateTolerance:1e-6,minimumSeparation:1e-7,tieTolerance:1e-9};
export function families(g){return {
 diagonal:{inertia:[1.9,1.2],inertiaCross:-.21,damping:[.38,.69]},
 symmetric:{inertia:[2.3,1.45],inertiaCross:-.32,damping:[.61,.44],dampingCross:-.16},
 skew:{inertia:[2.1,1.6],inertiaCross:.27,damping:[.52,.73],dampingCross:.19,velocitySkew:g},
};}

export function oracle(family){
 const clocks=Array.from({length:settings.samples},(_,k)=>k*settings.duration/(settings.samples-1));
 const matrices=models.map(model=>Object.fromEntries(Object.entries(family).map(([key,p])=>[key,clocks.map(time=>transition(model,p,time))])));
 const releases=positions.map((q,index)=>{
  const comparisons=models.flatMap((model,i)=>['diagonal','symmetric'].map(baselineFamily=>{
   const curve=clocks.map((time,k)=>{const x=at(matrices[i].skew[k],q),y=at(matrices[i][baselineFamily][k],q);return {time,separation:Math.hypot(x[0]-y[0],x[1]-y[1])};});
   return {modelId:model.id,baselineFamily,curve,peak:curve.reduce((a,b)=>b.separation>a.separation?b:a)};
  }));
  return {index,position:q,comparisons,score:Math.min(...comparisons.map(c=>c.peak.separation))};
 });
 return {releases,rankedIndices:releases.toSorted((a,b)=>b.score-a.score||a.index-b.index).map(r=>r.index)};
}

