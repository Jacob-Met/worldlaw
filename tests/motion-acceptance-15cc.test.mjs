/** Independent receiving contracts. Procedural points are not video evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=resolve(process.env.WORLDLAW_RECEIVE_ROOT||resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const {createNotebook,validateNotebook,calibrateNotebook,upsertMeasurement,deriveAngles,exportAngular,exportStudio}=
  await import(pathToFileURL(resolve(root,'src/motion/measurement.mjs')));
const {createSession,exportSession,restoreSession}=await import(pathToFileURL(resolve(root,'src/session.mjs')));
const {deriveTorqueObservations,splitTrajectoryEvidence}=await import(pathToFileURL(resolve(root,'src/science/trajectory-observations.mjs')));
const {discover,evaluate}=await import(pathToFileURL(resolve(root,'src/science/torque-discovery.mjs')));

const source={kind:'synthetic-video',label:'Independent analytic coordinate fixture; not captured video',
  width:640,height:480,duration:8,sha256:null,sampleInterval:1/30};
const angle=t=>.6*Math.exp(-.08*t)*Math.cos(2.8*t);
const point=t=>({x:320+230*Math.sin(angle(t)),y:90+230*Math.cos(angle(t))});
const row=i=>({time:i/30,requestedTime:i/30,timeBasis:'decoded-media-time',frameIndex:i,
  point:point(i/30),status:i===0?'manual':'accepted',quality:{score:.99}});
const notebook=(count=240)=>{
  let n=calibrateNotebook(createNotebook({source}),{pivot:{x:320,y:90},pixelSigma:.3,maxGapSeconds:.1});
  for(let i=0;i<count;i++)n=upsertMeasurement(n,row(i));
  return n;
};
const validSamples=n=>deriveAngles(n).samples.filter(x=>Number.isFinite(x.position));
const near=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} versus ${b}`);
const studioOptions={inertia:.8,command:0,positionSigma:.0012,windowSize:7,confirmKnownDynamics:true};

test('calibrated exact coordinates reach existing discovery and retain source through session reopening',()=>{
  const n=notebook();const samples=validSamples(n);
  assert.equal(samples.length,240);
  for(const sample of samples)near(sample.position,angle(sample.time));
  const portable=exportAngular(n);
  assert.ok(portable&&typeof portable==='object');
  assert.ok(portable.samples.every(row=>!('command' in row)),'Angular export must not invent zero applied torque');
  const dataset=exportStudio(n,studioOptions);
  assert.ok(dataset.observations.length>=8&&dataset.heldOut.length>=8);
  const session=createSession(dataset);
  assert.ok(session.discovery.selected.terms.some(x=>x.id==='spring'));
  const restored=restoreSession(exportSession(session));
  assert.deepEqual(restored.base.source,session.base.source);
  assert.deepEqual(restored.base.observations,session.base.observations);
});

test('invalid coordinates, times, missing identity and incompatible declared units refuse atomically',()=>{
  const n=notebook(40),snapshot=JSON.stringify(n);
  for(const pivot of [{x:-1,y:90},{x:640,y:90},{x:320,y:NaN}])
    assert.throws(()=>calibrateNotebook(n,{pivot}));
  for(const invalid of [{direction:0},{direction:2},{pixelSigma:-1},{maxGapSeconds:0},{zeroAngle:NaN}])
    assert.throws(()=>calibrateNotebook(n,{pivot:{x:320,y:90},...invalid}));
  for(const invalid of [{...row(2),time:NaN},{...row(2),time:-1},
    {...row(2),time:9},{...row(2),point:{x:Infinity,y:50}},
    {...row(2),status:'accepted',point:null}])assert.throws(()=>upsertMeasurement(n,invalid));
  assert.throws(()=>createNotebook({source:{...source,kind:'local-video',sha256:null}}));
  assert.throws(()=>validateNotebook({...n,measurements:[...n.measurements,n.measurements[1]]}));
  assert.throws(()=>validateNotebook({...n,units:{time:'ms',position:'deg',pixel:'px'}}));
  assert.equal(JSON.stringify(n),snapshot);
});

test('rejected frames and explicit missing points stay gaps; derivative export cannot silently join segments',()=>{
  const original=notebook();
  let n=original;
  for(let i=60;i<75;i++)n=upsertMeasurement(n,{...row(i),point:null,status:'lost',
    candidatePoint:{x:320,y:90},reason:'independent-occlusion-control',quality:{score:.5}});
  const angular=deriveAngles(n);
  assert.equal(validSamples(n).length,225);
  assert.ok(angular.segments.length>=2);
  assert.equal(n.measurements.filter(x=>x.status==='lost'&&x.point===null).length,15);
  assert.throws(()=>exportStudio(n,studioOptions),/segment/i);
  assert.throws(()=>exportAngular(n),/segment/i);
  assert.equal(original.measurements.filter(x=>x.point===null).length,0,'Rejection must not mutate prior notebook');
  const segment=angular.segments[0];
  const dataset=exportStudio(n,{...studioOptions,segmentId:segment.id});
  assert.ok(dataset.observations.length+dataset.heldOut.length<60,'Derivative windows must stay within selected first segment');
});

test('a missing-time interval and a physically implausible step split without inserting observations',()=>{
  let n=notebook(40);
  n=upsertMeasurement(n,{...row(60),time:2,point:point(2)});
  assert.ok(deriveAngles(n).segments.length>=2);
  assert.equal(n.measurements.length,41);
  const before=n.measurements.length;
  n=upsertMeasurement(n,{...row(61),time:2+1/30,point:{x:320,y:0}});
  assert.equal(deriveAngles(n).segments.length,3,'Excessive angular step must create a third segment');
  assert.equal(n.measurements.length,before+1);
  assert.equal(n.measurements.some(x=>x.time>1.3&&x.time<2),false);
});

test('manual correction replaces one timestamp and survives JSON reopening with original rejection revision',()=>{
  const base=notebook(40);
  const rejected=upsertMeasurement(base,{...row(20),status:'missing',point:null,reason:'operator-inspection'});
  const corrected=upsertMeasurement(rejected,{...row(20),status:'manual',point:point(20/30)});
  assert.equal(corrected.measurements.length,base.measurements.length);
  assert.equal(corrected.measurements.filter(x=>x.time===20/30).length,1);
  assert.equal(corrected.measurements.find(x=>x.time===20/30).status,'manual');
  const restored=validateNotebook(JSON.parse(JSON.stringify(corrected)));
  assert.deepEqual(restored.measurements,corrected.measurements);
  assert.deepEqual(restored.calibration,corrected.calibration);
  assert.ok(corrected.revisions.length>base.revisions.length);
  assert.equal(rejected.measurements.find(x=>x.time===20/30).point,null);
});

test('inertia, aligned command and explicit physics acknowledgement are required for torque export',()=>{
  const n=notebook(80);
  for(const options of [{...studioOptions,confirmKnownDynamics:false},{...studioOptions,inertia:0},
    {...studioOptions,inertia:NaN},{...studioOptions,command:NaN},{...studioOptions,command:undefined},
    {...studioOptions,windowSize:6},{...studioOptions,positionSigma:-1}])assert.throws(()=>exportStudio(n,options));
  const nominal=validateNotebook({...n,source:{...n.source,kind:'local-video',sha256:'a'.repeat(64)},
    measurements:n.measurements.map(row=>({...row,timeBasis:'requested-seek-time'}))});
  assert.throws(()=>exportStudio(nominal,studioOptions),/decoded|timestamp/i);
  assert.equal(exportAngular(nominal).samples.length,n.measurements.length,'Nominal-time angles remain available for qualified inspection');
});

test('plausible wrong pivot is a retained scientific counterexample, not a fake detectable input error',()=>{
  const good=notebook();
  const wrong=calibrateNotebook(good,{pivot:{x:360,y:90}});
  const errors=validSamples(wrong).map(s=>s.position-angle(s.time));
  const rms=Math.hypot(...errors)/Math.sqrt(errors.length);
  assert.ok(rms>.15&&rms<.18,`Wrong pivot error ${rms}`);
  assert.equal(validSamples(wrong).length,validSamples(good).length);
});

test('smoother derived evidence can fit better while its torque truth error grows',()=>{
  const raw=Array.from({length:240},(_,i)=>({time:i/30,position:angle(i/30)+.0006*Math.sin(i*1.7),command:0}));
  const trueTorque=t=>.8*.6*Math.exp(-.08*t)*((.08**2-2.8**2)*Math.cos(2.8*t)+2*.08*2.8*Math.sin(2.8*t));
  const run=windowSize=>{
    const d=deriveTorqueObservations(raw,{inertia:.8,windowSize,positionSigma:.0012});
    const split=splitTrajectoryEvidence(d);
    assert.ok(split.split.trainingRawIndices[1]<split.split.heldOutRawIndices[0]);
    const model=discover(split.observations,{noiseSigma:.03}).selected;
    return {truthRmse:Math.hypot(...d.estimates.map(r=>r.observation.jointTorque-trueTorque(r.time)))/Math.sqrt(d.estimates.length),
      derivedRmse:evaluate(model,split.heldOut).rmse};
  };
  const small=run(7),large=run(31);
  assert.ok(large.derivedRmse<small.derivedRmse);
  assert.ok(large.truthRmse>small.truthRmse*2,JSON.stringify({small,large}));
});
