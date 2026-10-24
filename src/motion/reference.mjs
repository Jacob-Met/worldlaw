/** Separate source-frame marks challenge retained observations; they never replace them. */
import {validateNotebook} from './measurement.mjs';
import {validateIndependentReference,referenceTimeKey} from './vendor/reference-admission.mjs';

export const MOTION_REFERENCE_CASE = 'worldlaw.motion-reference-case/v1';
export const MOTION_REFERENCE_COMPARISON = 'worldlaw.motion-reference-comparison/v1';
const accepted = row => row && ['accepted','manual'].includes(row.status) && row.point;
function portable(value,limit,label) {
  let text;try{text=JSON.stringify(value);}catch{throw Error(`${label} must be portable JSON.`);}
  if(typeof text!=='string'||new TextEncoder().encode(text).length>limit)throw Error(`${label} exceeds its portable byte limit.`);
  return JSON.parse(text);
}
const copy = value => JSON.parse(JSON.stringify(value));

export function compareMotionReference(input,rawReference,{maxFrameSkewSeconds=.005}={}) {
  const notebook=validateNotebook(input),source=notebook.source;
  if(source.kind!=='local-video'||![source.nativeWidth,source.nativeHeight].every(n=>Number.isInteger(n)&&n>=2)
    ||source.width!==source.nativeWidth||source.height!==source.nativeHeight)
    throw Error('Reference comparison requires recorded original native video dimensions with no image reduction.');
  const reference=portable(rawReference,2*1024*1024,'Reference');
  const {references,maxFrameSkewSeconds:maxSkew}=validateIndependentReference(reference,{
    source,source_raster:{width:source.width,height:source.height},coordinate_frame:'native-video-raster',trackIds:['marker','pivot']
  },{maxFrameSkewSeconds});
  const recorded=new Map();
  for(const row of notebook.measurements){
    const key=referenceTimeKey(row.time);
    if(recorded.has(key))throw Error('Motion times collide at the shared reference microsecond resolution.');
    recorded.set(key,row);
  }
  for(const labels of references.values())for(const label of labels.values())
    if(label.t>source.duration+1e-6||label.frame_t>source.duration+1e-6)throw Error('Reference time leaves the original video duration.');
  const tracked=notebook.calibration?.pivotMode==='tracked';
  const tracks=[...references].map(([id,labels])=>{
    const kind=id==='marker'?'recorded-marker':tracked?'recorded-pivot':'fixed-pivot-declaration';
    const keys=[...new Set([...recorded.keys(),...labels.keys()])].sort((a,b)=>Number(a)-Number(b));
    const rows=keys.map(key=>{
      const frame=recorded.get(key),label=labels.get(key);
      const observation=id==='marker'?frame:tracked?frame?.pivotMeasurement:null;
      const point=id==='pivot'&&!tracked?notebook.calibration?.pivot:accepted(observation);
      const row={t:frame?.time??label.t,measurement_time_s:frame?.time??null,
        measurement_time_basis:frame?.timeBasis??null,
        reference_label_time_s:label?.t??null,reference_frame_time_s:label?.frame_t??null,
        reference_status:label?.status??null,frame_sha256:label?.frame_sha256??null,
        observation_status:id==='pivot'&&!tracked?(point?'declaration':'missing'):observation?.status??null,
        measured:point?copy(point):null,reference:label?.status==='visible'?{x:label.x,y:label.y}:null,
        uncertainty_px:label?.status==='visible'?label.uncertainty_px:null,
        pixel_match_score:Number.isFinite(observation?.quality?.score)?observation.quality.score:null,
        time_skew_s:frame&&label?Math.abs(label.frame_t-frame.time):null,
        status:'unscored',reason:null,error_px:null,error_lower_px:null,error_upper_px:null};
      if(!label)row.reason='no-reference-label';
      else if(!frame)row.reason='no-recorded-frame';
      else if(label.status!=='visible')row.reason=label.status;
      else if(frame.timeBasis!=='decoded-media-time')row.reason='non-decoded-measurement-time';
      else if(row.time_skew_s>maxSkew+1e-9)row.reason='frame-time-mismatch';
      else if(!point)row.reason=id==='pivot'&&!tracked?'no-fixed-pivot-declaration':'no-accepted-point';
      else {
        const error=Math.hypot(point.x-label.x,point.y-label.y);
        Object.assign(row,{status:'scored',error_px:error,error_lower_px:Math.max(0,error-label.uncertainty_px),error_upper_px:error+label.uncertainty_px});
      }
      return row;
    });
    const scored=rows.filter(row=>row.status==='scored');
    return {id,kind,rows,summary:{scored:scored.length,unscored:rows.length-scored.length,
      mean_error_px:scored.length?scored.reduce((s,row)=>s+row.error_px,0)/scored.length:null,
      max_error_px:scored.length?Math.max(...scored.map(row=>row.error_px)):null}};
  });
  return {format:MOTION_REFERENCE_COMPARISON,source:copy(source),notebook_schema:notebook.schema,
    annotation:copy(reference.annotation),max_frame_skew_s:maxSkew,tracks,
    limitations:[
      'Reference coordinates, annotation independence and decoded-image hashes are producer-declared, fallible evidence; a hash does not authenticate the mark.',
      'Only explicit labels at retained measurement times are joined. No nearest-frame borrowing or interpolation is performed.',
      'The distance interval uses only the declared marking radius; it excludes timing error, tracking error, calibration, physical accuracy and probability.',
      'A fixed pivot is a declaration, not a separately observed position. Its comparison does not turn it into a tracked pivot.',
      'Original measurements, tracking diagnostics, revisions and derived angular evidence remain unchanged. Reference marks do not train or correct the tracker.'
    ]};
}

export function createMotionReferenceCase(notebook,reference,options={}) {
  const comparison=compareMotionReference(notebook,reference,options);
  return portable({format:MOTION_REFERENCE_CASE,notebook:copy(notebook),reference:copy(reference),
    options:{maxFrameSkewSeconds:comparison.max_frame_skew_s}},4*1024*1024,'Reference case');
}

export function openMotionReferenceCase(input) {
  const value=portable(input,4*1024*1024,'Reference case');
  if(value.format!==MOTION_REFERENCE_CASE)throw Error('Unsupported Motion reference case.');
  const raw=createMotionReferenceCase(value.notebook,value.reference,value.options);
  return {raw,comparison:compareMotionReference(raw.notebook,raw.reference,raw.options)};
}
