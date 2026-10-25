import {createInertiaExample} from './inertia-example.mjs';
import {createInertiaCounterexample} from './inertia-counterexample.mjs';
import {INERTIA_CHALLENGE_SCHEMA} from './inertia-challenge.mjs';

/** Authored independent analytic motions, not separately acquired measurements. */
export function createInertiaChallengeExample({omittedForce=false}={}){
 const mass=omittedForce?[2,.3,1.5]:[1.4,.4,1.4],damping=omittedForce?[.2,.4]:[.2,.2],spring=omittedForce?[.5,.8]:[0,0];
 const rows=Array.from({length:801},(_,i)=>{
  const time=6*i/800,position=[Math.sin(2*time+.31),Math.cos(time-.27)],velocity=[2*Math.cos(2*time+.31),-Math.sin(time-.27)],acceleration=[-4*position[0],-position[1]];
  return {time,position,torque:[mass[0]*acceleration[0]+mass[1]*acceleration[1]+damping[0]*velocity[0]+spring[0]*position[0],mass[1]*acceleration[0]+mass[2]*acceleration[1]+damping[1]*velocity[1]+spring[1]*position[1]]};
 });
 const training=omittedForce?createInertiaCounterexample():createInertiaExample();
 const challenge={schema:'worldlaw.coupled-inertia-observations/v1',units:{time:'s',position:'rad',torque:'N·m'},interpretation:'constant-symmetric-inertia-with-diagonal-viscous-loss',
  torqueDeclaration:omittedForce?'Authored actuator torque intentionally omits restoring torque -Kq from the complete RHS. K=[0.5,0.8]; both training and challenge share this omission.':'Authored complete RHS torque for unchanged inertia and damping. No physical calibration or independent acquisition is claimed.',
  source:{label:omittedForce?'Authored changed-frequency missing-force challenge':'Authored changed-motion complete-force challenge',description:`Analytic verification, not a recording. Known true M=${JSON.stringify(mass)}, D=${JSON.stringify(damping)}; q=[sin(2t+0.31),cos(t-0.27)]. Changed imposed motion challenges frozen training coefficients. ${omittedForce?'Training frequencies [1,2] conceal restoring stiffness as effective M=[[1.5,0.3],[0.3,1.3]]. Challenge frequencies [2,1] expose that alias.':'The known mechanical constants are unchanged from the analytic two-mode reference.'}`},courses:[{id:'authored-challenge-motion',rows}]};
 return {schema:INERTIA_CHALLENGE_SCHEMA,training:{record:training,settings:{windowSamples:81,stride:40}},challenge,
  settings:{windowSamples:81,stride:40,toleranceNm:[.01,.01],correspondence:'Authored analytic control: same declared physical M and D, coordinate order/sign, seconds/radians and conjugate torque conventions. Different imposed motion; no independent physical acquisition is claimed.'}};
}
