// u_t = a D u + b D Δu + c D(u²) on a periodic, uniformly spaced grid.
import {fitLinearColumns} from './linear-fit.mjs';
import {validateStateTrajectory,requireState} from './state-trajectory.mjs';
import {shrinkPeriodicPrefix} from './temporal-evidence.mjs';

function modesFor(indices,n,spacing) {
  requireState(Array.isArray(indices)&&indices.length>0&&indices.length<=8&&new Set(indices).size===indices.length,'Invalid probe modes');
  return indices.map(k=>{
    requireState(Number.isInteger(k)&&k>0&&k<n/2,'Mode must be resolved and non-Nyquist');
    const angle=2*Math.PI*k/n;
    return {k,mu:4*Math.sin(angle/2)**2/spacing**2,symbol:Math.sin(angle)/spacing,
      cos:Array.from({length:n},(_,j)=>2*Math.cos(angle*j)/n),
      sin:Array.from({length:n},(_,j)=>2*Math.sin(angle*j)/n)};
  });
}
function moments(a, b) {
  let re=0,im=0;
  for(let j=0;j<a.length;j++){re+=a[j]*b.cos[j];im+=a[j]*b.sin[j];}
  return [re,im];
}
function bump(dt) {
  const weights=[],target=[];
  for(let k=-20;k<=20;k++){
    const s=k/20,base=1-s*s;
    weights.push(base**4);target.push(8*s*base**3/(20*dt));
  }
  return {weights,target};
}
export function fitDispersiveProbe(records,declarations) {
  requireState(Array.isArray(records)&&records.length>0&&records.length<=6&&
    Array.isArray(declarations)&&declarations.length===records.length,'Require matched recordings and mode declarations');
  requireState(new Set(records.map(r=>r.id)).size===records.length,'Duplicate probe identity');
  const columns=[[],[],[]],target=[],modeSet=new Set();
  for(let ri=0;ri<records.length;ri++){
    const run=records[ri], {n,dt,length}=validateStateTrajectory(run);
    requireState(run.kind==='periodic'&&n%4===0&&length>=63&&n===records[0].samples[0].state.length&&
      run.spacing===records[0].spacing,'Incompatible quarter-wave grid or recording length');
    requireState(run.samples.every(s=>s.command.every(v=>v===0)),'Require unforced dynamics');
    const modes=modesFor(declarations[ri],n,run.spacing),samples=run.samples;
    const square=samples.map((_,t)=>samples[Math.max(0,t-1)].state.map((v,j)=>v*samples[Math.min(length-1,t+1)].state[j]));
    const w=bump(dt);
    for(const b of modes){
      modeSet.add(b.k);
      const field=samples.map(r=>moments(r.state,b)), flux=square.map(r=>moments(r,b));
      for(let start=1;start+41<length;start+=10){
        const du=[0,0],du2=[0,0],dy=[0,0];
        for(let m=0;m<41;m++){
          const at=start+m;
          for(let side=0;side<2;side++){
            const sign=side===0?1:-1;
            dy[side]+=w.target[m]*field[at][side];
            du[side]+=w.weights[m]*sign*b.symbol*field[at][1-side];
            du2[side]+=w.weights[m]*sign*b.symbol*flux[at][1-side];
          }
        }
        for(let side=0;side<2;side++){
          target.push(dy[side]);columns[0].push(du[side]);
          columns[1].push(-b.mu*du[side]);columns[2].push(du2[side]);
        }
      }
    }
  }
  const drift=fitLinearColumns([columns[0]],target);
  if(!drift)return {status:'insufficient_signal'};
  const repeatLocal={a:drift.coefficients[0],b:0,c:0};
  // With one spatial symbol, DΔu is exactly proportional to Du, including
  // when noisy observations have incidental energy outside that tested mode.
  if(modeSet.size<2)return {status:'rank_deficient',repeatLocal};
  const local=fitLinearColumns([columns[0],columns[2]],target),mixed=fitLinearColumns(columns,target);
  if(!mixed||!local)return {status:'rank_deficient',repeatLocal};
  return {status:'three_columns_estimable',repeatLocal,
    local:{a:local.coefficients[0],b:0,c:local.coefficients[1]},
    mixed:{a:mixed.coefficients[0],b:mixed.coefficients[1],c:mixed.coefficients[2]},
    condition:mixed.conditionEstimate,weakRows:target.length,
    scope:'Estimation within the declared dispersive Burgers family; not an admission of an unrestricted PDE.'};
}

export function dispersiveRhs(u,spacing,model) {
  const n=u.length,den=2*spacing;
  return u.map((_,i)=>{
    const l=u[(i+n-1)%n],r=u[(i+1)%n],ll=u[(i+n-2)%n],rr=u[(i+2)%n];
    return (model.a*(r-l)+model.c*(r*r-l*l)+model.b*(rr-2*r+2*l-ll)/spacing**2)/den;
  });
}
export function predictDispersiveProbe(model,prefix,spacing,steps) {
  requireState(model&&[model.a,model.b,model.c].every(Number.isFinite)&&Number.isFinite(spacing)&&spacing>0,'Invalid dispersive model or spacing');
  requireState(Array.isArray(prefix)&&prefix.length===11,'Require exactly eleven observed prefix samples');
  const n=prefix[0]?.state?.length,dt=prefix[1].time-prefix[0].time;
  requireState(Number.isInteger(n)&&n>=8&&n<=128&&n%4===0&&dt>0&&Number.isFinite(dt)&&prefix.every((r,i)=>
    Array.isArray(r.state)&&r.state.length===n&&r.state.every(Number.isFinite)&&
    Array.isArray(r.command)&&r.command.length===n&&r.command.every(v=>v===0)&&
    Math.abs((r.time-prefix[0].time)-i*dt)<=1e-8*dt),'Invalid unforced prefix or grid');
  requireState(Number.isInteger(steps)&&steps>0&&steps*n<=131072,'Invalid prediction horizon');
  // Exact endpoint weights of a degree-three LS fit on eleven equally spaced points.
  const weights=[-12,8,13,8,-2,-12,-17,-12,8,48,113];
  let state=shrinkPeriodicPrefix(Array.from({length:n},(_,j)=>weights.reduce((s,w,i)=>s+w*prefix[i].state[j]/143,0)),prefix);
  const h=dt/4, forecast=[];
  for(let t=0;t<steps;t++){
    for(let s=0;s<4;s++){
      const a=dispersiveRhs(state,spacing,model);
      const b=dispersiveRhs(state.map((v,j)=>v+h*a[j]/2),spacing,model);
      const c=dispersiveRhs(state.map((v,j)=>v+h*b[j]/2),spacing,model);
      const d=dispersiveRhs(state.map((v,j)=>v+h*c[j]),spacing,model);
      state=state.map((v,j)=>v+h*(a[j]+2*b[j]+2*c[j]+d[j])/6);
      if(state.some(v=>!Number.isFinite(v)||Math.abs(v)>1e6))return {status:'diverged',states:null};
    }
    forecast.push(state);
  }
  return {status:'forecast',states:forecast};
}
