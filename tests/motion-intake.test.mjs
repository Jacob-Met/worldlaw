import test from 'node:test';
import assert from 'node:assert/strict';
import {createNotebook,calibrateNotebook,upsertMeasurement,deriveAngles,exportAngular} from '../src/motion/measurement.mjs';
import {proposePathReference,applyPathReference} from '../src/motion/path-reference.mjs';
import {inspectMotionRecording,createMotionAngularBundle} from '../src/trajectory/motion-intake.mjs';
import {createChallenge,exportChallenge,restoreChallenge} from '../src/trajectory/session.mjs';

const assumptions={unforcedScalarRotation:true,sharedAngleFrame:true,basis:'Authored oscillator: same downward zero and image orientation; no applied drive.'};
function fixture({amplitude=.8,sha='a',gap=false,rate=0,nominal=false,synthetic=false}={}){
 let nb=createNotebook({source:{label:'Authored oscillator '+sha,kind:synthetic?'synthetic-video':'local-video',
  width:400,height:300,duration:8,sha256:sha.repeat(64)}});
 nb=calibrateNotebook(nb,{pivot:{x:200,y:70},zeroAngle:0,direction:1,maxGapSeconds:.1,pixelSigma:.2});
 for(let i=0;i<=160;i++){const t=i*.05;
  const angle=Math.exp(-.12*t)*(amplitude*Math.cos(2.4*t)+(rate+.12*amplitude)/2.4*Math.sin(2.4*t));
  nb=upsertMeasurement(nb,{time:t,status:gap&&i===80?'lost':'accepted',
   point:gap&&i===80?null:{x:200+120*Math.sin(angle),y:70+120*Math.cos(angle)},
   timeBasis:nominal?'requested-seek-time':'decoded-media-time'});
 }
 return nb;
}
const declaration=(nb,extra={})=>({input:JSON.stringify(nb),kind:'synthetic',initialRate:0,initialRateBasis:'Independent analytic release from rest.',...extra});
async function pair(extra={}){
 return createMotionAngularBundle({training:declaration(fixture()),challenge:declaration(fixture({amplitude:1.15,sha:'b'})),assumptions,...extra});
}
test('unchanged measured angles reach the maintained model and separate forward challenge',async()=>{
 const nb=fixture(),b=await pair();
 assert.equal(b.schema,'worldlaw.angular-bundle/v1');assert.equal(b.trainingRuns[0].inertia,null);
 assert.deepEqual(b.trainingRuns[0].samples,exportAngular(nb).samples.map(({time,position})=>({time,position})));
 assert.ok(b.trainingRuns[0].samples.every(row=>!Object.hasOwn(row,'command')));
 const result=createChallenge(b,{noiseSigma:.001,maxTerms:3});
 assert.equal(result.summary.selectionBasis,'training_evidence_only');
 assert.ok(result.summary.selectedPositionRMSE<.03,JSON.stringify(result.summary));
 for(const base of result.summary.predictionSkill.baselines)assert.ok(base.skill>0,JSON.stringify(base));
 const restored=restoreChallenge(exportChallenge(result));assert.deepEqual(restored.bundle,b);
 assert.deepEqual(restored.discovery.selected,result.discovery.selected);
 assert.deepEqual(restored.results,result.results);
});
test('exact input-byte and video identity, course lineage and conditional reference survive export',async()=>{
 let nb=fixture();nb=applyPathReference(nb,proposePathReference(nb,{maxResidualPixels:.01}));
 const prepared=await inspectMotionRecording(JSON.stringify(nb));
 const b=await pair({training:declaration(nb)}),motion=b.trainingRuns[0].source.motion;
 assert.equal(motion.inputSha256,prepared.inputSha256);assert.equal(motion.originalVideo.sha256,'a'.repeat(64));
 assert.deepEqual(motion.observationIndices,deriveAngles(nb).segments[0].sourceIndices);
 assert.ok(motion.reference.activePathFit.method.startsWith('mechanism.path-classifier/'));
 assert.equal(motion.reference.conditioning.fitPrecedesDownstreamSplit,true);
 assert.match(motion.reference.retention,/Full original pixels/);
});
test('the same original video cannot masquerade as independent evidence after notebook edits',async()=>{
 const challenge=fixture({amplitude:1.15,sha:'a'});
 await assert.rejects(pair({challenge:declaration(challenge)}),/shares a declared recording/);
});
test('gap boundaries require explicit course selection and retain omitted-course count',async()=>{
 const nb=fixture({gap:true});
 await assert.rejects(pair({training:declaration(nb)}),/Select one continuous segment/);
 const b=await pair({training:declaration(nb,{segmentId:1})});
 assert.equal(b.trainingRuns[0].samples[0].time,4.05);
 assert.equal(b.trainingRuns[0].source.motion.omittedCourseCount,1);
 assert.ok(b.trainingRuns[0].samples.every(row=>row.time>4));
});
test('future challenge mutations alter scores but never the training-selected laws',async()=>{
 const one=await pair(),nb=fixture({amplitude:1.15,sha:'b'});
 nb.measurements.forEach((row,i)=>{if(i>10){row.point.x+=8*Math.sin(i*.23);}});
 const two=await pair({challenge:declaration(nb)});
 const a=createChallenge(one,{maxTerms:2}),b=createChallenge(two,{maxTerms:2});
 assert.deepEqual(a.discovery,b.discovery);assert.notDeepEqual(a.results,b.results);
});
test('missing rate, rate basis, physical declarations and synthetic relabeling refuse',async()=>{
 await assert.rejects(pair({training:declaration(fixture(),{initialRate:undefined})}),/starting angular rate/);
 await assert.rejects(pair({training:declaration(fixture(),{initialRateBasis:''})}),/Starting-rate basis/);
 await assert.rejects(pair({assumptions:{...assumptions,unforcedScalarRotation:false}}),/unforced scalar rotation/);
 await assert.rejects(pair({assumptions:{...assumptions,sharedAngleFrame:false}}),/same physical angle/);
 await assert.rejects(pair({assumptions:{...assumptions,basis:''}}),/coordinate basis/);
 await assert.rejects(pair({training:declaration(fixture({synthetic:true}),{kind:'measured'})}),/must remain synthetic/);
});
test('nominal timestamps, absent original identity and moving pivots cannot qualify this intake',async()=>{
 await assert.rejects(pair({training:declaration(fixture({nominal:true}))}),/decoded media timestamps/);
 const unidentified=fixture({synthetic:true});delete unidentified.source.sha256;
 await assert.rejects(inspectMotionRecording(JSON.stringify(unidentified)),/identified original video/);
 const moving=fixture();moving.schema='worldlaw.motion-notebook/v2';moving.calibration.pivotMode='tracked';moving.calibration.pivotPixelSigma=1;
 await assert.rejects(inspectMotionRecording(JSON.stringify(moving)),/fixed image reference/);
});
test('invalid UTF-8, overlarge inputs and mutated previews are not accepted as source authority',async()=>{
 await assert.rejects(inspectMotionRecording(new Uint8Array([255,123])),/UTF-8 JSON/);
 await assert.rejects(inspectMotionRecording(' '.repeat(2_000_001)),/2 MB/);
 const raw=JSON.stringify(fixture());const preview=await inspectMotionRecording(raw);preview.notebook.calibration.pivot.x=0;
 const b=await pair({training:{...declaration(fixture()),preview}});
 assert.equal(b.trainingRuns[0].source.motion.calibration.pivot.x,200);
});
