/** Synthetic twin preparation and post-reset sensor observations. */
import { command,components,DT,GRID,layoutFor,N,rollout } from '../src/trajectory/field-law-dictionary.mjs';
import { rng } from './noisy-field-acquisition.mjs';

function preparationInput(layout,sign) {
  if(layout==='oscillator') return [0,sign*.48];
  if(layout==='kinetic') return [sign*.48,0];
  return Array.from({length:GRID},(_,i)=>sign*.05*Math.SQRT2*Math.sin(2*Math.PI*i/GRID+.3));
}

function preparedHidden(id,coef,start,reset,sign) {
  const layout=layoutFor(id);
  let y=[...start,.8];
  const past=[start[0]];
  // The original outside simulators use eight Euler steps per measured period.
  function step(u) {
    const lag=past[Math.max(0,past.length-1-20)];
    const [x,v,z]=y;
    const rate=id==='lorenz-hidden-z'
      ? [3*(v-x)+u[0],.3*(x*(28-10*z)-v),.3*(10*x*v-8*z/3)]
      : [v,-coef[0]*lag-.28*coef[1]*v+u[1],0];
    y=y.map((w,j)=>w+DT*rate[j]/8);
    if(y.some(v=>!Number.isFinite(v)))throw Error('nonfinite hidden trajectory');
  }
  const pre=preparationInput(layout,sign);
  for(let n=0;n<N;n++) {
    for(let k=0;k<8;k++)step(pre);
    past.push(y[0]);
  }
  y[0]=reset[0];y[1]=reset[1];
  // Only the present observation is reset. Strictly past samples and z survive.
  past[past.length-1]=y[0];
  const rows=[y.slice(0,2)];
  for(let n=0;n<N;n++) {
    for(let k=0;k<8;k++)step(command(layout,2,(n+k/8)*DT));
    past.push(y[0]);rows.push(y.slice(0,2));
  }
  return rows;
}

function preparedMarkov(id,coef,start,reset,sign) {
  const pre=preparationInput(layoutFor(id),sign);
  function derivative(y) {
    const [d,a,b]=components(id,y);
    return d.map((v,i)=>v+coef[0]*a[i]+coef[1]*b[i]+pre[i]);
  }
  const add=(y,k,dt)=>y.map((v,i)=>v+dt*k[i]);
  let y=start.slice();
  for(let n=0;n<N;n++) {
    const a=derivative(y),b=derivative(add(y,a,DT/2)),c=derivative(add(y,b,DT/2)),e=derivative(add(y,c,DT));
    y=y.map((v,i)=>v+DT*(a[i]+2*b[i]+2*c[i]+e[i])/6);
    if(y.some(x=>!Number.isFinite(x)))throw Error('nonfinite preparation for '+id);
  }
  const path=rollout(id,coef,reset,2);
  if(!path)throw Error('nonfinite reset trajectory');
  return path;
}

function boundedRead(clean,db,seed,metadata) {
  const rand=rng(seed);
  const bounds=clean[0].map((_,j)=>{
    const mean=clean.reduce((s,row)=>s+row[j],0)/clean.length;
    const variance=clean.reduce((s,row)=>s+(row[j]-mean)**2,0)/clean.length;
    return Math.sqrt(3*variance)*10**(-db/20);
  });
  return {...metadata,time:clean.map((_,i)=>i*DT),bounds,
    values:clean.map(row=>row.map((v,j)=>v+(2*rand()-1)*bounds[j]))};
}

export function acquireHistoryPair(id,coef,start,reset,db,seed) {
  const hidden=['lorenz-hidden-z','delay-feedback'].includes(id);
  return [-1,1].map((sign,i)=>{
    const clean=(hidden?preparedHidden:preparedMarkov)(id,coef,start,reset,sign);
    return boundedRead(clean,db,seed+i*65537,{preparation:sign<0?'negative':'positive',
      reset:'visible-'+JSON.stringify(reset),forcing:'dictionary-drive-2'});
  });
}
