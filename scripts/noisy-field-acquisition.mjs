/** Acquisition routines shared with the original noisy-field course. */
import {layoutFor,command,DT,N,GRID} from '../src/trajectory/field-law-dictionary.mjs';

export function rng(seed) {
  let x=seed>>>0;
  return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return (x+.5)/4294967296;};
}
export function initial(layout,seed) {
  const r=rng(seed),phase=6.28*r();
  if(layout==='oscillator') return [.7+.7*r(),-.45+.9*r()];
  if(layout==='kinetic') return [.7+.55*r(),.55+.7*r()];
  return Array.from({length:GRID},(_,i)=>.65+.2*Math.sin(2*Math.PI*i/GRID+phase)
    +.12*Math.cos(4*Math.PI*i/GRID+2*phase)+.06*Math.sin(6*Math.PI*i/GRID-phase));
}
export function outsider(id,start,drive,coef) {
  let y=[...start,.8];
  const hist=[start[0]],rows=[start.slice()];
  for(let n=0;n<N;n++) {
    for(let k=0;k<8;k++) {
      const [x,v,z]=y,u=command(layoutFor(id),drive,(n+k/8)*DT);
      const lag=hist[Math.max(0,hist.length-1-20)];
      const rate=id==='lorenz-hidden-z'?[3*(v-x)+u[0],.3*(x*(28-10*z)-v),.3*(10*x*v-8*z/3)]
        :[v,-coef[0]*lag-.28*coef[1]*v+u[1],0];
      y=y.map((w,j)=>w+DT*rate[j]/8);
    }
    hist.push(y[0]);rows.push(y.slice(0,2));
  }
  return rows;
}
export function observe(clean,layout,drive,db,seed) {
  const r=rng(seed),values=clean.map(row=>row.slice()),sigma=[];
  for(let j=0;j<clean[0].length;j++) {
    const signal=clean.map(row=>row[j]),mean=signal.reduce((a,b)=>a+b,0)/signal.length;
    const sd=Math.sqrt(signal.reduce((a,b)=>a+(b-mean)**2,0)/signal.length)*10**(-db/20);
    if(!(sd>0)) throw Error('zero signal channel');
    const noise=signal.map(()=>Math.sqrt(-2*Math.log(r()))*Math.cos(2*Math.PI*r()));
    const mu=noise.reduce((s,a)=>s+a,0)/noise.length;
    const rms=Math.sqrt(noise.reduce((s,a)=>s+(a-mu)**2,0)/noise.length);
    noise.forEach((x,i)=>{values[i][j]+=(x-mu)*sd/rms;});
    sigma.push(sd);
  }
  return {layout,drive,values,sigma};
}
export function scrambled(run,seed) {
  const r=rng(seed),values=run.values.slice();
  for(let i=N-1;i>1;i--) {
    const j=1+Math.floor(r()*i);
    [values[i],values[j]]=[values[j],values[i]];
  }
  return {...run,values};
}
