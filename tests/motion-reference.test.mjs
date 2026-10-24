import test from 'node:test';
import assert from 'node:assert/strict';
import {createNotebook,calibrateNotebook,validateNotebook} from '../src/motion/measurement.mjs';
import {compareMotionReference,createMotionReferenceCase,openMotionReferenceCase} from '../src/motion/reference.mjs';

const sha='a'.repeat(64),frameSHA='b'.repeat(64);
function notebook(tracked=false){
  let n=createNotebook({source:{kind:'local-video',label:'authored.webm',sha256:sha,width:100,height:100,nativeWidth:100,nativeHeight:100,duration:1}});
  n=calibrateNotebook(n,{pivot:{x:50,y:50},pivotMode:tracked?'tracked':'fixed'});
  n.measurements=[{time:.1,timeBasis:'decoded-media-time',status:'accepted',point:{x:20,y:30},quality:{score:.99}},
    {time:.2,timeBasis:'decoded-media-time',status:'lost',point:null,candidatePoint:{x:91,y:91},quality:{score:1}},
    {time:.3,timeBasis:'decoded-media-time',status:'manual',point:{x:25,y:30}}];
  if(tracked)n.measurements.forEach((row,i)=>row.pivotMeasurement={status:i===0?'lost':'accepted',point:i===0?null:{x:50,y:50},candidatePoint:{x:51,y:51}});
  return validateNotebook(n);
}
const label=(t,x=23,y=34,uncertainty_px=2)=>({t,frame_t:t,frame_sha256:frameSHA,status:'visible',x,y,uncertainty_px});
function reference(tracks=[{id:'marker',labels:[label(.1)]}]){return {format:'chronos-independent-reference/v1',source:{sha256:sha,width:100,height:100},position_unit:'px',time_unit:'s',coordinate_frame:'native-video-raster',annotation:{method:'Separately marked authored source frames; declared disk radius.',independent_of_tracker:true},tracks};}

test('independent 3-4-5 discrepancy and declared radius do not borrow confidence from the original match',()=>{
  const n=notebook(),r=reference(),before=JSON.stringify(n),result=compareMotionReference(n,r),row=result.tracks[0].rows[0];
  assert.equal(row.error_px,5);assert.equal(row.error_lower_px,3);assert.equal(row.error_upper_px,7);assert.equal(row.pixel_match_score,.99);
  assert.equal(result.tracks[0].summary.scored,1);assert.equal(result.tracks[0].summary.unscored,2);assert.equal(JSON.stringify(n),before);
  r.tracks[0].labels[0].uncertainty_px=9;assert.equal(compareMotionReference(n,r).tracks[0].rows[0].error_lower_px,0);
});

test('missing points, unidentifiable marks and unlabeled or unrecorded times remain distinct gaps',()=>{
  const r=reference([{id:'marker',labels:[label(.2,91,91),{t:.3,frame_t:.3,frame_sha256:frameSHA,status:'unidentifiable'},label(.4)]}]);
  const rows=compareMotionReference(notebook(),r).tracks[0].rows;
  assert.deepEqual(rows.map(x=>x.reason),['no-reference-label','no-accepted-point','unidentifiable','no-recorded-frame']);
  assert.ok(rows.every(x=>x.status==='unscored'&&x.error_px===null));assert.equal(rows[1].measured,null);
});

test('nearby reference frames and nominal measurements never lend a scored position',()=>{
  const n=notebook(),r=reference();r.tracks[0].labels[0].frame_t=.14;
  assert.equal(compareMotionReference(n,r).tracks[0].rows[0].reason,'frame-time-mismatch');
  r.tracks[0].labels[0].frame_t=.1;n.measurements[0].timeBasis='requested-seek-time';
  assert.equal(compareMotionReference(n,r).tracks[0].rows[0].reason,'non-decoded-measurement-time');
  delete n.measurements[0].timeBasis;assert.equal(compareMotionReference(n,r).tracks[0].rows[0].reason,'non-decoded-measurement-time');
  r.tracks[0].labels[0].t=.1001;n.measurements[0].timeBasis='decoded-media-time';
  assert.equal(compareMotionReference(n,r).tracks[0].summary.scored,0);
});

test('paired observations are independently comparable while a fixed pivot remains explicitly a declaration',()=>{
  const r=reference([{id:'marker',labels:[label(.1),label(.2)]},{id:'pivot',labels:[label(.1,50,50,0),label(.2,50,51,0)]}]);
  const pair=compareMotionReference(notebook(true),r);
  assert.equal(pair.tracks[0].rows[0].status,'scored');assert.equal(pair.tracks[1].rows[0].reason,'no-accepted-point');
  assert.equal(pair.tracks[0].rows[1].reason,'no-accepted-point');assert.equal(pair.tracks[1].rows[1].error_px,1);
  assert.equal(pair.tracks[1].kind,'recorded-pivot');
  const fixed=compareMotionReference(notebook(),r).tracks[1];assert.equal(fixed.kind,'fixed-pivot-declaration');assert.equal(fixed.rows[1].error_px,1);assert.equal(fixed.rows[1].observation_status,'declaration');
});

test('source, native-raster, target, visibility, duration and microsecond collisions refuse explicitly',()=>{
  for(const change of [r=>r.source.sha256='c'.repeat(64),r=>r.source.width=99,r=>r.coordinate_frame='resized-raster',r=>r.annotation.independent_of_tracker=false,r=>r.tracks[0].id='other',r=>r.tracks[0].labels[0].frame_sha256='bad',r=>r.tracks[0].labels[0].frame_t=1.1]){
    const r=reference();change(r);assert.throws(()=>compareMotionReference(notebook(),r));
  }
  const hidden=reference();hidden.tracks[0].labels[0].status='occluded';assert.throws(()=>compareMotionReference(notebook(),hidden));
  const scaled=notebook();scaled.source.nativeWidth=200;assert.throws(()=>compareMotionReference(scaled,reference()),/no image reduction/);
  const unknown=notebook();delete unknown.source.nativeWidth;assert.throws(()=>compareMotionReference(unknown,reference()),/native video dimensions/);
  const collision=notebook();collision.measurements[1].time=.1000001;assert.throws(()=>compareMotionReference(collision,reference()),/microsecond/);
  assert.throws(()=>compareMotionReference(notebook(),reference(),{maxFrameSkewSeconds:.1}),/skew/);
});

test('raw cases preserve the original ledger and recompute supplied answers while binding both sources',()=>{
  const n=notebook(),r=reference(),raw=createMotionReferenceCase(n,r);assert.deepEqual(raw.notebook,n);assert.deepEqual(raw.reference,r);
  const value=JSON.parse(JSON.stringify({...raw,comparison:{tracks:[{rows:[{error_px:0}]}]}}));
  const opened=openMotionReferenceCase(value);assert.equal(opened.comparison.tracks[0].rows[0].error_px,5);assert.deepEqual(opened.raw,raw);
  value.reference.source.sha256='d'.repeat(64);assert.throws(()=>openMotionReferenceCase(value),/SHA/);
  assert.throws(()=>openMotionReferenceCase({...raw,format:'unrecognized'}),/Unsupported/);
  const oversized=reference();oversized.extra='x'.repeat(2*1024*1024);assert.throws(()=>createMotionReferenceCase(n,oversized),/byte limit/);
});
