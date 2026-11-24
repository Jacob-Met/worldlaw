import {compileContinuousInput,validateRecordedContinuousInput} from './continuous-input.mjs';
import {fitPrefixState} from './prefix-state-fit.mjs';
import {fitLinearColumns} from './linear-fit.mjs';

export function requireState(ok, message) { if (!ok) throw new RangeError(message); }
export function meanSquare(xs) { let s=0; for (const x of xs) s+=x*x; return s/xs.length; }
const unary={sin:Math.sin,cos:Math.cos,tanh:Math.tanh,abs:Math.abs};

/** Compile the same executable AST used by symbolic-evolution/v1. Spatial
 * operators act on a complete local flux, never on a noisy supplied derivative.
 */
export function compileStateTree(tree, kind) {
  let count=0,requiresPointwise=false;
  const finite=x=>Number.isFinite(x)?x:NaN;
  function local(t, fieldOnly=false) {
    requireState(++count<=32,'Operator tree is too large');
    if(typeof t==='string') {
      const allowed=fieldOnly?['one','field']:kind==='periodic'?['one','field','command','dx','dxx']:['one','position','rate','command'];
      requireState(allowed.includes(t),'Invalid state terminal');
      if(t==='dx'||t==='dxx'){requiresPointwise=true;return(_x,_u,context)=>context?.[t]??NaN;}
      return t==='one'?()=>1:t==='command'?(_x,u)=>u:kind==='periodic'?(x)=>x:t==='position'?(x)=>x[0]:(x)=>x[1];
    }
    requireState(Array.isArray(t),'Invalid state expression');
    if(Object.hasOwn(unary,t[0])) {
      requireState(t.length===2,'Invalid unary expression');
      const a=local(t[1],fieldOnly), fn=unary[t[0]]; return (x,u,context)=>{const v=a(x,u,context);return Number.isFinite(v)?finite(fn(v)):NaN;};
    }
    if(kind==='periodic'&&!fieldOnly&&['gradient','laplacian'].includes(t[0])){
      requireState(t.length===2,'Invalid nested flux');requiresPointwise=true;
      const fn=local(t[1],true);
      return(x,_u,context)=>{if(!context)return NaN;const a=fn(context.left),b=fn(x),c=fn(context.right);return [a,b,c].every(Number.isFinite)?finite(t[0]==='gradient'?(c-a)/(2*context.spacing):(a-2*b+c)/context.spacing**2):NaN;};
    }
    requireState(['add','mul','div'].includes(t[0])&&t.length===3,'Invalid local state operator');
    const a=local(t[1],fieldOnly),b=local(t[2],fieldOnly);
    return(x,u,context)=>{const av=a(x,u,context),bv=b(x,u,context);if(!Number.isFinite(av)||!Number.isFinite(bv)||(t[0]==='div'&&bv===0))return NaN;return finite(t[0]==='add'?av+bv:t[0]==='mul'?av*bv:av/bv);};
  }
  if(kind==='periodic'&&Array.isArray(tree)&&['gradient','laplacian'].includes(tree[0])) {
    requireState(tree.length===2,'Invalid flux expression');
    const fn=local(tree[1],true); return {order:tree[0]==='gradient'?1:2,fn};
  }
  if(kind==='periodic'&&(tree==='dx'||tree==='dxx')) return {order:tree==='dx'?1:2,fn:x=>x};
  const fn=local(tree);return {order:0,fn,requiresPointwise};
}

