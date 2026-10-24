/** Shared admission of producer-declared independent source-frame labels.
 * No fitting, interpolation, decoded-frame verification or physical-truth claim.
 * Context supplies source.sha256, source_raster, coordinate_frame and trackIds.
 */
export const REFERENCE_FORMAT = 'chronos-independent-reference/v1';
const finite = n => typeof n === 'number' && Number.isFinite(n);
const digest = s => typeof s === 'string' && /^[a-f0-9]{64}$/i.test(s);
const copy = value => JSON.parse(JSON.stringify(value));
export const referenceTimeKey = t => Number(t).toFixed(6);
export function validateIndependentReference(reference, context, options={}) {
  if(reference?.format!==REFERENCE_FORMAT) throw Error('Unsupported independent reference format.');
  if(!digest(reference.source?.sha256) || reference.source.sha256.toLowerCase()!==context?.source?.sha256?.toLowerCase()) throw Error('Independent reference source SHA-256 differs from the forecast source.');
  if(reference.position_unit!=='px' || reference.time_unit!=='s') throw Error('Independent references require source pixels and video-relative seconds.');
  if(reference.coordinate_frame!=='native-video-raster' || context?.coordinate_frame!=='native-video-raster') throw Error('Independent references require the same native-video-raster coordinate frame.');
  const raster=context?.source_raster;
  if(!raster || ![raster.width,raster.height].every(n=>Number.isInteger(n)&&n>0&&n<=32768)
    || reference.source.width!==raster.width || reference.source.height!==raster.height) throw Error('Independent reference raster differs from the declared source raster.');
  if(reference.annotation?.independent_of_tracker!==true || typeof reference.annotation.method!=='string'
    || !reference.annotation.method.trim() || reference.annotation.method.length>1000) throw Error('Declare the separate annotation method and its independence from the tracker.');
  if(!Array.isArray(reference.tracks) || !reference.tracks.length || reference.tracks.length>32) throw Error('Independent reference must contain 1–32 target tracks.');
  const maxSkew=options.maxFrameSkewSeconds??0.005;
  if(!finite(maxSkew)||maxSkew<0||maxSkew>.05) throw Error('Frame time skew limit must be between 0 and 0.05 seconds.');
  const allowedIds=context?.trackIds;
  if(!Array.isArray(allowedIds)) throw Error('Supply an explicit array of allowed target IDs.');
  const reportIds=new Set(allowedIds), references=new Map();
  for(const track of reference.tracks){
    if(!reportIds.has(track.id)||references.has(track.id)) throw Error('Reference target IDs must be unique and match the forecast report.');
    if(!Array.isArray(track.labels)||!track.labels.length||track.labels.length>20000) throw Error('Each reference target needs 1–20000 explicit frame labels.');
    let previous=-Infinity;const labels=new Map();
    for(const label of track.labels){
      if(!finite(label.t)||label.t<0||label.t<=previous||!finite(label.frame_t)||label.frame_t<0) throw Error('Reference times must be finite, nonnegative and strictly increasing.');
      const key=referenceTimeKey(label.t);
      if(labels.has(key)) throw Error('Reference times must be distinct at microsecond resolution.');
      if(!['visible','occluded','unidentifiable'].includes(label.status)) throw Error('Reference visibility must be explicit.');
      if(!digest(label.frame_sha256)) throw Error('Each reference label requires its decoded frame image SHA-256.');
      if(label.status==='visible'){
        if(!finite(label.x)||!finite(label.y)||label.x<0||label.x>=raster.width||label.y<0||label.y>=raster.height) throw Error('Visible reference coordinates must lie inside the source raster.');
        if(!finite(label.uncertainty_px)||label.uncertainty_px<0||label.uncertainty_px>Math.hypot(raster.width,raster.height)) throw Error('Visible reference marks require an explicit finite position uncertainty radius.');
      }else if(label.x!==undefined||label.y!==undefined) throw Error('An occluded or unidentifiable reference cannot declare a visible position.');
      labels.set(key,copy(label));previous=label.t;
    }
    references.set(track.id,labels);
  }
  return {references, maxFrameSkewSeconds:maxSkew};
}
