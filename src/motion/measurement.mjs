/** Calibrated image observations. Tracking quality is not a physical uncertainty guarantee. */
import {deriveTorqueObservations, splitTrajectoryEvidence} from '../science/trajectory-observations.mjs';
import {validateDataset} from '../data.mjs';

export const MOTION_SCHEMA = 'worldlaw.motion-notebook/v1';
// Older readers must refuse a notebook whose angles require a measured pivot.
export const MOTION_TRACKED_SCHEMA = 'worldlaw.motion-notebook/v2';
export const MOTION_UNITS = Object.freeze({time:'s',point:'px',position:'rad'});
export const MAX_MEASUREMENTS = 4000;
const VALID = new Set(['accepted','manual']);
const STATUSES = new Set([...VALID,'ambiguous','lost','low-texture','missing']);
const insist = (condition,message) => { if (!condition) throw new Error(message); };
const finite = (v,name,{min=-1e9,max=1e9}={}) => {
  insist(typeof v==='number' && Number.isFinite(v) && v>=min && v<=max,`${name} must be a finite number from ${min} to ${max}.`);
  return v;
};
function cloneJSON(value,name='Notebook',limit=2_000_000) {
  let text;
  try { text=JSON.stringify(value); } catch { throw new Error(`${name} must contain portable JSON values.`); }
  insist(typeof text==='string' && text.length<=limit,`${name} exceeds its portable JSON limit.`);
  return JSON.parse(text);
}
function units(value) {
  if (value!==undefined) insist(value && Object.entries(MOTION_UNITS).every(([key,v])=>value[key]===v),
    'Motion notebook units must be seconds (s), image pixels (px), and radians (rad). Convert data before import.');
}
function point(value,source,name) {
  insist(value && typeof value==='object' && !Array.isArray(value),`${name} requires image x and y coordinates.`);
  return {x:finite(value.x,`${name} x`,{min:0,max:source.width-1}),y:finite(value.y,`${name} y`,{min:0,max:source.height-1})};
}
function sourceValue(input) {
  insist(input && typeof input==='object' && !Array.isArray(input),'A source declaration is required.');
  finite(input.width,'Source image width',{min:2,max:8192}); finite(input.height,'Source image height',{min:2,max:8192});
  insist(Number.isInteger(input.width)&&Number.isInteger(input.height),'Source pixel dimensions must be integers.');
  finite(input.duration,'Source duration (seconds)',{min:0.000001,max:86400});
  insist(typeof input.label==='string' && input.label.trim().length>0 && input.label.length<=500,'Source label is required (up to 500 characters).');
  insist(['local-video','synthetic-video','synthetic','user-supplied'].includes(input.kind),'Declare a supported local or synthetic source kind.');
  if (input.kind==='local-video' || input.sha256!=null) insist(typeof input.sha256==='string' && /^[a-f0-9]{64}$/i.test(input.sha256),'Local video provenance requires its SHA-256 digest.');
  if (input.units!==undefined) units(input.units);
  if (input.sampleInterval!==undefined) finite(input.sampleInterval,'Sample interval (seconds)',{min:0.001,max:86400});
  return cloneJSON(input,'Source metadata',250_000);
}
function calibrationValue(input,source) {
  if (input===null) return null;
  insist(input && typeof input==='object','Calibrate a pivot before measuring angles.');
  const pivotMode=input.pivotMode??'fixed';
  insist(['fixed','tracked'].includes(pivotMode),'Pivot mode must be fixed or tracked.');
  const result={pivot:point(input.pivot,source,'Pivot'),
    zeroAngle:finite(input.zeroAngle??0,'Reference angle (radians)',{min:-Math.PI,max:Math.PI}),
    direction:input.direction??1,
    pixelSigma:finite(input.pixelSigma??1,'Assumed point error (pixels)',{min:0,max:100}),
    maxGapSeconds:finite(input.maxGapSeconds??.25,'Maximum continuous time gap (seconds)',{min:.001,max:86400}),
    maxAngularStep:finite(input.maxAngularStep??Math.PI/2,'Maximum angular step (radians)',{min:.001,max:Math.PI}),
    convention:'image_down_zero_positive_right'};
  insist(result.direction===1 || result.direction===-1,'Angle direction must be +1 or -1.');
  if(input.pivotMode!==undefined) result.pivotMode=pivotMode;
  if(pivotMode==='tracked') result.pivotPixelSigma=finite(input.pivotPixelSigma??1,'Assumed pivot error (pixels)',{min:0,max:100});
  if (input.convention!==undefined) insist(input.convention===result.convention,'Unsupported angular calibration convention.');
  return result;
}
function rowValue(input,source) {
  insist(input && typeof input==='object' && !Array.isArray(input),'Measurement must be an object.');
  const row=cloneJSON(input,'Measurement',4000);
  row.time=finite(input.time,'Measurement time (seconds)',{min:0,max:source.duration+1e-6});
  insist(STATUSES.has(input.status),'Measurement has an unsupported tracking status.');
  if (VALID.has(input.status)) row.point=point(input.point,source,'Measured marker');
  else { insist(input.point==null,'Rejected tracking results must not contain an observed point.'); row.point=null; }
  if (input.candidatePoint!=null) row.candidatePoint=point(input.candidatePoint,source,'Diagnostic candidate');
  if (input.requestedTime!==undefined) finite(input.requestedTime,'Requested time (seconds)',{min:0,max:source.duration+1e-6});
  if (input.frameIndex!==undefined) insist(Number.isInteger(input.frameIndex)&&input.frameIndex>=0,'Frame index must be a nonnegative integer.');
  if (input.timeBasis!==undefined) insist(['decoded-media-time','requested-seek-time','synthetic-time','user-supplied'].includes(input.timeBasis),'Unsupported measurement clock declaration.');
  if (input.quality!==undefined) insist(input.quality && typeof input.quality==='object'&&!Array.isArray(input.quality),'Tracking quality must be an object of diagnostics.');
  if(input.pivotMeasurement!=null) {
    const pivot=input.pivotMeasurement;
    insist(pivot && typeof pivot==='object' && !Array.isArray(pivot),'Pivot measurement must be an object.');
    insist(STATUSES.has(pivot.status),'Pivot measurement has an unsupported tracking status.');
    if(VALID.has(pivot.status)) row.pivotMeasurement.point=point(pivot.point,source,'Measured pivot');
    else {insist(pivot.point==null,'Rejected pivot results must not contain an observed point.');row.pivotMeasurement.point=null;}
    if(pivot.candidatePoint!=null) row.pivotMeasurement.candidatePoint=point(pivot.candidatePoint,source,'Diagnostic pivot candidate');
    // Both points belong to the enclosing decoded frame, never a nearby frame.
    for(const key of ['time','requestedTime','timeBasis','frameIndex'])
      insist(pivot[key]===undefined || pivot[key]===row[key],`Pivot ${key} must match its enclosing marker frame.`);
    if(pivot.quality!==undefined) insist(pivot.quality && typeof pivot.quality==='object'&&!Array.isArray(pivot.quality),'Pivot quality must be an object of diagnostics.');
  }
  return row;
}

