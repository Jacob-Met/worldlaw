// Causal scalar exponential memory of the observed position squared.
const DT=.02;
export const DECAYS=Array.from({length:13},(_,i)=>.25*2**(i/2));
const dot=(x,y)=>x.reduce((s,v,i)=>s+v*y[i],0);
const add=(a,b,f)=>a.map((v,i)=>v+f*b[i]);
function fitRows(rows){
  const d=rows[0][0].length;
  const scale=Array.from({length:d},(_,j)=>Math.sqrt(rows.reduce((s,[x])=>s+x[j]**2,0)/rows.length)||1);
  const a=Array.from({length:d},()=>Array(d+1).fill(0));
  for(const [x,y] of rows){
    const v=x.map((q,j)=>q/scale[j]);
    for(let i=0;i<d;i++){
      for(let j=0;j<d;j++)a[i][j]+=v[i]*v[j];
      a[i][d]+=v[i]*y;
    }
  }
  for(let i=0;i<d;i++)a[i][i]+=1e-8*rows.length;
  for(let i=0;i<d;i++){
    let best=i;
    for(let j=i+1;j<d;j++)if(Math.abs(a[j][i])>Math.abs(a[best][i])) best=j;
    [a[i],a[best]]=[a[best],a[i]];
    const p=a[i][i];
    if(!Number.isFinite(p)||Math.abs(p)<1e-14)throw Error('singular weak design');
    for(let j=i;j<=d;j++)a[i][j]/=p;
    for(let k=0;k<d;k++)if(k!==i){
      const q=a[k][i]; for(let j=i;j<=d;j++)a[k][j]-=q*a[i][j];
    }
  }
  return a.map((r,j)=>r[d]/scale[j]);
}
function samplesOf(record){
  if(!Array.isArray(record)||record.length<11)throw Error('eleven observed samples required');
  for(let i=0;i<record.length;i++){
    const s=record[i];
    if(s.state.length!==2||![...s.state,s.command,s.time].every(Number.isFinite)||
        Math.abs(s.time-i*DT)>1e-8)throw Error('invalid observed clock');
  }
  return record;
}
function donorAt(donor,t){
  const steps=donor.length-1;
  const p=((t/DT+137)%steps+steps)%steps;
  const i=Math.floor(p), f=p-i;
  return (1-f)*donor[i]+f*donor[i+1];
}
function features(x,v,u,k,arm){
  const f=[x,v,u,x*x*x];
  if(arm==='memory'||arm==='wrongHistory')f.push(x*k);
  return f;
}
function makeRows(record,arm,lambda,donor,slot,n){
  samplesOf(record);
  const transient=arm!=='local', e=Math.exp(-lambda*DT);
  const weight=(1-e)/lambda;
  let k=0;
  const fs=record.map((s,i)=>{
    if(i){
      const x0=arm==='wrongHistory'?donorAt(donor,s.time-DT):record[i-1].state[0];
      const x1=arm==='wrongHistory'?donorAt(donor,s.time):s.state[0];
      k=e*k+weight*(x0*x0+x1*x1)/2;
    }
    const [x,v]=s.state,f=features(x,v,s.command,k,arm);
    if(transient)for(let t=0;t<n;t++)f.push(t===slot?x*Math.exp(-lambda*s.time):0);
    return f;
  });
  const rows=[];
  const width=record.length===11?6:10;
  for(let start=0;start+width<record.length;start+=record.length===11?1:2){
    const end=start+width;
    const integrated=fs[start].map((v,j)=>{
      let sum=(v+fs[end][j])/2;
      for(let t=start+1;t<end;t++)sum+=fs[t][j];
      return DT*sum;
    });
    rows.push([integrated,record[end].state[1]-record[start].state[1]]);
  }
  return {rows,k};
}
export function fitTemporalMemory(records,arm,lambda){
  if(records.length!==2||!['local','transient','memory','wrongHistory'].includes(arm)||
     !Number.isFinite(lambda)||lambda<=0)throw Error('invalid temporal model');
  const donors=records.map(r=>r.map(s=>s.state[0]));
  const rows=records.flatMap((r,i)=>makeRows(r,arm,lambda,donors[1-i],i,2).rows);
  const coefficients=fitRows(rows);
  const d=features(0,0,0,0,arm).length;
  return {arm,lambda,coefficients:coefficients.slice(0,d),trainingNuisance:coefficients.slice(d),
    donor:arm==='wrongHistory'?donors[0]:[]};
}
export function forecastTemporalMemory(model,prefix,commands){
  if(prefix.length!==11||!Array.isArray(commands)||!commands.every(Number.isFinite))throw Error('invalid frozen prefix or schedule');
  const {arm,lambda,donor,coefficients}=model;
  const {rows,k}=makeRows(prefix,arm,lambda,donor,0,1);
  let g=0;
  if(arm!=='local'){
    let xy=0,xx=0;
    for(const [full,y] of rows){
      const a=full.at(-1);
      xy+=a*(y-dot(coefficients,full.slice(0,-1)));xx+=a*a;
    }
    g=xy/(xx+1e-10);
  }
  let state=[...prefix.at(-1).state,k], time=prefix.at(-1).time;
  const forecast=[];
  function rhs(s,t,u){
    const [x,v,m]=s;
    const r=arm==='wrongHistory'?donorAt(donor,t):x;
    return [v,dot(coefficients,features(x,v,u,m,arm))+
      (arm==='local'?0:g*x*Math.exp(-lambda*t)),r*r-lambda*m];
  }
  let previous=prefix.at(-1).command;
  for(const next of commands){
    const h=DT/8;
    for(let j=0;j<8;j++){
      const u0=previous+(next-previous)*j/8, um=u0+(next-previous)/16, u1=u0+(next-previous)/8;
      const a=rhs(state,time,u0), b=rhs(add(state,a,h/2),time+h/2,um);
      const c=rhs(add(state,b,h/2),time+h/2,um), d=rhs(add(state,c,h),time+h,u1);
      state=state.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);
      if(state.some(v=>!Number.isFinite(v)||Math.abs(v)>1e5))return {states:forecast,diverged:true,g};
      time+=h;
    }
    forecast.push(state.slice(0,2));previous=next;
  }
  return {states:forecast,diverged:false,g};
}
export function relativeError(pred,truth,horizon=truth.length){
  if(pred.states.length<horizon)return 10;
  let s=0,e=0;
  for(let i=0;i<horizon;i++)for(let j=0;j<2;j++){
    s+=truth[i][j]**2;e+=(pred.states[i][j]-truth[i][j])**2;
  }
  return Math.min(10,Math.sqrt(e/Math.max(s,1e-12)));
}
