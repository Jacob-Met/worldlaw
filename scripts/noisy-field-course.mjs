/** Synthetic acquisition layer. It exposes noisy states and known commanded
 * inputs to the estimator and keeps law labels in this scorer only. */
import {writeFileSync,renameSync,mkdirSync,readFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {laws,layoutFor,rollout,command,DT,N,GRID} from '../src/trajectory/field-law-dictionary.mjs';
import {activeDesign,identify} from '../src/trajectory/noisy-field-intervention.mjs';

function rng(seed) {
  let x=seed>>>0;
  return ()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return (x+.5)/4294967296;};
}
function initial(layout,seed) {
  const r=rng(seed),phase=6.28*r();
  if(layout==='oscillator') return [.7+.7*r(),-.45+.9*r()];
  if(layout==='kinetic') return [.7+.55*r(),.55+.7*r()];
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
function observe(clean,layout,drive,db,seed) {
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
function scrambled(run,seed) {
  const r=rng(seed),values=run.values.slice();
  for(let i=N-1;i>1;i--) {
    const j=1+Math.floor(r()*i);
    [values[i],values[j]]=[values[j],values[i]];
  }
  return {...run,values};
}
function single(id,world,db,index) {
  const {seed,coefficients}=world,layout=layoutFor(id),outside=!laws[layout].includes(id);
  const start=initial(layout,seed),verifyStart=initial(layout,seed+982451653);
  const seedBase=seed+10163*index+421*db;
  const acquire=(st,drive,noise)=>{
    const truth=outside?outsider(id,st,drive,coefficients):rollout(id,coefficients,st,drive);
    if(!truth) throw Error('unstable truth for '+JSON.stringify({id,seed,db,drive}));
    return observe(truth,layout,drive,db,noise);
  };
  const pilot=acquire(start,-1,seedBase+1),verify=acquire(verifyStart,2,seedBase+3);
  const plan=activeDesign(pilot),random=Math.floor(rng(seedBase+47)()*8);
  const arms={};
  for(const [name,drive,method] of [['active-weak',plan.drive,'weak'],['random-weak',random,'weak'],['passive-sindy',-1,'sindy']]) {
    const response=acquire(start,drive,seedBase+2);
    const found=identify([pilot,response],verify,method);
    const sham=identify([scrambled(pilot,seedBase+5),scrambled(response,seedBase+7)],
      scrambled(verify,seedBase+11),method);
    arms[name]={drive,fit:found,sham,correct:!outside&&found.admitted&&found.law===id,
      wrong:found.admitted&&(outside||found.law!==id)};
  }
  return {id,seed,db,outside,plan,arms};
}

const registrationURL=new URL('../experiments/noisy-field-interventions/protocol.json',import.meta.url);
const raw=readFileSync(registrationURL);
const p=JSON.parse(raw);
const output=process.argv[2];
if(!output) throw Error('usage: node scripts/noisy-field-course.mjs NEW_REPORT.json');
const report={schema:p.format,protocol_sha256:createHash('sha256').update(raw).digest('hex'),node:process.version,rows:[],status:'running'};
mkdirSync(dirname(output),{recursive:true});
function save() {writeFileSync(output+'.pending',JSON.stringify(report)+'\n');renameSync(output+'.pending',output);}
try {
  for(const [index,id] of [...p.worlds,...p.ood].entries()) {
    for(const world of p.outer_worlds) for(const db of p.snr_db) {
      report.rows.push(single(id,world,db,index));
    }
    save();
  }
  const valid=report.rows.filter(x=>!x.outside),ood=report.rows.filter(x=>x.outside);
  if(valid.length!==132||ood.length!==12) throw Error('incomplete denominator');
  report.scores=Object.fromEntries(p.arms.map(name=>[name,{
    correct:valid.filter(x=>x.arms[name].correct).length,wrong:valid.filter(x=>x.arms[name].wrong).length,
    abstain:valid.filter(x=>!x.arms[name].fit.admitted).length,
    sham_admissions:report.rows.filter(x=>x.arms[name].sham.admitted).length,
    ood_admissions:ood.filter(x=>x.arms[name].fit.admitted).length,
  }]));
  const a=report.scores['active-weak'];
  report.admitted=a.correct>report.scores['random-weak'].correct&&a.correct>report.scores['passive-sindy'].correct
    &&a.sham_admissions===0&&a.ood_admissions===0;
  report.status='complete';save();console.log(JSON.stringify(report.scores));
} catch(e) {report.status='failed';report.error=String(e);save();throw e;}