export function createNotebook({source,units:declaredUnits}={}) {
  units(declaredUnits);
  return {schema:MOTION_SCHEMA,units:{...MOTION_UNITS},source:sourceValue(source),calibration:null,measurements:[],revisions:[]};
}
export function validateNotebook(input) {
  insist(input && [MOTION_SCHEMA,MOTION_TRACKED_SCHEMA].includes(input.schema),`Expected ${MOTION_SCHEMA} or ${MOTION_TRACKED_SCHEMA}.`);
  units(input.units);
  const copy=cloneJSON(input);
  const source=sourceValue(input.source);
  insist(Array.isArray(input.measurements) && input.measurements.length<=MAX_MEASUREMENTS,`Keep at most ${MAX_MEASUREMENTS} measurements per notebook.`);
  const measurements=input.measurements.map(row=>rowValue(row,source));
  for(let i=1;i<measurements.length;i++) insist(measurements[i].time>measurements[i-1].time,'Measurement timestamps must increase strictly; duplicate or unordered imported times are refused.');
  insist(input.revisions===undefined || (Array.isArray(input.revisions)&&input.revisions.length<=512),'Notebook revision history exceeds 512 entries.');
  const calibration=calibrationValue(input.calibration,source);
  insist(input.schema===MOTION_TRACKED_SCHEMA || (calibration?.pivotMode!=='tracked' && !measurements.some(row=>row.pivotMeasurement!=null)),
    'Measured pivots require the v2 motion notebook schema; v1 readers assume a fixed pivot.');
  return {...copy,schema:input.schema,units:{...MOTION_UNITS},source,calibration,measurements,revisions:copy.revisions??[]};
}
function revision(nb,event) {
  // A bounded edit log; source observations themselves remain the authoritative data.
  nb.revisions=[...nb.revisions,event].slice(-512);
  return nb;
}
export function calibrateNotebook(input,calibration) {
  const nb=validateNotebook(input);
  nb.calibration=calibrationValue(calibration,nb.source);
  if(nb.calibration?.pivotMode==='tracked') nb.schema=MOTION_TRACKED_SCHEMA;
  return validateNotebook(revision(nb,{type:'calibration',value:nb.calibration}));
}
export function upsertMeasurement(input,measurement) {
  const nb=validateNotebook(input),row=rowValue(measurement,nb.source);
  const index=nb.measurements.findIndex(old=>old.time===row.time);
  if(index>=0) {
    const previous=nb.measurements[index];nb.measurements[index]=row;
    revision(nb,{type:'replace-measurement',time:row.time,previous:previous.status,previousPoint:previous.point,status:row.status,
      ...(previous.pivotMeasurement?{previousPivotMeasurement:previous.pivotMeasurement}:{})});
  } else {
    insist(nb.measurements.length<MAX_MEASUREMENTS,`Notebook has reached ${MAX_MEASUREMENTS} measured frames.`);
    nb.measurements.push(row);nb.measurements.sort((a,b)=>a.time-b.time);
  }
  return validateNotebook(nb);
}
export function truncateMeasurements(input,{afterTime}={}) {
  const nb=validateNotebook(input);
  finite(afterTime,'Retracking start time (seconds)',{min:0,max:nb.source.duration});
  const removed=nb.measurements.filter(row=>row.time>afterTime);
  if(!removed.length)return nb;
  nb.measurements=nb.measurements.filter(row=>row.time<=afterTime);
  revision(nb,{type:'retrack-suffix',afterTime,removedMeasurements:removed});
  // Keep the old pixel observations in the portable edit record rather than
  // deleting evidence simply because a corrected track is being attempted.
  return validateNotebook(nb);
}

