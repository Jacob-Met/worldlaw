import test from 'node:test';
import assert from 'node:assert/strict';
import {createNotebook, calibrateNotebook, validateNotebook, upsertMeasurement, deriveAngles,
  exportAngular, exportStudio, MOTION_SCHEMA, MOTION_TRACKED_SCHEMA} from '../src/motion/measurement.mjs';
import {createTemplate, trackTemplate} from '../src/motion/tracker.mjs';

const source={kind:'synthetic',label:'Authored translating planar marker pair',width:640,height:400,duration:4};
const seed=()=>createNotebook({source});
const calibrated=(settings={})=>calibrateNotebook(seed(),{pivot:{x:160,y:80},pivotMode:'tracked',pixelSigma:3,pivotPixelSigma:4,...settings});
function row(time,pivot={x:160,y:80},angle=.4) {
  return {time,requestedTime:time,timeBasis:'synthetic-time',status:'accepted',point:{x:pivot.x+100*Math.sin(angle),y:pivot.y+100*Math.cos(angle)},
    pivotMeasurement:{status:'accepted',point:{...pivot},quality:{score:.98}}};
}
function add(nb,rows) {for(const r of rows)nb=upsertMeasurement(nb,r);return nb;}

test('common image translation cancels using both observed points; a fixed point does not',()=>{
  const nb=add(calibrated(),Array.from({length:30},(_,i)=>row(i*.1,{x:160+i*3,y:80+i*.5})));
  const result=deriveAngles(nb);
  assert.equal(nb.schema,MOTION_TRACKED_SCHEMA);
  assert.equal(result.segments.length,1);
  for(const sample of result.samples) {
    assert.ok(Math.abs(sample.position-.4)<1e-12);
    assert.ok(Math.abs(sample.positionSigma-.05)<1e-12,'independent 3px and 4px errors combine to 5px');
  }
  const fixed=deriveAngles(calibrateNotebook(nb,{...nb.calibration,pivotMode:'fixed'}));
  assert.ok(Math.abs(fixed.samples.at(-1).position-.4)>.3,'changed-input control exposes fixed-origin error');
  assert.equal(validateNotebook(JSON.parse(JSON.stringify(nb))).schema,MOTION_TRACKED_SCHEMA);
});

test('changing rotation preserves the declared zero and direction while the pivot moves',()=>{
  const nb=add(calibrated({direction:-1,zeroAngle:.2}),Array.from({length:20},(_,i)=>row(i*.1,{x:170+i,y:85+i},.1+.03*i)));
  deriveAngles(nb).samples.forEach((sample,i)=>assert.ok(Math.abs(sample.position-(-(.1+.03*i-.2)))<1e-12));
  const angular=exportAngular(nb);
  assert.equal(angular.source.metadata.notebookSchema,MOTION_TRACKED_SCHEMA);
  assert.deepEqual(angular.source.metadata.measurements,nb.measurements);
  assert.equal(angular.source.metadata.calibration.pivotPixelSigma,4);
});

test('a lost or absent pivot never borrows the calibrated point or a diagnostic candidate',()=>{
  const lost=row(.1);lost.pivotMeasurement={status:'lost',point:null,candidatePoint:{x:161,y:80},reason:'score-below-threshold'};
  let nb=add(calibrated(),[row(0),lost,row(.2)]);
  const result=deriveAngles(nb);
  assert.equal(result.samples[1].position,null);
  assert.equal(result.samples[1].reason,'pivot_lost');
  assert.equal(result.segments.length,2);
  assert.equal(nb.measurements[1].status,'accepted','independent marker evidence survives the pivot failure');
  assert.throws(()=>exportAngular(nb),/Select one continuous segment/);
  const corrected={...lost,pivotMeasurement:{status:'manual',point:{x:160,y:80}}};
  nb=upsertMeasurement(nb,corrected);
  assert.equal(deriveAngles(nb).segments.length,1);
  assert.equal(nb.revisions.at(-1).previousPivotMeasurement.status,'lost');
  assert.equal(nb.revisions.at(-1).previousPivotMeasurement.candidatePoint.x,161);
  const missing=row(.3);delete missing.pivotMeasurement;
  nb=upsertMeasurement(nb,missing);
  assert.equal(deriveAngles(nb).samples.at(-1).reason,'pivot_unobserved');
});