export function validateStateTrajectory(run) {
  requireState(run?.schema==='worldlaw.state-trajectory/v1'&&['oscillator','periodic'].includes(run.kind),'Invalid state trajectory schema');
  requireState(typeof run.id==='string'&&run.id.length>0&&run.id.length<=160,'Require a recording identity');
  requireState(!['change','derivative','rhs','truth','model'].some(k=>Object.hasOwn(run,k)),'Derivative or truth labels are not state observations');
  const s=run.samples;
  requireState(Array.isArray(s)&&s.length>=33&&s.length<=4097,'Require 33–4097 time samples');
  const n=s[0]?.state?.length;
  requireState(Number.isInteger(n)&&(run.kind==='oscillator'?n===2:n>=6&&n<=128),'Invalid state dimension');
  requireState(n*s.length<=131072,'State trajectory exceeds the observation budget');
  if(run.kind==='periodic') requireState(Number.isFinite(run.spacing)&&run.spacing>0,'Require positive periodic grid spacing');
  const dt=s[1]?.time-s[0]?.time;
  requireState(Number.isFinite(dt)&&dt>0,'Require increasing sample times');
  const roundoff=8*Number.EPSILON*Math.max(1,Math.abs(s[0].time),Math.abs(s[s.length-1]?.time));
  requireState(roundoff<dt/8,'Sample interval is too small relative to timestamp precision');
  for(let i=0;i<s.length;i++) {
    const row=s[i];
    requireState(row&&Number.isFinite(row.time),'Require finite sample times');
    if(i)requireState(row.time>s[i-1].time&&Math.abs((row.time-s[i-1].time)-dt)<=1e-8*dt+roundoff,'Require a strictly increasing uniform time grid');
    requireState(Array.isArray(row.state)&&row.state.length===n&&Array.from(row.state).every(Number.isFinite),'Require finite observed states');
    requireState(!['change','derivative','rhs','truth'].some(k=>Object.hasOwn(row,k)),'Derivative labels are not accepted');
    requireState(run.kind==='oscillator'?Number.isFinite(row.command):Array.isArray(row.command)&&row.command.length===n&&Array.from(row.command).every(Number.isFinite),'Require measured input at every state sample');
  }
  const continuousInput=validateRecordedContinuousInput(run);
  return {run,dt,n,length:s.length,...(continuousInput?{continuousInput}:{})};
}

const filterCache=new Map();
const preparationSources=new WeakMap();
function polynomialWeights(points) {
  if(filterCache.has(points)) return filterCache.get(points);
  const half=(points-1)/2, kernels=[];
  for(let at=0;at<points;at++) {
    const t=Array.from({length:points},(_,j)=>(j-at)/half);
    const columns=[t.map(()=>1),t,t.map(v=>v*v),t.map(v=>v*v*v)], value=[],slope=[];
    for(let j=0;j<points;j++) {
      const fit=fitLinearColumns(columns,t.map((_,k)=>Number(j===k)));
      requireState(fit,'Singular polynomial smoothing design');
      value.push(fit.coefficients[0]);slope.push(fit.coefficients[1]/half);
    }
    kernels.push({value,slope});
  }
  filterCache.set(points,kernels);return kernels;
}

export function shrinkPeriodicPrefix(initial,rows) {
  const n=initial.length;
  if(n<6||n>128||rows.length!==11)throw RangeError('Require eleven periodic prefix observations');
  const differences=[];
  for(let t=1;t<10;t++)for(let j=0;j<n;j++){
    differences.push(Math.abs(rows[t-1].state[j]-2*rows[t].state[j]+rows[t+1].state[j]));
  }
  differences.sort((a,b)=>a-b);
  const sigma=differences[Math.floor(differences.length/2)]/(.6744897501960817*Math.sqrt(6));
  const variance=sigma*sigma*113/143;
  const mean=initial.reduce((a,b)=>a+b,0)/n, result=Array(n).fill(mean);
  for(let k=1;k<=Math.floor(n/2);k++){
    const singleton=2*k===n, factor=singleton?1/n:2/n;
    const cos=Array.from({length:n},(_,j)=>Math.cos(2*Math.PI*k*j/n));
    const sin=singleton?Array(n).fill(0):Array.from({length:n},(_,j)=>Math.sin(2*Math.PI*k*j/n));
    let re=0,im=0;
    for(let j=0;j<n;j++){re+=initial[j]*cos[j]*factor;im+=initial[j]*sin[j]*factor;}
    const power=re*re+im*im,noise=(singleton?1:4)*variance/n;
    const weight=power>noise?1-noise/power:0;
    for(let j=0;j<n;j++)result[j]+=weight*(re*cos[j]+im*sin[j]);
  }
  return result;
}

/** One deterministic local cubic filter, shared by weak and derivative methods.
 * A separate prefix-only fit initializes free forecasts; no later state is read.
 */
