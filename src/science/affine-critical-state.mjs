// Research: bounded entire-function comparison near repeated stable roots.
export function criticalState({frequencySquared:w2,damping:d,force:F,initialRate:v0,time:t}){
 if(![w2,d,F,v0,t].every(Number.isFinite)||w2<=0||d<=0||t<0||t>1000)throw Error('Finite stable declarations required');
 const a=d/2,g2=a*a-w2,z2=g2*t*t;
 if(!Number.isFinite(g2)||!Number.isFinite(z2)||Math.abs(z2)>.25||a*t>700)throw Error('Bounded near-repeated-root comparison required');
 let u,v,method;
 if(Math.max(Math.sqrt(w2),d)*t<.125){
  let previous=0,current=v0*t;u=current;v=v0;
  for(let n=0;n<30;n++){const next=((n===0?F*t*t:0)-d*t*(n+1)*current-w2*t*t*previous)/((n+2)*(n+1));u+=next;if(t>0)v+=(n+2)*next/t;previous=current;current=next;}
  method='small-time-series';
 }else{
  let cm1=0,s=1,ct=1,st=1;
  for(let n=1;n<=16;n++){ct*=z2/((2*n-1)*(2*n));st*=z2/((2*n)*(2*n+1));cm1+=ct;s+=st;}
  const e=Math.exp(-a*t),S=t*s,impulse=e*S,I=(-Math.expm1(-a*t)-e*(cm1+a*S))/w2;
  u=F*I+v0*impulse;v=F*impulse+v0*e*(1+cm1-a*S);method='bounded-entire-functions';
 }
 if(!Number.isFinite(u)||!Number.isFinite(v))throw Error('Nonfinite comparison output');
 return{positionDelta:u,rate:v,method};
}
