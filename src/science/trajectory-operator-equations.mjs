import {compileStateTree,prepareStateTrajectory,validateStateTrajectory,requireState} from './state-trajectory.mjs';

// Response-independent, bounded compositional grammar shared by all estimators.
export function trajectoryOperatorGrammar(kind,{degree=3,unary=['sin','cos','tanh','abs'],rational=true,flux=true}={}) {
  requireState(['oscillator','periodic'].includes(kind),'Invalid operator geometry');
  requireState(Number.isInteger(degree)&&degree>=1&&degree<=3,'Invalid polynomial degree');
  requireState(Array.isArray(unary)&&new Set(unary).size===unary.length&&unary.every(x=>['sin','cos','tanh','abs'].includes(x)),'Invalid unary grammar');
  const atoms=kind==='oscillator'?['position','rate','command']:['field','command'],bank=new Map();
  const add=t=>bank.set(JSON.stringify(t),t);
  add('one');
  function products(factors,start,left) {
    if(!left){add(factors.reduce((a,b)=>a?['mul',a,b]:b,null));return;}
    for(let j=start;j<atoms.length;j++)products([...factors,atoms[j]],j,left-1);
  }
  for(let d=1;d<=degree;d++)products([],0,d);
  for(const op of unary)for(const a of atoms){add([op,a]);for(const b of atoms)add(['mul',b,[op,a]]);}
  if(rational)for(const a of atoms)add(['div',a,['add','one',['mul',a,a]]]);
  if(kind==='periodic'&&flux) {
    const fieldOnly=t=>typeof t==='string'?t==='field'||t==='one':t.slice(1).every(fieldOnly);
    for(const t of [...bank.values()])if(t!=='one'&&fieldOnly(t))for(const op of ['dx','dxx'])add([op,t]);
  }
  requireState(bank.size<=256,'Operator grammar exceeds its budget');
  return [...bank.values()];
}

export function temporalTestWeights(points,dt) {
  requireState(Number.isInteger(points)&&points>=9&&points%2===1&&Number.isFinite(dt)&&dt>0,'Invalid compact temporal test');
  const half=(points-1)/2,phi=[],derivative=[];
  for(let j=0;j<points;j++) {
    const x=(j-half)/half,base=Math.max(0,1-x*x);
    phi.push(base**4);derivative.push(8*x*base**3/(half*dt));
  }
  const scale=phi.reduce((s,v)=>s+v,0);
  return {value:phi.map(v=>v/scale),target:derivative.map(v=>v/scale)};
}

// Exact adjoints of periodic central-difference stencils. The identity holds
// for arbitrary arrays; continuum product-rule equivalence is not presumed.
export function spatialTestWeights(n,center,radius,h,order=0) {
  requireState(Number.isInteger(n)&&n>=6&&Number.isInteger(center)&&center>=0&&center<n&&Number.isInteger(radius)&&radius>=2&&2*radius<n&&Number.isFinite(h)&&h>0&&[0,1,2].includes(order),'Invalid spatial test');
  const w=new Float64Array(n);let sum=0;
  for(let j=-radius;j<=radius;j++){const v=(1-(j/radius)**2)**4;w[(center+j+n)%n]+=v;sum+=v;}
  for(let j=0;j<n;j++)w[j]/=sum;
  if(!order)return w;
  return Float64Array.from(w,(_,j)=>order===1?-(w[(j+1)%n]-w[(j+n-1)%n])/(2*h):(w[(j+n-1)%n]-2*w[j]+w[(j+1)%n])/(h*h));
}

export function filterPeriodicObservation(a) {
  return Float64Array.from(a,(_,j)=>(a[(j+a.length-2)%a.length]+4*a[(j+a.length-1)%a.length]+6*a[j]+4*a[(j+1)%a.length]+a[(j+2)%a.length])/16);
}