export function prepareStateTrajectory(run, points=11,{prefixShrinkage=false}={}) {
  const source=validateStateTrajectory(run),{n,length,dt}=source;
  requireState(Number.isInteger(points)&&points>=5&&points<=31&&points%2===1&&points<length,'Invalid smoothing width');
  requireState(typeof prefixShrinkage==='boolean'&&(!prefixShrinkage||(run.kind==='periodic'&&points===11)),'Prefix shrinkage requires an eleven-point periodic prefix');
  const kernels=polynomialWeights(points),half=(points-1)/2,states=[],derivatives=[];
  for(let i=0;i<length;i++) {
    const start=Math.min(length-points,Math.max(0,i-half)),k=kernels[i-start];
    const state=new Float64Array(n),derivative=new Float64Array(n);
    for(let j=0;j<points;j++) for(let d=0;d<n;d++) {
      state[d]+=k.value[j]*run.samples[start+j].state[d];
      derivative[d]+=k.slope[j]*run.samples[start+j].state[d]/dt;
    }
    states.push(state);derivatives.push(derivative);
  }
  let initial=Array.from({length:n},(_,d)=>kernels[points-1].value.reduce((a,w,j)=>a+w*run.samples[j].state[d],0));
  if(prefixShrinkage)initial=shrinkPeriodicPrefix(initial,run.samples.slice(0,points));
  const residuals=[];
  for(let i=1;i<length-1;i++) for(let d=0;d<n;d++) residuals.push(Math.abs(run.samples[i-1].state[d]-2*run.samples[i].state[d]+run.samples[i+1].state[d]));
  residuals.sort((a,b)=>a-b);
  const noiseSigma=residuals[Math.floor(residuals.length/2)]/(0.6744897501960817*Math.sqrt(6));
  const prepared={...source,states,derivatives,points,initial:Object.freeze(initial),startIndex:points-1,noiseSigma};
  preparationSources.set(prepared,{run,signature:JSON.stringify(run)});
  return Object.freeze(prepared);
}

function modelPredictor(model,n,spacing) {
  requireState(model?.schema==='worldlaw.symbolic-evolution/v1'&&['oscillator','periodic'].includes(model.kind)&&Array.isArray(model.terms)&&model.terms.length<=4,'Invalid state evolution model');
  const terms=model.terms.map(({tree,weight})=>{requireState(Number.isFinite(weight),'Invalid coefficient');return {...compileStateTree(tree,model.kind),weight};});
  if(model.kind==='oscillator') return (x,u)=>[x[1],terms.reduce((s,t)=>s+t.weight*t.fn(x,u),0)];
  return (x,u)=>Array.from({length:n},(_,j)=>{
    let y=0;const l=(j+n-1)%n,r=(j+1)%n;
    const context={left:x[l],right:x[r],spacing,dx:(x[r]-x[l])/(2*spacing),dxx:(x[l]-2*x[j]+x[r])/(spacing*spacing)};
    for(const t of terms) {
      const v=t.order===0?t.fn(x[j],u[j],context):t.order===1?(t.fn(x[r],0)-t.fn(x[l],0))/(2*spacing):(t.fn(x[l],0)-2*t.fn(x[j],0)+t.fn(x[r],0))/(spacing*spacing);
      y+=t.weight*v;
    }
    return y;
  });
}

function integrateSegment(rhs,run,initial,startIndex,endIndex,dt,substeps,maxMagnitude,continuousInput=null) {
  const states=[initial.slice()],h=dt/substeps;
  let x=initial.slice();
  function command(i,f) {
    if(continuousInput)return continuousInput.at(run.samples[i].time+f*dt);
    const a=run.samples[i].command,b=run.samples[i+1].command;
    return run.kind==='oscillator'?a+(b-a)*f:a.map((v,j)=>v+(b[j]-v)*f);
  }
  for(let i=startIndex;i<endIndex;i++) {
    for(let k=0;k<substeps;k++) {
      const a=rhs(x,command(i,k/substeps)),b=rhs(x.map((v,j)=>v+h*a[j]/2),command(i,(k+.5)/substeps));
      const c=rhs(x.map((v,j)=>v+h*b[j]/2),command(i,(k+.5)/substeps)),d=rhs(x.map((v,j)=>v+h*c[j]),command(i,(k+1)/substeps));
      x=x.map((v,j)=>v+h*(a[j]+2*b[j]+2*c[j]+d[j])/6);
      if(x.some(v=>!Number.isFinite(v)||Math.abs(v)>maxMagnitude))return null;
    }
    states.push(x.slice());
  }
  return states;
}