test('legacy fixed-pivot evidence remains readable and is not retroactively measured when mode changes',()=>{
  let nb=calibrateNotebook(seed(),{pivot:{x:160,y:80}});
  const legacy=row(0);delete legacy.pivotMeasurement;
  nb=upsertMeasurement(nb,legacy);
  assert.equal(nb.schema,MOTION_SCHEMA);
  assert.ok(Math.abs(deriveAngles(nb).samples[0].position-.4)<1e-12);
  const upgraded=calibrateNotebook(nb,{...nb.calibration,pivotMode:'tracked'});
  assert.equal(upgraded.measurements[0].pivotMeasurement,undefined);
  assert.equal(deriveAngles(upgraded).samples[0].position,null);
  assert.equal(deriveAngles(nb).samples[0].position!==null,true,'original evidence is unchanged');
});

test('schema, separate clocks, invalid coordinates and invented rejected positions refuse',()=>{
  const nb=add(calibrated(),[row(0)]);
  assert.throws(()=>validateNotebook({...nb,schema:MOTION_SCHEMA}),/v2 motion notebook/);
  for(const modification of [
    {time:.1},{frameIndex:3},{point:{x:-1,y:80}},{status:'lost',point:{x:160,y:80}},
    {status:'made-up'},{quality:[]}
  ]) {
    const changed=structuredClone(nb);Object.assign(changed.measurements[0].pivotMeasurement,modification);
    assert.throws(()=>validateNotebook(changed));
  }
  assert.throws(()=>calibrateNotebook(nb,{...nb.calibration,pivotMode:'predicted'}),/fixed or tracked/);
  assert.throws(()=>calibrateNotebook(nb,{...nb.calibration,pivotPixelSigma:-1}),/pivot error/);
  const clone=validateNotebook(nb);clone.measurements[0].pivotMeasurement.quality.score=0;
  assert.equal(nb.measurements[0].pivotMeasurement.quality.score,.98,'validated portable evidence is copied');
});

test('tracked-pivot data exports angles but refuses the unsupported fixed-pivot torque equation',()=>{
  const nb=add(calibrated(),Array.from({length:40},(_,i)=>row(i*.05,{x:160+i,y:80},.4*Math.cos(i*.1))));
  assert.equal(exportAngular(nb).samples.length,40);
  assert.throws(()=>exportStudio(nb,{inertia:.8,command:0,confirmKnownDynamics:true}),/Tracked-pivot evidence is angle-only/);
  const coincident=row(0);coincident.point={...coincident.pivotMeasurement.point};
  assert.equal(deriveAngles(add(calibrated(),[coincident])).samples[0].position,null);
});

function frame(points) {
  const width=180,height=150,data=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<data.length;i+=4){data[i]=data[i+1]=data[i+2]=35;data[i+3]=255;}
  for(const {x,y,seed} of points)for(let dy=-7;dy<=7;dy++)for(let dx=-7;dx<=7;dx++){
    const hash=Math.imul(dx+19+seed,374761393)^Math.imul(dy+23+seed*3,668265263);
    const value=45+((hash^(hash>>>13))>>>0)%165,index=((y+dy)*width+x+dx)*4;
    data[index]=data[index+1]=data[index+2]=value;
  }
  return {width,height,data};
}
test('the maintained pixel tracker measures both translated patches and independently refuses occlusion and duplicates',()=>{
  const origin=frame([{x:45,y:40,seed:1},{x:70,y:100,seed:5}]);
  const pivot=createTemplate(origin,{x:45,y:40}),marker=createTemplate(origin,{x:70,y:100});
  assert.equal(pivot.status,'ready');assert.equal(marker.status,'ready');
  const translated=frame([{x:51,y:43,seed:1},{x:76,y:103,seed:5}]);
  const p=trackTemplate(translated,pivot.template,{x:45,y:40},{searchRadius:15});
  const m=trackTemplate(translated,marker.template,{x:70,y:100},{searchRadius:15});
  assert.equal(p.status,'accepted');assert.equal(m.status,'accepted');
  assert.ok(Math.abs(Math.atan2(m.point.x-p.point.x,m.point.y-p.point.y)-Math.atan2(25,60))<1e-12);
  const hidden=frame([{x:76,y:103,seed:5}]);
  assert.equal(trackTemplate(hidden,pivot.template,{x:51,y:43},{searchRadius:15}).point,null);
  assert.equal(trackTemplate(hidden,marker.template,{x:76,y:103},{searchRadius:15}).status,'accepted');
  const duplicate=frame([{x:42,y:43,seed:1},{x:61,y:43,seed:1},{x:76,y:103,seed:5}]);
  assert.equal(trackTemplate(duplicate,pivot.template,{x:51,y:43},{searchRadius:15}).status,'ambiguous');
  assert.equal(trackTemplate(duplicate,marker.template,{x:76,y:103},{searchRadius:15}).status,'accepted');
});
