import {fitPrefixState} from '../science/prefix-state-fit.mjs';
/** Weak temporal moments over observed state channels, finite-law ranking and active design. */
import {fitLinearColumns} from '../science/linear-fit.mjs';
import {laws,components,command,compileFieldCommand,rollout,DT,N,GRID} from './field-law-dictionary.mjs';

const square=x=>x*x;
const dot=(a,b)=>a.reduce((total,x,i)=>total+x*b[i],0);
const clipped=x=>Math.max(.15,Math.min(2,x));
const unit=(n,i)=>Array.from({length:n},(_,j)=>+(i===j));
function testVectors(layout) {
  if (layout!=='periodic') return [unit(2,0),unit(2,1)];
  const result=[Array(GRID).fill(1/GRID)];
  for(let k=1;k<=4;k++) for (const fn of [Math.cos,Math.sin])
    result.push(Array.from({length:GRID},(_,i)=>fn(2*Math.PI*k*i/GRID)/GRID));
  return result;
}

function check(run) {
  if (!Object.hasOwn(laws,run.layout)||run.values?.length!==N+1||
    (typeof run.drive!=='object'&&(!Number.isInteger(run.drive)||run.drive < -1||run.drive>7))) throw Error('invalid measured run');
  if(typeof run.drive==='object')compileFieldCommand(run.layout,run.drive);
  const n=run.layout==='periodic'?GRID:2;
  if (run.values.some(row=>row.length!==n||row.some(v=>!Number.isFinite(v)))) throw Error('invalid state observations');
  if (run.sigma?.length!==n||run.sigma.some(s=>!Number.isFinite(s)||s<=0)) throw Error('invalid measurement scales');
}

function design(run,law,method) {
  const project=testVectors(run.layout);
  const data=run.values.map((y,t)=>{
    const [d,a,b]=components(law,y);
    const u=command(run.layout,run.drive,t*DT);
    const z=d.map((x,i)=>x+u[i]);
    return project.map(v=>[dot(v,y),dot(v,z),dot(v,a),dot(v,b)]);
  });
  const target=[],left=[],right=[];
  if (method==='sindy') {
    // Seven-point local-linear slope, computed from measurements only.
    for(let t=3;t<=N-3;t+=3) for(let j=0;j<project.length;j++) {
      let slope=0;
      for(let k=-3;k<=3;k++) slope+=k*data[t+k][j][0]/(28*DT);
      target.push(slope-data[t][j][1]);left.push(data[t][j][2]);right.push(data[t][j][3]);
    }
  } else {
    // A compact differentiable time test vanishes at both endpoints.
    for(let t=0;t+24<=N;t+=8) for(let j=0;j<project.length;j++) {
      let v=0,a=0,b=0;
      for(let k=0;k<=24;k++) {
        const f=Math.sin(Math.PI*k/24)**2;
        const fp=Math.PI*Math.sin(2*Math.PI*k/24)/(24*DT);
        const row=data[t+k][j];
        v-=DT*(fp*row[0]+f*row[1]); a+=DT*f*row[2];b+=DT*f*row[3];
      }
      target.push(v);left.push(a);right.push(b);
    }
  }
  return {target,left,right};
}

function constrainedFit(a,b,y) {
  const qr=fitLinearColumns([a,b],y);
  const candidates=[];
  if(qr && qr.coefficients.every(x=>x>=.15&&x<=2)) candidates.push(qr.coefficients);
  const aa=dot(a,a),bb=dot(b,b),ab=dot(a,b),ay=dot(a,y),by=dot(b,y);
  for(const x of [.15,2]) {
    candidates.push([x,clipped(bb?(by-x*ab)/bb:.15)]);
    candidates.push([clipped(aa?(ay-x*ab)/aa:.15),x]);
  }
  return candidates.map(coef=>({coef,loss:y.reduce((s,v,i)=>s+square(v-coef[0]*a[i]-coef[1]*b[i]),0)/y.length}))
    .sort((a,b)=>a.loss-b.loss)[0];
}

export function rankObserved(runs,method='weak') {
  if (!runs.length||!['weak','sindy'].includes(method)) throw Error('unknown fit method or missing data');
  runs.forEach(check);
  const layout=runs[0].layout;
  if(runs.some(x=>x.layout!==layout)) throw Error('changed observation layout');
  return laws[layout].map(law=>{
    const rows=runs.map(r=>design(r,law,method));
    return {law,...constrainedFit(rows.flatMap(r=>r.left),rows.flatMap(r=>r.right),rows.flatMap(r=>r.target))};
  }).sort((a,b)=>a.loss-b.loss||a.law.localeCompare(b.law));
}

export function activeDesign(pilot) {
  const committee=rankObserved([pilot]).slice(0,4), design=[];
  for(let drive=0;drive<8;drive++) {
    const paths=committee.map(c=>rollout(c.law,c.coef,pilot.values[0],drive));
    let separation=Infinity;
    for(let i=0;i<paths.length;i++) for(let j=0;j<i;j++) {
      if(!paths[i]||!paths[j]) {separation=0;continue;}
      let mse=0,count=0;
      for(let t=4;t<=N;t+=4) for(let k=0;k<pilot.sigma.length;k++) {
        mse+=square((paths[i][t][k]-paths[j][t][k])/pilot.sigma[k]);count++;
      }
      separation=Math.min(separation,mse/count);
    }
    design.push({drive,separation});
  }
  design.sort((a,b)=>b.separation-a.separation||a.drive-b.drive);
  return {drive:design[0].drive,committee:committee.map(c=>c.law),scores:design};
}

export function identify(runs,verification,method='weak',{initialization='first-observation',prefixPoints=17,scoreStart=null}={}) {
  check(verification);
  if(!['first-observation','prefix-shooting'].includes(initialization))throw new RangeError('Unknown verification initialization');
  if(!Number.isInteger(prefixPoints)||prefixPoints<5||prefixPoints>33)throw new RangeError('Invalid verification prefix');
  const firstScored=scoreStart??(initialization==='prefix-shooting'?prefixPoints:1);
  if(!Number.isInteger(firstScored)||firstScored<1||firstScored>N||
    (initialization==='prefix-shooting'&&firstScored<prefixPoints))throw new RangeError('Verification suffix overlaps fitted prefix');
  if (verification.layout!==runs[0].layout) throw Error('changed verification layout');
  const [best,runner]=rankObserved(runs,method);
  let start=verification.values[0],prefix=null;
  if(initialization==='prefix-shooting') {
    const observations=verification.values.slice(0,prefixPoints).map(row=>row.slice());
    prefix=fitPrefixState(observations,
      initial=>rollout(best.law,best.coef,initial,verification.drive,{steps:prefixPoints-1}),
      {scales:verification.sigma,maxMagnitude:80});
    if(prefix.status!=='fitted')return {...best,runner:runner.law,admitted:false,standardizedError:null,initialization,prefix,firstScored};
    start=prefix.initial;
  }
  const details=initialization==='first-observation'&&scoreStart===null?{}:{initialization,prefix,firstScored};
  const path=rollout(best.law,best.coef,start,verification.drive);
  if(!path)return {...best,admitted:false,standardizedError:null,runner:runner.law,...details};
  let loss=0,count=0;
  for(let t=firstScored;t<=N;t++)for(let k=0;k<verification.sigma.length;k++) {
    loss+=square((path[t][k]-verification.values[t][k])/verification.sigma[k]);count++;
  }
  const standardizedError=Math.sqrt(loss/count);
  return {...best,runner:runner.law,standardizedError,admitted:standardizedError<=3,...details,...(Object.keys(details).length?{scoredValues:count}:{})};
}
