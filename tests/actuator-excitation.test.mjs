import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planActuatorExcitation} from '../src/trajectory/actuator-excitation.mjs';
import {planContinuousExperiment} from '../src/trajectory/continuous-planner.mjs';
import {commandSamples} from '../src/trajectory/controlled-instrument.mjs';
import {rollout} from '../src/trajectory/forward.mjs';

const record=JSON.parse(readFileSync(new URL('../docs/receipts/position-output-development/interior-actuator-excitation.json',import.meta.url)));
const template=record.analytic.request;
const source=(commands)=>[{id:'source',samples:commands.map(command=>({command,get position(){throw Error('position read during design');}}))}];

test('rank certificate uses applied commands and respects changed symmetric bounds',()=>{
  for(const width of [.25,.5,1]){
    const r=planActuatorExcitation(source([-1,1,0,.9]),template,{amplitudeBounds:[-width,1]});
    assert.equal(r.status,'planned');assert.equal(r.sourceActiveIntervals,2);
    assert.equal(r.amplitude,Math.min(width,1/Math.sqrt(3)));
    const us=[-1,1,0,...commandSamples(r.request).samples.slice(0,-1).map(s=>s.command)];
    const gram=k=>us.reduce((sum,u)=>sum+u**k,0);
    assert.ok(Math.abs(r.jointGramDeterminant-(gram(2)*gram(6)-gram(4)**2))<1e-9);
    assert.ok(r.request.segments.every(s=>Math.abs(s.amplitude)<=width));
  }
  assert.equal(planActuatorExcitation(source([0,0,1]),template).status,'no_source_actuation');
  assert.equal(planActuatorExcitation(source([-.6,1,0]),template).status,'outside_aliased_alphabet');
  assert.equal(planActuatorExcitation(source([1,0]),template,{amplitudeBounds:[0,1]}).status,'no_symmetric_command');
});

function prediction(model,request,step){
  const {samples}=commandSamples(request);
  const run={id:'authored',label:'Changed actuator course',kind:'synthetic',source:{label:'Independent command request'},
    inertia:request.inertia,initialRate:request.initialRate,
    samples:samples.map(s=>({...s,position:request.initialPosition}))};
  return rollout(model,run,{maxStep:step}).rows.slice(1).map(z=>z.predicted);
}
const rms=(x,y)=>Math.hypot(...x.map((v,i)=>v-y[i]))/Math.sqrt(x.length);
const gainModel=(id,k)=>({schema:'worldlaw.torque-model/v1',id,terms:[{id,coefficient:k}]});

test('closed-form acquisitions distinguish either actuator under changed gain and bounded position errors',()=>{
  const {request}=planActuatorExcitation(source([-1,0,1,0]),template);
  for(const k of [-.7,1.3])for(const actual of ['command','command_cubic']){
    const models=['command','command_cubic'].map(id=>gainModel(id,k));
    const predictions=models.map(m=>prediction(m,request,.01));
    const observations=[];let q=request.initialPosition,v=request.initialRate;
    for(const s of commandSamples(request).samples.slice(0,-1)){
      const u=s.command,h=request.dt;
      const acceleration=k*(actual==='command'?u:u**3)/request.inertia;
      q+=h*v+.5*h*h*acceleration;v+=h*acceleration;
      observations.push(q+.002*(observations.length%2?1:-1));
    }
    const truth=actual==='command'?0:1;
    assert.ok(Math.abs(rms(observations,predictions[truth])-.002)<1e-11);
    const separation=rms(predictions[0],predictions[1]);
    assert.ok(separation>2*request.noiseSigma);
    assert.ok(rms(observations,predictions[1-truth])>=separation-request.noiseSigma-1e-11);
    assert.ok(Math.abs(q-request.initialPosition)<1e-12&&Math.abs(v-request.initialRate)<1e-12);
  }
});

test('source-rival forecasts reproduce the incumbent advantage and the unit-amplitude tie',()=>{
  const planned=planContinuousExperiment(record.models,record.config);
  assert.deepEqual(planned.request.segments,record.arms[2].segments);
  for(const arm of record.arms){
    const request={...template,segments:arm.segments};
    for(const [name,step] of [['coarse',.01],['fine',.005]]){
      const [x,y]=record.models.map(m=>prediction(m,request,step));
      assert.ok(Math.abs(rms(x,y)-arm[name].rms)<1e-10);
      assert.ok(Math.abs(Math.max(...x.map((v,i)=>Math.abs(v-y[i])))-arm[name].maxAbs)<1e-10);
    }
  }
  assert.equal(record.arms[1].fine.rms,0);
  assert.ok(record.arms[2].fine.rms>record.arms[0].fine.rms);
});

const archive=process.env.WORLDLAW_POSITION_OUTPUT_ARCHIVE;
test('exact three source records reproduce both rival laws and the interior training request',
  {skip:archive?false:'Set WORLDLAW_POSITION_OUTPUT_ARCHIVE to the original development ZIP'},async()=>{
    const {execFileSync}=await import('node:child_process');
    const {discoverWeak}=await import('../src/trajectory/weak-discovery.mjs');
    const extract=`
import hashlib,io,json,sys,tarfile,zipfile
with open(sys.argv[1],'rb') as f: data=f.read()
if hashlib.sha256(data).hexdigest()!=sys.argv[2]: raise ValueError('source digest differs')
with zipfile.ZipFile(io.BytesIO(data)) as z: tgz=z.read('frozen/continuous-law-development.tgz')
with tarfile.open(fileobj=io.BytesIO(tgz)) as t:
    runs=[json.load(t.extractfile('evidence/development/world-1006/active/'+name+'.run.json')) for name in ['source-0','source-1','round-2']]
print(json.dumps(runs))
`;
    const runs=JSON.parse(execFileSync('python3',['-c',extract,archive,record.artifactSha256],{encoding:'utf8',maxBuffer:500000}));
    assert.deepEqual(runs.map(r=>r.id),record.trainingIds);
    const fit=discoverWeak(runs,record.fitOptions);
    for(const [i,id] of ['command','command_cubic'].entries()){
      const other=i?'command':'command_cubic';
      const model=fit.candidates.find(m=>m.terms.some(t=>t.id===id)&&!m.terms.some(t=>t.id===other));
      assert.equal(model.id,record.models[i].id);assert.deepEqual(model.terms.map(t=>t.id),record.models[i].terms.map(t=>t.id));
      model.terms.forEach((t,j)=>assert.ok(Math.abs(t.coefficient-record.models[i].terms[j].coefficient)<1e-12));
    }
    assert.deepEqual(planActuatorExcitation(runs,runs.at(-1).source.request),record.analytic);
});

test('interval-budget determinant bound holds for S≥N and fails beyond that condition',()=>{
  const a=1/Math.sqrt(3);
  const det=(S,cmds)=>{
    const moment=k=>S+cmds.reduce((sum,u)=>sum+u**k,0);
    return moment(2)*moment(6)-moment(4)**2;
  };
  const grid=[-1,-.9,-a,-.2,0,.13,a,.75,1];
  for(const S of [3,7]){
    const optimum=det(S,[a,a,a]);
    for(const x of grid)for(const y of grid)for(const z of grid)
      assert.ok(det(S,[x,y,z])<=optimum+1e-12);
  }
  assert.ok(det(1,[a,a,1])>det(1,[a,a,a]));
});
