import {cycleExample} from './core.mjs';
import {REFINEMENT_SCHEMA,BRANCH_ASSUMPTION,planRefinement} from './refinement.mjs';
export function refinementExample(kind='branch'){
 if(!['branch','conservative','false-curvature'].includes(kind))throw Error('Unknown authored refinement control.');
 const cycle=cycleExample('quadrature'),positions=[0,1,2,2,.5,0];
 cycle.source='Authored analytic '+kind+' control; declared floating-evaluation radius; not physical acquisition';
 cycle.samples=positions.map((position,i)=>({position,jointTorque:position**2+(kind==='branch'?(i<=2?.1:-.1):0),torqueRadius:8*Number.EPSILON*Math.max(1,Math.abs(position**2+(kind==='branch'?(i<=2?.1:-.1):0)))}));
 const curvature=cycle.samples.slice(1).map((s,i)=>s.position===cycle.samples[i].position?{segment:i,kind:'zero-angle-jump'}:{segment:i,kind:'bounded-curvature',assumption:BRANCH_ASSUMPTION,maxSecondDerivative:kind==='false-curvature'?1:2,source:kind==='false-curvature'?'Deliberately false M=1 for the analytic theta-squared response':'Authored analytic second derivative = 2; not inferred from the readings'});
 return {schema:REFINEMENT_SCHEMA,request:{cycle,curvature,budget:12},acquisition:null};
}
// The authored receiver evaluates a separate analytic response at each request.
// It never interpolates endpoint torques, and accepts only its own exact fixture.
export function receiveAuthoredRefinement(raw,kind='branch'){
 const fixture=refinementExample(kind);
 if(JSON.stringify(raw.request)!==JSON.stringify(fixture.request))throw Error('Authored acquisition is available only for the unchanged matching analytic control.');
 const plan=planRefinement(raw.request.cycle,raw.request.curvature,raw.request.budget);
 return {...raw,acquisition:{request:plan.request,branchAssumption:'same-directed-response-branch-as-original-endpoints',readings:plan.requests.map((p,i)=>({...p,id:'authored-'+i,source:'Independent analytic evaluation of declared '+kind+' control with declared floating-evaluation radius; simulated, not measured',jointTorque:p.position**2+(kind==='branch'?(p.segment<2?.1:-.1):0),torqueRadius:8*Number.EPSILON*Math.max(1,Math.abs(p.position**2+(kind==='branch'?(p.segment<2?.1:-.1):0)))}))}};
}
