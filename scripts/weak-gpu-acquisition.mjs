import {writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {laws,layoutFor,rollout,command,DT,N,GRID} from '../src/trajectory/field-law-dictionary.mjs';

// This is a simulator-only acquisition packet. The estimator is passed just
// three observed runs at a time, with its selected command and measured noise.
function initial(layout,seed) {
  let x=seed>>>0;
  const r=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return (x+.5)/4294967296;};
  const phase=2*Math.PI*r();
  if(layout==='oscillator')return [.7+.7*r(),-.45+.9*r()];
  if(layout==='kinetic')return [.7+.55*r(),.55+.7*r()];
  return Array.from({length:GRID},(_,i)=>.65+.2*Math.sin(2*Math.PI*i/GRID+phase)
    +.12*Math.cos(4*Math.PI*i/GRID+2*phase)+.06*Math.sin(6*Math.PI*i/GRID-phase));
}
function outsider(id,start,drive,coef) {
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
const worlds=[{seed:619087,coefficients:[.91,1.08]},{seed:817603,coefficients:[1.17,.79]}];
function packet(id) {
  const layout=layoutFor(id),data=[];
  for(const {seed,coefficients} of worlds) {
    const start=initial(layout,seed);
    // Acquisition drives -1..7 share the same IC. The final two drives (2,5)
    // use distinct fresh initial conditions for conditional admission and audit.
    for(let index=0;index<11;index++) {
      const drive=index<9?index-1:index===9?2:5;
      const ic=index<9?start:initial(layout,seed+index*48731);
      const trajectory=laws[layout].includes(id)?rollout(id,coefficients,ic,drive):outsider(id,ic,drive,coefficients);
      if(!trajectory||trajectory.length!==N+1)throw Error('unstable generation');
      for(const row of trajectory)for(const value of row)data.push(value);
    }
  }
  return data;
}
const folder=process.argv[2];
if(!folder)throw Error('usage: node scripts/weak-gpu-acquisition.mjs OUTPUT_DIR');
mkdirSync(folder,{recursive:true});
for(const id of [...Object.values(laws).flat(),'lorenz-hidden-z','delay-feedback']) {
  const data=packet(id),bytes=Buffer.alloc(data.length*4);
  data.forEach((value,i)=>bytes.writeFloatLE(value,4*i));
  writeFileSync(join(folder,id+'.f32le.b64'),bytes.toString('base64')+'\n');
}