export function stateOperatorEquations(recordings,trees,{method='weak',smoothingPoints=11,windowPoints=61,stride=15,spatialRadius=4,spatialStride=4}={}) {
  requireState(['weak','derivative'].includes(method),'Invalid trajectory equation method');
  requireState(Array.isArray(recordings)&&recordings.length>=1&&recordings.length<=6,'Require one to six fitting recordings');
  requireState(new Set(recordings.map(r=>r.id)).size===recordings.length,'Duplicate recording identity');
  requireState(Number.isInteger(windowPoints)&&windowPoints>=9&&windowPoints<=129&&windowPoints%2===1&&Number.isInteger(stride)&&stride>=1&&stride<=windowPoints,'Invalid weak window schedule');
  requireState(Number.isInteger(spatialStride)&&spatialStride>=1&&spatialStride<=16,'Invalid spatial stride');
  requireState(Array.isArray(trees)&&trees.length>=1&&trees.length<=256,'Invalid expression bank');
  const kind=recordings[0].kind,compiled=trees.map(t=>compileStateTree(t,kind)),columns=trees.map(()=>[]),target=[],coverage=[];
  requireState(compiled.every(c=>!c.requiresPointwise),'Weak trajectory fitting requires complete conservative fluxes, not pointwise derivative products');
  let observed=0,equations=0,reductionWork=0;
  // Reject excessive work before allocating feature arrays or smoothing samples.
  for(const run of recordings) {
    requireState(run.kind===kind,'Mixed fitting geometries');
    const p=validateStateTrajectory(run);observed+=p.n*p.length;
    const centers=kind==='periodic'?Math.ceil(p.n/spatialStride):1;
    const rows=Math.max(0,Math.floor((p.length-windowPoints)/stride)+1)*centers;
    equations+=rows;
    reductionWork+=rows*(method==='weak'?windowPoints:1)*trees.length*(kind==='periodic'?p.n:1);
    requireState(p.length>=windowPoints,'Recording is shorter than a complete test window');
    requireState(trees.length*p.length*p.n<=16777216,'Operator feature storage budget exceeded');
  }
  requireState(observed<=262144&&equations<=4096&&reductionWork<=200000000,'Trajectory equation work budget exceeded');
  for(const run of recordings) {
    const p=prepareStateTrajectory(run,smoothingPoints),{n,length,dt}=p;
    // Apply one linear observation operator AFTER each complete nonlinear
    // expression, and to the target. H(f(u)) is generally not f(H(u)).
    const features=compiled.map(({fn})=>p.states.map((state,t)=>kind==='oscillator'?Float64Array.of(fn(state,run.samples[t].command)):filterPeriodicObservation(Float64Array.from(state,(v,j)=>fn(v,run.samples[t].command[j])))));
    const observedStates=kind==='periodic'?run.samples.map(r=>filterPeriodicObservation(r.state)):null;
    const derivatives=kind==='periodic'?p.derivatives.map(filterPeriodicObservation):p.derivatives;
    requireState(features.every(c=>c.every(a=>a.every(Number.isFinite))),'Operator undefined on a fitting observation');
    const centers=kind==='oscillator'?[0]:Array.from({length:Math.ceil(n/spatialStride)},(_,j)=>j*spatialStride);
    const kernels=kind==='periodic'?centers.map(j=>[0,1,2].map(order=>spatialTestWeights(n,j,spatialRadius,run.spacing,order))):null;
    const tw=temporalTestWeights(windowPoints,dt),half=(windowPoints-1)/2;
    const dot=(a,b)=>a.reduce((s,v,j)=>s+v*b[j],0);
    let rows=0;
    for(let start=0;start+windowPoints<=length;start+=stride)for(let ci=0;ci<centers.length;ci++) {
      const center=centers[ci],t=start+half;
      if(method==='weak') {
        let y=0;const vals=trees.map(()=>0);
        for(let k=0;k<windowPoints;k++) {
          const at=start+k;
          y+=tw.target[k]*(kind==='oscillator'?run.samples[at].state[1]:dot(kernels[ci][0],observedStates[at]));
          for(let j=0;j<trees.length;j++)vals[j]+=tw.value[k]*(kind==='oscillator'?features[j][at][0]:dot(kernels[ci][compiled[j].order],features[j][at]));
        }
        target.push(y);for(let j=0;j<trees.length;j++)columns[j].push(vals[j]);
      } else {
        target.push(derivatives[t][kind==='oscillator'?1:center]);
        for(let j=0;j<trees.length;j++) {
          const a=features[j][t],order=compiled[j].order,l=(center+n-1)%n,r=(center+1)%n;
          columns[j].push(kind==='oscillator'?a[0]:order===0?a[center]:order===1?(a[r]-a[l])/(2*run.spacing):(a[l]-2*a[center]+a[r])/(run.spacing**2));
        }
      }
      rows++;requireState(target.length<=4096,'Weak equation budget exceeded');
    }
    coverage.push({id:run.id,samples:length,stateValues:length*n,equations:rows,noiseSigma:p.noiseSigma});
  }
  requireState(target.length>=12&&target.every(Number.isFinite)&&columns.every(c=>c.every(Number.isFinite)),'Insufficient or nonfinite trajectory equations');
  return {kind,trees,columns,target,coverage,method,reductionWork};
}
