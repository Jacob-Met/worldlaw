/** Evaluator-only adapter for the frozen Nullgarden producer.
 * It substitutes the commanded actuator at every native midpoint stage while
 * preserving every equation, hidden state, history, integrator and noise draw.
 */
import {compileContinuousInput} from '../src/science/continuous-input.mjs';
const need=(ok,message)=>{if(!ok)throw new RangeError(message);};
export function observeWithActuator(producer,world,plan,snrDb,seed,commandAt,
  {sequence,continuousInput=null,stageRecorder=null,substeps=24}={}) {
  need(typeof commandAt==='function'&&typeof producer.observeStateOperatorWorld==='function','Require the pinned observation producer and actuator');
  need(Number.isSafeInteger(sequence)&&sequence>=0,'Require an acquisition sequence allocated independently of the world');
  const observationId='acquisition-'+sequence;
  const frozenInput=continuousInput?structuredClone(continuousInput):null;
  const n=plan.initial.length,declared=frozenInput?compileContinuousInput(frozenInput,world.kind,n):null;
  if(declared)need(frozenInput.startTime===0&&Math.abs(frozenInput.waveform.duration-plan.step*plan.steps)<=1e-10&&plan.step*declared.maximumComponentFrequency<=1/8+1e-12,'Applied input does not match the producer grid');
  const at=time=>{
    const command=commandAt(time);
    need(world.kind==='oscillator'?Number.isFinite(command):
      Array.isArray(command)&&command.length===n&&command.every(Number.isFinite),'Invalid applied command');
    if(declared){const expected=declared.at(time);need(world.kind==='oscillator'?command===expected:command.every((v,j)=>v===expected[j]),'Applied stage command disagrees with declared continuous input');}
    return world.kind==='oscillator'?command:Object.freeze(command.slice());
  };
  const wrapped={...world,rhs:(state,_stockCommand,spacing,time,past)=>{
    const applied=at(time);
    if(stageRecorder)stageRecorder(time,applied);
    return world.rhs(state,applied,spacing,time,past);
  }};
  const record=producer.observeStateOperatorWorld(wrapped,plan,snrDb,seed,{substeps});
  record.observation.id=observationId;
  record.observation.samples.forEach(row=>{row.command=at(row.time);});
  if(frozenInput)record.observation.continuousInput=structuredClone(frozenInput);
  return {...record,appliedActuator:{schema:'worldlaw.external-actuator-adapter/v1',
    producer:'Jacob-Met/nullgarden',expectedCommit:'c8dfb73b3990d4737171aca83a1397529116ca23',
    input:frozenInput?structuredClone(frozenInput):null,
    note:'reference.plan remains the original producer plan; applied input is declared separately.'}};
}
export function observeWithContinuousInput(producer,world,plan,snrDb,seed,input,options={}) {
  const frozen=structuredClone(input),compiled=compileContinuousInput(frozen,world.kind,plan.initial.length);
  need(frozen.startTime===0&&Math.abs(frozen.waveform.duration-plan.step*plan.steps)<=1e-10,'Applied input and producer intervals differ');
  need(plan.step*compiled.maximumComponentFrequency<=1/8+1e-12,'Applied input is unresolved on the observation grid');
  return observeWithActuator(producer,world,plan,snrDb,seed,compiled.at,{...options,continuousInput:frozen});
}
