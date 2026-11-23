import {predictEvolution,EvolutionDomainError} from './operator-synthesis.mjs';

function need(ok,reason){if(!ok)throw new RangeError(reason);}
function admit(kind,course) {
  need(course && typeof course.id==='string' && course.id.length>0 && course.id.length<=160,'Declare a course id');
  const {initial,step,steps,forcing}=course;
  need(Array.isArray(initial)&&initial.every(Number.isFinite)&&
    (kind==='oscillator'?initial.length===2:kind==='periodic'&&initial.length>=3&&initial.length<=128),'Invalid initial state');
  need(Number.isFinite(step)&&step>0&&Number.isInteger(steps)&&steps>=1&&steps<=4096&&Number.isFinite(step*steps),'Invalid time grid');
  need(forcing&&['offset','amplitude','startFrequency','endFrequency'].every(k=>Number.isFinite(forcing[k])) &&
    forcing.startFrequency>=0&&forcing.endFrequency>=0,'Declare finite chirp parameters');
  if(kind==='periodic')need(Number.isFinite(course.spacing)&&course.spacing>0&&Number.isInteger(forcing.spatialMode)&&
    forcing.spatialMode>=0&&forcing.spatialMode<=Math.floor(initial.length/2),'Invalid periodic forcing grid');
  need(steps*initial.length<=65536,'Rollout exceeds the state budget');
  return course;
}
// A linear chirp reaches its maximum instantaneous frequency at one endpoint.
// Resolve the commanded waveform before using simulated differences to select a course.
function forcingResolution(course) {
  const f=course.forcing;
  const cyclesPerStep=f.amplitude===0?0:course.step*Math.max(f.startFrequency,f.endFrequency);
  const required=Math.max(1,Math.ceil(8*cyclesPerStep));
  const allowed=Math.min(16,Math.floor(262144/(course.steps*course.initial.length)));
  if(required>allowed)throw new EvolutionDomainError('forcing_resolution_budget');
  return {required,allowed};
}
function drive(course,t,j,n) {
  const f=course.forcing,duration=course.step*course.steps;
  if(f.amplitude===0)return f.offset;
  const cycles=f.startFrequency*t+(f.endFrequency-f.startFrequency)*t*(t/duration)/2;
  const spatial=j===null?1:Math.cos(2*Math.PI*f.spatialMode*j/n);
  return f.offset+f.amplitude*spatial*Math.sin(2*Math.PI*cycles);
}
function derivative(model,course,t,x) {
  if(!x.every(Number.isFinite)) throw new EvolutionDomainError('nonfinite_trajectory');
  if(model.kind==='oscillator')
    return [x[1],predictEvolution(model,{position:x[0],rate:x[1],command:drive(course,t,null)})];
  return x.map((field,j)=>predictEvolution(model,{field,left:x[(j+x.length-1)%x.length],right:x[(j+1)%x.length],
    spacing:course.spacing,command:drive(course,t,j,x.length)}));
}
function advance(x,s,d){return x.map((v,j)=>v+s*d[j]);}

