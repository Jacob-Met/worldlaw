import {predictEvolution,EvolutionDomainError} from './operator-synthesis.mjs';
import {constantOscillatorFlow} from './affine-oscillator-flow.mjs';
import {periodicLinearPlan,onAlternatingOrbit} from './periodic-linear-flow.mjs';

import {periodicSemilinearPlan} from './periodic-semilinear-flow.mjs';

import {periodicStateRow} from './periodic-state-row.mjs';

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
function periodicTrajectoryPlan(model,course) {
  const restricted=onAlternatingOrbit(model,course);
  return periodicLinearPlan(restricted,course) ?? periodicSemilinearPlan(restricted,course,drive);
}
function derivative(model,course,t,x) {
  if(!x.every(Number.isFinite)) throw new EvolutionDomainError('nonfinite_trajectory');
  if(model.kind==='oscillator')
    return [x[1],predictEvolution(model,{position:x[0],rate:x[1],command:drive(course,t,null)})];
  return x.map((_,j)=>predictEvolution(model,periodicStateRow(x,j,course.spacing,drive(course,t,j,x.length))));
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
  let scaledSquares=0,maxError=0,n=0;
  for(let t=0;t<a.length;t++){
    need(Array.isArray(b[t])&&b[t].length===a[t].length&&b[t].every(Number.isFinite),'Incompatible measured states');
    for(let j=0;j<a[t].length;j++){
      const e=Math.abs(a[t][j]-b[t][j]);
      if(!Number.isFinite(e))throw new EvolutionDomainError('nonfinite_trajectory_error');
      if(e>maxError) {
        scaledSquares=scaledSquares*(maxError/e)**2+1;
        maxError=e;
      } else if(e>0) scaledSquares+=(e/maxError)**2;
      n++;
    }
  }
  return {rmse:maxError*Math.sqrt(scaledSquares/n),maxError};
}

/** Score only simulated observations on the declared finite menu. Resolution is
 * an absolute RMS threshold in the supplied channels' units, not a significance test.
 * Pair indices always refer to the original, unmodified model roster.
 */
