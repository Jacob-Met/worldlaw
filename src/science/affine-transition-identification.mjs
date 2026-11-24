import {fitLinearColumns} from './linear-fit.mjs';
import {constantOscillatorFlow} from './affine-oscillator-flow.mjs';
import {EvolutionDomainError} from './operator-synthesis.mjs';

const variables=['position','rate','one','command'];
function modelFor(a,b,c,g){
  return {schema:'worldlaw.symbolic-evolution/v1',kind:'oscillator',
    terms:[a,b,c,g].map((weight,i)=>({tree:variables[i],weight}))};
}
function stepState(model,q,v,u,h){
  const course={step:h,steps:1,initial:[q,v],forcing:{amplitude:0,offset:u}};
  return constantOscillatorFlow(model,course,1)[1];
}
function need(ok,message){if(!ok)throw new RangeError(message);}
function solveAtCadence(rows,h,floor) {
  // Scale velocity by h so both rows of the fitted transition have position units.
  const columns=[rows.map(r=>r.q),rows.map(r=>r.v*h),rows.map(()=>1),rows.map(r=>r.u)];
  const q=fitLinearColumns(columns,rows.map(r=>r.next[0]));
  const p=fitLinearColumns(columns,rows.map(r=>r.next[1]*h));
  if(!q||!p)return {reason:'rank_deficient_transition'};
  const [q0,q1,qc,qu]=q.coefficients,[p0,p1,pc,pu]=p.coefficients;
  const norm=Math.max(1,Math.abs(q0),Math.abs(q1),Math.abs(p0),Math.abs(p1));
  const strength=Math.abs(q1)/norm, determinant=q0*p1-q1*p0;
  if(strength<=floor)return {reason:'unresolved_velocity_to_position',strength};
  if(!(determinant>floor*norm*norm))return {reason:'unresolved_transition_determinant',strength};
  const A=p0/q1,B=Math.log(determinant);
  if(!Number.isFinite(A)||!Number.isFinite(B))return {reason:'nonfinite_transition',strength};
  const [g0,g1]=stepState(modelFor(A,B,1,0),0,0,0,1);
  const scale=Math.max(Math.abs(g0),Math.abs(g1));
  if(!(scale>floor))return {reason:'unresolved_constant_drive',strength};
  const x=g0/scale,y=g1/scale,den=x*x+y*y;
  const amplitude=(a,b)=>(x*(a/scale)+y*(b/scale))/den;
  const continuous=modelFor((A/h)/h,B/h,(amplitude(qc,pc)/h)/h,(amplitude(qu,pu)/h)/h);
  if(!continuous.terms.every(t=>Number.isFinite(t.weight)))return {reason:'nonfinite_transition',strength};
  return {model:continuous,reason:'candidate',strength,determinant};
}

function replay(model,groups){
  const [a,b,c,g]=model.terms.map(t=>t.weight);
  const homogeneous=modelFor(a,b,0,0),bias=modelFor(a,b,c,0),actuator=modelFor(a,b,0,g);
  let maxPositionError=0,maxVelocityError=0;
  for(const [h,rows] of groups) {
    const x=stepState(homogeneous,1,0,0,h),v=stepState(homogeneous,0,1,0,h);
    const offset=stepState(bias,0,0,0,h),drive=stepState(actuator,0,0,1,h);
    for(const row of rows){
      const q=x[0]*row.q+v[0]*row.v+offset[0]+drive[0]*row.u;
      const p=x[1]*row.q+v[1]*row.v+offset[1]+drive[1]*row.u;
      if(!Number.isFinite(q)||!Number.isFinite(p))throw new EvolutionDomainError('nonfinite_trajectory');
      maxPositionError=Math.max(maxPositionError,Math.abs(q-row.next[0]));
      maxVelocityError=Math.max(maxVelocityError,Math.abs(p-row.next[1]));
    }
  }
  return {maxPositionError,maxVelocityError};
}

/** Recover the affine second-order generator from complete measured state
 * transitions under explicitly interval-held real commands, without derivatives. */
export function recoverAffineOscillator(runs,{positionTolerance,velocityTolerance,minimumRelativePivot=1e-8}) {
  need(Array.isArray(runs)&&runs.length>=1&&runs.length<=128,'Require bounded independent trajectories');
  need([positionTolerance,velocityTolerance].every(t=>Number.isFinite(t)&&t>=0),'Declare physical state tolerances');
  need(Number.isFinite(minimumRelativePivot)&&minimumRelativePivot>0&&minimumRelativePivot<1,'Declare a relative pivot in (0,1)');
  const groups=new Map(),ids=new Set();
  let count=0;
  for(const run of runs) {
    need(run&&typeof run.id==='string'&&run.id.length>0&&!ids.has(run.id),'Require distinct acquisition ids');
    ids.add(run.id);
    need(Number.isFinite(run.step)&&run.step>0&&Array.isArray(run.values)&&run.values.length>=2&&
      Array.isArray(run.intervalCommands)&&run.intervalCommands.length===run.values.length-1,'Require a uniform cadence and one held command per interval');
    need(run.values.every(row=>Array.isArray(row)&&row.length===2&&row.every(Number.isFinite))&&
      run.intervalCommands.every(Number.isFinite),'Require finite position, velocity and command observations');
    count+=run.intervalCommands.length;need(count<=4096,'Transition observation budget exceeded');
    if(!groups.has(run.step))groups.set(run.step,[]);
    for(let i=0;i<run.intervalCommands.length;i++)groups.get(run.step).push({id:run.id,i,
      q:run.values[i][0],v:run.values[i][1],u:run.intervalCommands[i],next:run.values[i+1]});
  }
  need(groups.size<=16,'Cadence budget exceeded');
  const diagnostics=[],candidates=[];
  for(const [step,rows] of groups) {
    let fit;
    try {fit=solveAtCadence(rows,step,minimumRelativePivot);}
    catch(error){if(!(error instanceof EvolutionDomainError))throw error;fit={reason:error.code};}
    const {model,...report}=fit;diagnostics.push({step,...report});
    if(model)candidates.push({step,model,strength:report.strength});
  }
  if(!candidates.length)return {status:'unidentified',reason:'no_identifying_cadence',model:null,diagnostics};
  candidates.sort((a,b)=>b.strength-a.strength||a.step-b.step);
  let mismatch=null,failure=null;
  for(const {model,step} of candidates) {
    let errors;
    try{errors=replay(model,groups);}
    catch(error){if(!(error instanceof EvolutionDomainError))throw error;failure=error.code;continue;}
    if(errors.maxPositionError<=positionTolerance&&errors.maxVelocityError<=velocityTolerance)
      return {status:'candidate',reason:'within_transition_tolerances',model,selectedCadence:step,...errors,diagnostics};
    if(!mismatch)mismatch={selectedCadence:step,...errors};
  }
  return mismatch?{status:'abstained',reason:'transition_mismatch',model:null,...mismatch,diagnostics}:
    {status:'unidentified',reason:failure,model:null,diagnostics};
}