export function forecastStateTrajectory(model,run,{smoothingPoints=11,substeps=2,maxMagnitude=1e6,prepared=null,initialization='polynomial',prefixPoints=17}={}) {
  if(prepared){const owner=preparationSources.get(prepared);requireState(!!owner&&owner.run===run&&owner.signature===JSON.stringify(run),'Prepared trajectory belongs to a different or changed recording');}
  const p=prepared||prepareStateTrajectory(run,smoothingPoints),{n,dt}=p;
  requireState(model.kind===run.kind,'Model and observation geometries differ');
  requireState(Number.isInteger(substeps)&&substeps>=1&&substeps<=16&&p.length*n*substeps<=2097152,'Invalid forecast work budget');
  requireState(Number.isFinite(maxMagnitude)&&maxMagnitude>0,'Invalid state-domain bound');
  requireState(['polynomial','prefix-shooting'].includes(initialization),'Unknown forecast initialization');
  const rhs=modelPredictor(model,n,run.spacing);
  let startIndex=p.startIndex,initial=p.initial,prefix=null;
  if(initialization==='prefix-shooting') {
    requireState(Number.isInteger(prefixPoints)&&prefixPoints>=5&&prefixPoints<=33&&prefixPoints<p.length,'Invalid forecast prefix');
    requireState(prefixPoints*n*(1+4*(n+4))*substeps<=2097152,'Prefix forecast work budget exceeded');
    // Only these copied states enter optimization. Future commands remain legal
    // exogenous inputs; future measured states are read below for scoring only.
    const observations=run.samples.slice(0,prefixPoints).map(row=>row.state.slice());
    prefix=fitPrefixState(observations,
      x=>integrateSegment(rhs,run,x,0,prefixPoints-1,dt,substeps,maxMagnitude,p.continuousInput),
      {maxMagnitude});
    if(prefix.status!=='fitted')return {status:'diverged',reason:prefix.reason,startIndex:prefixPoints-1,states:null,prefix};
    initial=prefix.terminal;startIndex=prefixPoints-1;
  }
  const states=integrateSegment(rhs,run,initial,startIndex,p.length-1,dt,substeps,maxMagnitude,p.continuousInput);
  if(!states)return {status:'diverged',reason:'state_domain',startIndex,states:null,...(prefix?{prefix}:{})};
  let squared=0,signal=0,count=0;
  for(let i=1;i<states.length;i++)for(let j=0;j<n;j++) {
    const y=run.samples[startIndex+i].state[j];squared+=(states[i][j]-y)**2;signal+=y*y;count++;
  }
  return {status:'forecast',startIndex,states,rmse:Math.sqrt(squared/count),relativeRmse:Math.sqrt(squared/Math.max(signal,count*1e-8)),noiseSigma:p.noiseSigma,
    initialization:prefix?'trajectory fit to first '+prefixPoints+' noisy state samples only':'first '+p.points+' noisy state samples only',
    inputInterpolation:p.continuousInput?'declared continuous actuator law at every integration stage':'linear between recorded commands',...(prefix?{prefix,firstScored:prefixPoints,scoredValues:count}:{})};
}


/** Simulated design path from an explicitly supplied estimate; no observations,
 * exact initial-state oracle or trajectory resets enter this forward solve.
 */
export function simulateStateModel(model,{initialEstimate,step,steps,spacing,continuousInput,substeps=2,maxMagnitude=1e6}) {
  requireState(Array.isArray(initialEstimate)&&Array.from(initialEstimate).every(Number.isFinite),'Require a finite initial estimate');
  const n=initialEstimate.length;
  requireState(model.kind==='oscillator'?n===2:model.kind==='periodic'&&n>=6&&n<=128,'Invalid design state dimension');
  requireState(Number.isFinite(step)&&step>0&&Number.isInteger(steps)&&steps>=32&&steps<=4096&&Number.isFinite(step*steps),'Invalid design grid');
  requireState(Number.isInteger(substeps)&&substeps>=1&&substeps<=16&&steps*n*substeps<=2097152,'Design rollout work budget exceeded');
  requireState(Number.isFinite(maxMagnitude)&&maxMagnitude>0,'Invalid design state bound');
  if(model.kind==='periodic')requireState(Number.isFinite(spacing)&&spacing>0,'Require design spacing');
  const input=compileContinuousInput(continuousInput,model.kind,n);
  requireState(Math.abs(continuousInput.waveform.duration-step*steps)<=1e-10*Math.max(1,step*steps),'Design and waveform durations differ');
  requireState(step*input.maximumComponentFrequency<=1/8+1e-12,'Continuous input is unresolved on the declared sample grid');
  const start=continuousInput.startTime;
  requireState(Number.isFinite(start+step*steps)&&8*Number.EPSILON*Math.max(1,Math.abs(start),Math.abs(start+step*steps))<step/8,'Design timestamps lose interval precision');
  const run={kind:model.kind,samples:Array.from({length:steps+1},(_,i)=>({time:start+i*step}))};
  return integrateSegment(modelPredictor(model,n,spacing),run,initialEstimate,0,steps,step,substeps,maxMagnitude,input);
}