export function designEvolutionExcitation(models, courses, {resolution=0, observedIndices=null}={}) {
  need(Array.isArray(models)&&models.length>=2&&models.length<=16&&models.every(m=>m.kind===models[0].kind),'Require 2–16 comparable models');
  need(Array.isArray(courses)&&courses.length>0&&courses.length<=32&&new Set(courses.map(c=>c.id)).size===courses.length,'Invalid excitation menu');
  need(Number.isFinite(resolution)&&resolution>=0,'Invalid observation resolution');
  if(observedIndices!==null) {
    need(Array.isArray(observedIndices)&&observedIndices.length>0&&new Set(observedIndices).size===observedIndices.length&&
      Array.from(observedIndices).every(j=>Number.isInteger(j)&&j>=0),'Invalid observed state indices');
  }
  let work=0,rolloutWork=0;
  for(const c of courses){
    admit(models[0].kind,c);
    need(observedIndices===null||observedIndices.every(j=>j<c.initial.length),'Observed channel outside course state');
    work+=c.steps*c.initial.length*models.length**2;
    need(work<=2000000,'Excitation menu exceeds comparison budget');
  }
  const pairs=[];
  for(let b=1;b<models.length;b++)for(let a=0;a<b;a++)pairs.push([a,b]);
  const excluded=[], scores=[];
  for(const c of courses){
    try {
      const {required,allowed}=forcingResolution(c);
      const plans=models.map(model=>periodicTrajectoryPlan(model,c));
      const substeps=Math.max(required,...plans.map(p=>p?.minimumSubsteps??1));
      if(substeps>allowed)throw new EvolutionDomainError('semilinear_mixing_budget');
      const cost=plans.reduce((sum,plan)=>sum+(plan?plan.work(substeps):c.steps*c.initial.length*substeps),0);
      if(plans.some(Boolean)&&cost>2000000)throw new EvolutionDomainError('periodic_transition_budget');
      rolloutWork+=cost;
      need(rolloutWork<=2000000,'Excitation menu exceeds rollout budget');
      const paths=models.map((model,index)=>{
        const path=plans[index]?.run(substeps) ?? constantOscillatorFlow(model,c,substeps) ?? rolloutEvolution(model,c,substeps);
        return observedIndices===null?path:path.map(state=>observedIndices.map(j=>state[j]));
      });
      scores.push({id:c.id,substeps,gaps:pairs.map(([a,b])=>distance(paths[a],paths[b]).rmse)});
    } catch(err) {
      if(!(err instanceof EvolutionDomainError))throw err;
      excluded.push({id:c.id,reason:err.code});
    }
  }
  if(!scores.length)return {status:'no_admissible_course',selected:null,ranked:[],excluded};

  // Threshold proximity is not transitive. Group mutually unresolved models
  // only when they also have the same unresolved neighbors across the menu.
  const neighbors=models.map((_,i)=>new Set([i]));
  const unresolvedPairs=pairs.filter(([a,b],p)=>{
    if(scores.some(course=>course.gaps[p]>resolution))return false;
    neighbors[a].add(b);
    neighbors[b].add(a);
    return true;
  });
  const byNeighbors=new Map();
  const groups=[],membership=[];
  for(const [i,neighborsOfModel] of neighbors.entries()){
    const key=[...neighborsOfModel].sort((a,b)=>a-b).join(',');
    if(!byNeighbors.has(key)){byNeighbors.set(key,groups.length);groups.push([]);}
    const group=byNeighbors.get(key);
    groups[group].push(i);
    membership.push(group);
  }

  const classPairs=new Map();
  for(const [p,[a,b]] of pairs.entries()){
    const x=membership[a],y=membership[b];
    if(x===y)continue;
    const key=Math.min(x,y)+','+Math.max(x,y);
    if(!classPairs.has(key))classPairs.set(key,[]);
    classPairs.get(key).push(p);
  }
  // A class pair is separable on a course only when *all* its member pairs
  // clear the threshold there. Identical copies cannot inflate the score.
  const classGaps=scores.map(({gaps})=>[...classPairs.values()].map(indices=>Math.min(...indices.map(p=>gaps[p]))));
  const reachable=classGaps[0].map((_,i)=>i).filter(i=>classGaps.some(row=>row[i]>resolution));
  const ranked=scores.map(({id,gaps,substeps},i)=>{
    const minimumSeparation=Math.min(...gaps);
    const attainable=reachable.map(j=>classGaps[i][j]);
    const partlySeparatedClassPairs=[...classPairs.values()].filter(indices=>indices.some(p=>gaps[p]>resolution)).length;
    return {id,substeps,minimumSeparation,closestPair:pairs[gaps.indexOf(minimumSeparation)],
      separatedClassPairs:attainable.filter(g=>g>resolution).length,partlySeparatedClassPairs,
      betweenClassSeparation:attainable.length?Math.min(...attainable):0};
  }).sort((a,b)=>b.separatedClassPairs-a.separatedClassPairs||b.betweenClassSeparation-a.betweenClassSeparation||b.partlySeparatedClassPairs-a.partlySeparatedClassPairs);
  const selected=ranked[0].id;
  const selectedGaps=scores.find(c=>c.id===selected).gaps;
  const selectedUnresolvedPairs=pairs.filter((_,i)=>selectedGaps[i]<=resolution);
  const status=!selectedUnresolvedPairs.length?'separating_in_simulation':
    ranked[0].partlySeparatedClassPairs?'partially_separating_in_simulation':'indistinguishable_on_menu';
  return {status,selected,ranked,excluded,groups,unresolvedPairs,selectedUnresolvedPairs,resolution,observedIndices};
}

export function verifyEvolutionRollout(model,course,observations,{maxError,resolutionTolerance}) {
  need([maxError,resolutionTolerance].every(x=>Number.isFinite(x)&&x>=0),'Declare finite rollout tolerances');
  let resolution,held;
  try {
    admit(model.kind,course);
    const {required,allowed}=forcingResolution(course);
    const plan=periodicTrajectoryPlan(model,course);
    const minimum=Math.max(required,plan?.minimumSubsteps??1);
    if(minimum>allowed)throw new EvolutionDomainError('semilinear_mixing_budget');
    const fineSteps=Math.min(2*minimum,allowed);
    const coarseSteps=Math.floor(fineSteps/2);
    if(plan&&plan.work(coarseSteps)+plan.work(fineSteps)>2000000)throw new EvolutionDomainError('periodic_transition_budget');
    const flow=steps=>plan?.run(steps) ?? constantOscillatorFlow(model,course,steps) ?? rolloutEvolution(model,course,steps);
    const coarse=flow(coarseSteps),fine=flow(fineSteps);
    resolution=distance(coarse,fine);held=distance(fine,observations);
  }
  catch(err) {
    if(!(err instanceof EvolutionDomainError))throw err;
    return {accepted:false,reason:err.code,resolution:null,held:null};
  }
  const reason=resolution.maxError>resolutionTolerance?'resolution_failure':held.maxError>maxError?'trajectory_mismatch':'within_tolerance';
  return {accepted:reason==='within_tolerance',reason,resolution,held};
}
