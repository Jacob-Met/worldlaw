// Isolated underdamped affine solution in retained displacement coordinates.
function result(value){if(!Number.isFinite(value.positionDelta)||!Number.isFinite(value.rate))throw Error('Finite analytic output required.');return value;}
export function dampedState({frequencySquared,damping,force,initialRate,time}){
 if(![frequencySquared,damping,force,initialRate,time].every(Number.isFinite)||frequencySquared<=0||damping<0||time<0)throw Error('Finite stable affine declarations required.');
 const a=damping/2,b2=frequencySquared-a*a;if(!(b2>0))throw Error('Only strictly underdamped equations.');
 const b=Math.sqrt(b2),phase=b*time;if(phase>1e6||a*time>700)throw Error('Bounded phase and decay required.');
 // Taylor recurrence directly for u and u\': no subtraction of O(t) forcing terms.
 if(Math.max(Math.sqrt(frequencySquared),damping)*time<.125){
  let previous=0,current=initialRate*time,u=current,v=initialRate;
  for(let n=0;n<30;n++){const next=((n===0?force*time*time:0)-damping*time*(n+1)*current-frequencySquared*time*time*previous)/((n+2)*(n+1));u+=next;if(time>0)v+=(n+2)*next/time;previous=current;current=next;}
  return result({positionDelta:u,rate:v,method:'small-time-affine-series'});
 }
 const e=Math.exp(-a*time),s=Math.sin(phase),c=Math.cos(phase),q=force/frequencySquared;
 return result({positionDelta:q*(-Math.expm1(-a*time)+e*2*Math.sin(phase/2)**2-a*e*s/b)+initialRate*e*s/b,rate:force*e*s/b+initialRate*e*(c-a*s/b),method:'underdamped-closed-form'});
}
