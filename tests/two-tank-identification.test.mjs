import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  TWO_TANK_CANDIDATES,validateTwoTankRun,partitionTwoTankRuns,
  fitTwoTankCandidate,trainSelectTwoTank,evaluateTwoTankModel,predictTwoTank
} from '../src/science/two-tank-identification.mjs';
import {parseMeasuredCsv,runPhysicalStudy} from '../experiments/two-tank-measured.mjs';

const makeRun=(id,group,{seed=1,dropout=-1,poison=false,n=2100}={})=>{
  let x=(seed*911382323)>>>0;
  const random=()=>{x=(Math.imul(1664525,x)+1013904223)>>>0;return x/4294967296;};
  let level=.24,previous=.24;
  const samples=[];
  for(let t=0;t<n;t++){
    const pump=20+60*(.5+.5*Math.sin(t/60+seed))+5*(random()-.5);
    const valve=15+70*(.5+.5*Math.sin(t/93+seed*2));
    const control=pump/100,opening=valve/100;
    const y=poison&&group==='Disturbance'?Math.max(0,Math.min(1,1-level)):level;
    samples.push({time:t,level:100*y,pump,valve,valid:t!==dropout});
    previous=level;
    level=Math.max(0,Math.min(1,level+0.003*control-0.002*Math.sqrt(level)-0.001*opening*Math.sqrt(level)+0.00005));
  }
  return {id,group,sha256:createHash('sha256').update(id).digest('hex'),samples};
};
const original=()=>[
  makeRun('Baseline/b.csv','Baseline',{seed:1}),
  makeRun('PassiveOutflow/p1.csv','PassiveOutflow',{seed:2}),
  makeRun('PassiveOutflow/p2.csv','PassiveOutflow',{seed:3}),
  makeRun('PassiveOutflow/p3.csv','PassiveOutflow',{seed:4}),
  makeRun('PassiveOutflow/p4.csv','PassiveOutflow',{seed:5}),
  makeRun('Disturbance/d1.csv','Disturbance',{seed:6})
];
test('frozen file-level split has zero shared source IDs and no disturbance fitting',()=>{
  const {train,development,test:holdout,assignment}=partitionTwoTankRuns(original());
  assert.equal(train.length,4);assert.equal(development.length,1);assert.equal(holdout.length,1);
  assert.ok(train.every(r=>r.group!=='Disturbance'));
  assert.ok(development.every(r=>r.group==='PassiveOutflow'));
  assert.ok(holdout.every(r=>r.group==='Disturbance'));
  assert.equal(new Set([...assignment.train,...assignment.development,...assignment.test]).size,6);
  assert.throws(()=>fitTwoTankCandidate(holdout,TWO_TANK_CANDIDATES[0]),/test records are forbidden/);
  assert.throws(()=>partitionTwoTankRuns([...original(),original()[0]]),/duplicate source recording/);
});
test('same specified training/dev, radically changed sealed disturbance cannot influence selection',()=>{
  const train=partitionTwoTankRuns(original());
  const poison=original();poison[5]=makeRun('Disturbance/d1.csv','Disturbance',{seed:6,poison:true});
  const alternate=partitionTwoTankRuns(poison);
  const a=trainSelectTwoTank(train.train,train.development);
  const b=trainSelectTwoTank(alternate.train,alternate.development);
  assert.deepEqual(a.selected,b.selected);
  assert.deepEqual(a.development,b.development);
  const scores=evaluateTwoTankModel(a.selected.ar2,train.test);
  const poisoned=evaluateTwoTankModel(a.selected.ar2,alternate.test);
  assert.notDeepEqual(scores.macro,poisoned.macro);
});
test('sample gap/dropout never interpolated, copied train run or invalid clock refused',()=>{
  const base=original();
  base[0].samples[500].valid=false;
  const normalized=partitionTwoTankRuns(base),model=fitTwoTankCandidate(normalized.train,TWO_TANK_CANDIDATES[0]);
  assert.ok(model.discardedTrain>=4);
  const bad=makeRun('Baseline/bad','Baseline',{n:10});
  bad.samples[4].time=bad.samples[3].time;
  assert.throws(()=>validateTwoTankRun(bad),/timestamps must strictly increase/);
  const copied=makeRun('Baseline/a','Baseline',{n:10});
  copied.samples[2].level=NaN;
  assert.equal(validateTwoTankRun(copied).samples[2].valid,false);
});
test('causal delayed control predictor changes with earlier logged inputs, not future controls',()=>{
  const run=partitionTwoTankRuns(original()).test[0];
  const model={type:'ar2',coefficients:[0,0,0,1]};
  const a=predictTwoTank(model,run,100);
  const edited=structuredClone(run);
  edited.samples[99].pump=.99;
  assert.notEqual(predictTwoTank(model,edited,100),a);
  edited.samples[101].pump=.01;
  assert.equal(predictTwoTank(model,edited,100),.99);
});
test('full physical benchmark runs on synthetic invariants WITHOUT claims of measured qualification',()=>{
  const report=runPhysicalStudy(original());
  assert.equal(report.split.test[0],'Disturbance/d1.csv');
  assert.equal(report.preregistration.threadPost,155623);
  for(const type of ['persistence','ar2','arx','hydraulic','sindy']){
    assert.ok(Number.isFinite(report.heldout[type].macro[1]),type+' one step');
    assert.ok(Number.isFinite(report.heldout[type].macro[30]),type+' 30s');
    assert.ok(Number.isFinite(report.heldout[type].macro[120]),type+' 120s');
  }
  assert.equal(report.models.hydraulic.coefficients.length,4);
  assert.ok(report.models.hydraulic.coefficients.slice(1).every(c=>c>=0),'physical sign constraints');
  assert.ok(Number.isFinite(report.controls.shuffledTrainingLabelsArx[120]));
  assert.ok(Number.isFinite(report.controls.arxShiftedControls97[120]));
});
test('published v2 CSV contract refuses missing fields and wrong version',()=>{
  const hdr='Time_s,Level_pct,Control_Signal_pct,Valve_Opening_pct,Sensor_Dropout,perturbation';
  const rows=[hdr];
  for(let i=0;i<30000;i++)rows.push([i,20+i/10000,20,50,i===900?1:0,0].join(','));
  const accepted=parseMeasuredCsv(Buffer.from(rows.join('\n')),'Baseline/Baseline_50pct.csv','Baseline');
  assert.equal(accepted.samples.length,30000);assert.equal(accepted.validCount,29999);
  assert.equal(accepted.samples[900].valid,false);
  assert.throws(()=>parseMeasuredCsv(Buffer.from(rows.join('\n').replace('Sensor_Dropout','Bad')),'b','Baseline'),/missing version-2 Sensor_Dropout/);
});