export function deriveAngles(input) {
  const nb=validateNotebook(input);
  insist(nb.calibration,'Calibrate a pivot before deriving angles.');
  const c=nb.calibration,samples=[],segments=[];
  let previous=null,segment=null,breakReason=null;
  const warnings=new Set();
  if(c.pivotMode!=='tracked' && nb.revisions.some(event=>event?.type==='path-reference' && event.pivot?.x===c.pivot.x && event.pivot?.y===c.pivot.y)) warnings.add('fixed_reference_fitted_from_same_marker_observations');
  const reset=reason=>{previous=null;segment=null;breakReason=reason;};
  for(let i=0;i<nb.measurements.length;i++) {
    const row=nb.measurements[i];
    if(!VALID.has(row.status)) {
      samples.push({...row,position:null,positionSigma:null,segmentId:null,sourceIndex:i,reason:row.reason??row.status});reset('rejected_measurement');continue;
    }
    const tracked=c.pivotMode==='tracked',pivot=tracked?row.pivotMeasurement:null;
    if(tracked && (!pivot || !VALID.has(pivot.status))) {
      const reason=pivot?`pivot_${pivot.status}`:'pivot_unobserved';
      samples.push({...row,status:'missing',position:null,positionSigma:null,segmentId:null,sourceIndex:i,reason});
      warnings.add('pivot_measurement_gaps');reset(reason);continue;
    }
    const origin=tracked?pivot.point:c.pivot;
    const dx=row.point.x-origin.x,dy=row.point.y-origin.y,radius=Math.hypot(dx,dy);
    if(radius<2) {
      samples.push({...row,status:'missing',position:null,positionSigma:null,segmentId:null,sourceIndex:i,reason:'marker_too_close_to_pivot'});reset('marker_too_close_to_pivot');continue;
    }
    const raw=c.direction*(Math.atan2(dx,dy)-c.zeroAngle);
    let angle=raw;
    if(previous) {
      const delta=Math.atan2(Math.sin(raw-previous.raw),Math.cos(raw-previous.raw));
      if(row.time-previous.time>c.maxGapSeconds) {warnings.add('time_gap_split');reset('time_gap');}
      else if(Math.abs(delta)>c.maxAngularStep) {warnings.add('angular_step_split');reset('angular_step_exceeds_declared_limit');}
      else angle=previous.position+delta;
    }
    if(!segment) {
      segment={id:segments.length,startTime:row.time,endTime:row.time,count:0,sourceIndices:[],startReason:breakReason??'start'};
      segments.push(segment);breakReason=null;
    }
    const sigma=tracked?Math.hypot(c.pixelSigma,c.pivotPixelSigma):c.pixelSigma;
    const sample={...row,position:angle,positionSigma:sigma/radius,radius,segmentId:segment.id,sourceIndex:i};
    samples.push(sample);segment.endTime=row.time;segment.count++;segment.sourceIndices.push(i);
    previous={time:row.time,raw,position:angle};
    if(row.timeBasis==='requested-seek-time') warnings.add('nominal_video_timestamps');
  }
  const good=samples.filter(row=>row.position!==null),radii=good.map(row=>row.radius);
  const radiusRatio=radii.length?Math.max(...radii)/Math.min(...radii):null;
  if(radiusRatio!==null && radiusRatio>1.15) warnings.add('radius_varies_check_pivot_perspective_and_tracking');
  return {samples,segments,units:{time:'s',position:'rad',point:'px'},convention:c.convention,
    diagnostics:{acceptedCount:good.length,rejectedCount:samples.length-good.length,segmentCount:segments.length,radiusRatio,warnings:[...warnings],
      limitations:[
        c.pivotMode==='tracked'?'Both image points must describe the same planar mechanism under a fixed image orientation; common translation cancels, camera rotation and perspective do not.':'A fixed pivot, front-facing camera and approximately planar motion are caller assumptions.',
        'A visually plausible wrong pivot cannot be diagnosed from these coordinates alone.',
        'A fitted path center is a conditional image reference, not a measured physical joint. Fixed-reference sigma does not include center-fit uncertainty or its correlation with the same marker observations.',
        'No interpolation crosses a rejected measurement, time gap or excessive angular step.',
        'Angle unwrapping assumes changes smaller than the declared limit; full hidden turns cannot be detected.',
        c.pivotMode==='tracked'?'Position sigma uses first-order propagation of caller-assumed independent isotropic marker and pivot errors, not calibrated tracking confidence.':'Position sigma is an assumed pixel-error propagation with an exact pivot, not calibrated tracking confidence.',
        'Template correlation can remain high while rotation, perspective or deformation biases the tracked location.'
      ]}};
}
function selected(input,segmentId) {
  const nb=validateNotebook(input),angles=deriveAngles(nb);
  insist(angles.segments.length>0,'No continuous accepted measurements are available. Calibrate and track or correct points first.');
  if(segmentId===undefined || segmentId===null || segmentId==='') insist(angles.segments.length===1,'Select one continuous segment explicitly. Missing measurements are never silently bridged or discarded.');
  const id=segmentId===undefined||segmentId===null||segmentId===''?angles.segments[0].id:Number(segmentId);
  const segment=angles.segments.find(row=>row.id===id);
  insist(segment,'The selected measurement segment does not exist.');
  const rows=angles.samples.filter(row=>row.segmentId===id);
  return {nb,angles,segment,rows};
}
export function exportAngular(input,{segmentId,command}={}) {
  const {nb,angles,segment,rows}=selected(input,segmentId);
  if(command!==undefined) finite(command,'Explicit applied torque command (N·m)',{min:-1e6,max:1e6});
  return {schema:'worldlaw.angular-telemetry/v1',units:{time:'s',position:'rad',...(command!==undefined?{command:'N·m'}:{})},
    source:{label:`Motion Lab — ${nb.source.label}`,kind:'derived_from_image_points',declaredKind:nb.source.kind,
      metadata:{originalSource:nb.source,calibration:nb.calibration,notebookSchema:nb.schema,selectedSegment:segment,
        ...(nb.revisions.some(event=>event?.type==='path-reference')?{referenceHistory:nb.revisions.filter(event=>event && ['calibration','path-reference'].includes(event.type))}:{}),
        excludedSegments:angles.segments.filter(s=>s.id!==segment.id),measurementIndices:segment.sourceIndices,
        measurements:segment.sourceIndices.map(i=>nb.measurements[i]),diagnostics:angles.diagnostics,
        command:command===undefined?{status:'not_observed',requirement:'Supply synchronized applied torque before deriving net torque.'}:{status:'caller_declared_constant',value:command,unit:'N·m'}}},
    samples:rows.map(row=>({time:row.time,position:row.position,positionSigma:row.positionSigma,...(command!==undefined?{command}:{})}))};
}
export function exportStudio(input,{inertia,command,positionSigma,segmentId,windowSize=7,confirmKnownDynamics=false}={}) {
  insist(confirmKnownDynamics===true,'Confirm that constant inertia is known and the applied torque command is explicitly declared. Video does not measure inertia or forces.');
  finite(inertia,'Known constant inertia (kg·m²)',{min:Number.MIN_VALUE,max:1e9});
  finite(command,'Explicit applied torque command (N·m)',{min:-1e6,max:1e6});
  const {nb,rows}=selected(input,segmentId);
  insist(nb.calibration.pivotMode!=='tracked',
    'Tracked-pivot evidence is angle-only. A moving pivot can add inertial terms that this fixed-pivot torque model does not represent. Export angular evidence instead.');
  if(nb.source.kind==='local-video') insist(rows.every(row=>row.timeBasis==='decoded-media-time'),
    'Studio derivation requires decoded media timestamps for local video. Nominal seek positions cannot qualify an acceleration estimate. Export angles for inspection instead.');
  const angular=exportAngular(nb,{segmentId,command});
  const sigma=positionSigma===undefined||positionSigma===null?Math.max(...rows.map(row=>row.positionSigma)):positionSigma;
  finite(sigma,'Assumed position sigma (radians)',{min:0,max:1e6});
  const derived=deriveTorqueObservations(angular.samples,{inertia,windowSize,positionSigma:sigma});
  const split=splitTrajectoryEvidence(derived,{trainingFraction:.7});
  insist(split.observations.length>=8 && split.heldOut.length>=1,
    'This segment is too short after derivative edges and the source-window guard. Track more consecutive frames (typically 24 or more).');
  const result={schema:'worldlaw.observations/v1',source:{label:`Motion Lab derived torque — ${nb.source.label}`,kind:'derived_from_video_angular_position',
    units:{command:'N·m',position:'rad',rate:'rad/s',jointTorque:'N·m'},metadata:{...angular.source.metadata,
      dynamics:{inertia,command,confirmation:'caller_declared_constant_inertia_and_aligned_applied_torque'},
      derivation:{settings:derived.settings,diagnostics:derived.diagnostics,split:split.split},
      scientificBoundary:'Scalar constant-inertia model with caller calibration. Differentiated video measurements are noisy and biased; fitting them is not validation of physical structure or forces.'}},
    observations:split.observations,heldOut:split.heldOut};
  validateDataset(result);
  return result;
}
