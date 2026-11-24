import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {observeWithActuator,observeWithContinuousInput} from './continuous-input-adapter.mjs';
import {validateStateTrajectory} from '../src/science/state-trajectory.mjs';
const source=resolve(process.env.NULLGARDEN_SOURCE||'.independent-state-nullgarden');
const producer=await import(pathToFileURL(join(source,'src/state-operator-course.mjs')).href);
const expected='c8dfb73b3990d4737171aca83a1397529116ca23';
const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim();
assert.equal(commit,expected,'Frozen producer commit');
const output=resolve(process.argv[2]||'.receipts/continuous-input');mkdirSync(output,{recursive:true});
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function trace() {
  const digest=createHash('sha256');let count=0;
  return {record:(t,u)=>{digest.update(JSON.stringify([t,u])+'\n');count++;},finish:()=>({count,sha256:digest.digest('hex')})};
}
function stockInput(world,plan,t) {
  const f=plan.forcing,total=plan.step*plan.steps;
  const phase=2*Math.PI*(f.startFrequency*t+.5*(f.endFrequency-f.startFrequency)*t*t/total);
  const u=f.offset+f.amplitude*Math.sin(phase);
  return world.kind==='oscillator'?u:plan.initial.map((_,j)=>u*Math.cos(2*Math.PI*j/plan.initial.length));
}
const report={schema:'worldlaw.continuous-input-parity/v1',producer:commit,node:process.version,
  scope:'Input-interface parity and integration checks only; no discovery or held-cohort qualification score.',rows:[],status:'running'};
try {
  const worlds=[...producer.stateOperatorWorlds('development'),...producer.stateOperatorWorlds('evaluation'),...producer.outsideStateOperatorWorlds()];
  for(const [i,world] of worlds.entries())for(const snr of [40,25,15]){
    const plan=producer.stateOperatorPlan(world.kind,'query',0),a=trace(),b=trace(),id='opaque-'+i+'-'+snr;
    const original=producer.observeStateOperatorWorld({...world,rhs:(state,u,h,t,past)=>{a.record(t,u);return world.rhs(state,u,h,t,past);}},plan,snr,709901+i,{substeps:24});
    const adapted=observeWithActuator(producer,world,plan,snr,709901+i,t=>stockInput(world,plan,t),
      {observationId:id,stageRecorder:b.record,substeps:24});
    original.observation.id=id;
    assert.deepEqual(adapted.observation,original.observation);
    assert.deepEqual(adapted.reference,original.reference);
    const originalStages=a.finish(),adaptedStages=b.finish();assert.deepEqual(adaptedStages,originalStages);
    report.rows.push({id,kind:world.kind,snr,observation:hash(original.observation),reference:hash(original.reference),stages:originalStages,identical:true});
  }
  // Exercise the actual schedule bridge on every geometry and all four omitted
  // mechanisms. These are finite-data plumbing checks, not fit/identification wins.
  const chosen=[...producer.stateOperatorWorlds('development'),...producer.outsideStateOperatorWorlds()];
  report.continuous=[];
  for(const [i,world] of chosen.entries()){
    const plan=producer.stateOperatorPlan(world.kind,'query',0),duration=plan.step*plan.steps;
    const input={schema:'worldlaw.continuous-input/v1',startTime:0,
      waveform:{schema:'worldlaw.hann-bursts/v1',duration,cycles:[2.7,4.1,6.3],phases:[.2,-.4,.7],energyShares:[.25,.35,.4],rms:.1,peak:.5},
      ...(world.kind==='periodic'?{profile:plan.initial.map((_,j)=>Math.cos(2*Math.PI*j/plan.initial.length))}:{})};
    const stages=trace(),record=observeWithContinuousInput(producer,world,plan,25,719903+i,input,{observationId:'continuous-'+i,stageRecorder:stages.record});
    validateStateTrajectory(record.observation);
    assert.equal(record.reference.plan,plan);assert.deepEqual(record.appliedActuator.input,input);
    report.continuous.push({id:'continuous-'+i,kind:world.kind,observation:hash(record.observation),reference:hash(record.reference),stages:stages.finish()});
  }
  report.status='passed';
}catch(error){report.status='failed';report.error={name:error.name,message:error.message,stack:error.stack};throw error;}
finally {
  try{const relative=readFileSync('/proc/self/cgroup','utf8').trim().split('\n').find(s=>s.startsWith('0::')).slice(3);
    report.kernelLimits={cgroup:relative,memoryMax:readFileSync('/sys/fs/cgroup'+relative+'/memory.max','utf8').trim(),cpuMax:readFileSync('/sys/fs/cgroup'+relative+'/cpu.max','utf8').trim()};}catch(error){report.kernelLimits={unavailable:error.message};}
  if(process.env.CONTINUOUS_EXPECT_CGROUP==='1'){
    const memory=Number(report.kernelLimits.memoryMax),cpu=String(report.kernelLimits.cpuMax).split(' ').map(Number);
    if(!(memory>0&&memory<=4294967296&&cpu.length===2&&cpu.every(x=>Number.isFinite(x)&&x>0)&&cpu[0]/cpu[1]<=2)){
      report.status='failed';report.limitFailure='Required kernel memory and CPU limits were not observed';process.exitCode=1;
    }
  }
  report.usage=process.resourceUsage();writeFileSync(join(output,'adapter-parity.json'),JSON.stringify(report)+'\n');
  console.log(JSON.stringify(report));
}
