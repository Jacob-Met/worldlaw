// Separated, real stable roots only; independent-time affine comparison.
export function overdampedState({frequencySquared,damping,force,initialRate,time}){
 if(![frequencySquared,damping,force,initialRate,time].every(Number.isFinite)||frequencySquared<=0||damping<=0||time<0||time>1000)throw Error('Bounded stable affine declarations required.');
 const a=damping/2,g2=a*a-frequencySquared,g=Math.sqrt(g2);
 if(!Number.isFinite(g)||!(g>0)||g/a<1e-4)throw Error('Separated overdamped roots required.');
 let positionDelta,rate,method;
 if(Math.max(Math.sqrt(frequencySquared),damping)*time<.125){
  let previous=0,current=initialRate*time,u=current,v=initialRate;
  for(let n=0;n<30;n++){const next=((n===0?force*time*time:0)-damping*time*(n+1)*current-frequencySquared*time*time*previous)/((n+2)*(n+1));u+=next;if(time>0)v+=(n+2)*next/time;previous=current;current=next;}
  positionDelta=u;rate=v;method='small-time-affine-series';
 }else{
  const slow=-frequencySquared/(a+g),fast=-(a+g),gap=slow-fast,e1=Math.exp(slow*time),e2=Math.exp(fast*time),S=e1*(-Math.expm1(-gap*time))/gap,I=(Math.expm1(slow*time)/slow-Math.expm1(fast*time)/fast)/gap;
  positionDelta=force*I+initialRate*S;rate=force*S+initialRate*(slow*e1-fast*e2)/gap;method='separated-overdamped-closed-form';
 }
 if(!Number.isFinite(positionDelta)||!Number.isFinite(rate))throw Error('Finite analytic output required.');
 return{positionDelta,rate,method};
}