/** Fourth-order explicit rollout on the declared grid; stability is checked on that course. */
export function rolloutEvolution(model, experiment, substeps=1) {
  const course=admit(model.kind,experiment);
  need(Number.isInteger(substeps)&&substeps>=1&&substeps<=16&&
    substeps*course.steps*course.initial.length<=262144,'Invalid rollout refinement');
  let x=[...course.initial];const states=[[...x]],h=course.step/substeps;
  for(let i=0;i<course.steps;i++){
    for(let j=0;j<substeps;j++){
      const t=(i+j/substeps)*course.step;
      const k1=derivative(model,course,t,x),k2=derivative(model,course,t+h/2,advance(x,h/2,k1));
      const k3=derivative(model,course,t+h/2,advance(x,h/2,k2)),k4=derivative(model,course,t+h,advance(x,h,k3));
      x=x.map((v,a)=>v+h*(k1[a]+2*k2[a]+2*k3[a]+k4[a])/6);
      if(!x.every(Number.isFinite)) throw new EvolutionDomainError('nonfinite_trajectory');
    }
    states.push([...x]);
  }
  return states;
}
function distance(a,b) {
  need(Array.isArray(b)&&a.length===b.length,'Incompatible trajectory length');
  let squared=0,maxError=0,n=0;
  for(let t=0;t<a.length;t++){
    need(Array.isArray(b[t])&&b[t].length===a[t].length&&b[t].every(Number.isFinite),'Incompatible measured states');
    for(let j=0;j<a[t].length;j++){
      const e=Math.abs(a[t][j]-b[t][j]);maxError=Math.max(maxError,e);squared+=e*e;n++;
    }
  }
  need(Number.isFinite(squared),'Nonfinite trajectory error');
  return {rmse:Math.sqrt(squared/n),maxError};
}

/** The objective uses only candidate forward predictions; no measured challenge state is accepted. */
export function designEvolutionExcitation(models, courses) {
  need(Array.isArray(models)&&models.length>=2&&models.length<=16&&models.every(m=>m.kind===models[0].kind),'Require 2–16 comparable models');
  need(Array.isArray(courses)&&courses.length>0&&courses.length<=32&&new Set(courses.map(c=>c.id)).size===courses.length,'Invalid excitation menu');
  let work=0,rolloutWork=0;
  for(const c of courses){
    admit(models[0].kind,c);work+=c.steps*c.initial.length*models.length**2;
    need(work<=2000000,'Excitation menu exceeds comparison budget');
  }
  const excluded=[];
  const ranked=courses.flatMap(c=>{
    let paths,substeps;
    try {
      substeps=forcingResolution(c).required;
      rolloutWork+=c.steps*c.initial.length*models.length*substeps;
      need(rolloutWork<=2000000,'Excitation menu exceeds rollout budget');
      paths=models.map(model=>rolloutEvolution(model,c,substeps));
    }
    catch(err) {
      if(!(err instanceof EvolutionDomainError))throw err;
      excluded.push({id:c.id,reason:err.code});return [];
    }
    let minimumSeparation=Infinity,pair;
    for(let a=0;a<paths.length;a++)for(let b=0;b<a;b++){
      const d=distance(paths[a],paths[b]).rmse;
      if(d<minimumSeparation){minimumSeparation=d;pair=[b,a];}
    }
    return [{id:c.id,minimumSeparation,closestPair:pair,substeps}];
  }).sort((a,b)=>b.minimumSeparation-a.minimumSeparation);
  if(!ranked.length)return {status:'no_admissible_course',selected:null,ranked,excluded};
  return {status:ranked[0].minimumSeparation>0?'separating_in_simulation':'indistinguishable_on_menu',
    selected:ranked[0].id,ranked,excluded};
}

export function verifyEvolutionRollout(model,course,observations,{maxError,resolutionTolerance}) {
  need([maxError,resolutionTolerance].every(x=>Number.isFinite(x)&&x>=0),'Declare finite rollout tolerances');
  let coarse,fine;
  try {
    admit(model.kind,course);
    const {required,allowed}=forcingResolution(course);
    const fineSteps=Math.min(2*required,allowed);
    coarse=rolloutEvolution(model,course,Math.floor(fineSteps/2));
    fine=rolloutEvolution(model,course,fineSteps);
  }
  catch(err) {
    if(!(err instanceof EvolutionDomainError))throw err;
    return {accepted:false,reason:err.code,resolution:null,held:null};
  }
  const resolution=distance(coarse,fine),held=distance(fine,observations);
  const reason=resolution.maxError>resolutionTolerance?'resolution_failure':held.maxError>maxError?'trajectory_mismatch':'within_tolerance';
  return {accepted:reason==='within_tolerance',reason,resolution,held};
}
