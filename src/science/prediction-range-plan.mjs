/** Shared deterministic ranking of an already evaluated complete offered course. */
export function rankPredictionRanges(offers,modelIds,noiseSigma){
 if(!Array.isArray(offers)||!offers.length||!Array.isArray(modelIds)||!modelIds.length||!Number.isFinite(noiseSigma)||noiseSigma<0)throw Error('Invalid complete prediction course.');
 const ranked=offers.map(offer=>{
  if(!Array.isArray(offer.predictions)||offer.predictions.length!==modelIds.length||offer.predictions.some((p,i)=>p.modelId!==modelIds[i]||!Number.isFinite(p.value)))throw Error('Incomplete or nonfinite prediction course.');
  const values=offer.predictions.map(p=>p.value),disagreement=Math.max(...values)-Math.min(...values);
  if(!Number.isFinite(disagreement))throw Error('Prediction range exceeds numerical capacity.');
  return {...offer,disagreement};
 }).sort((a,b)=>b.disagreement-a.disagreement||a.index-b.index);
 return {status:modelIds.length>1&&ranked[0].disagreement>2*noiseSigma?'proposed':'uninformative',selected:ranked[0],ranked,modelIds,
  method:'maximum_competitive_model_prediction_range',interpretation:'A heuristic among caller-permitted inputs; no physical actuation is performed.'};
}
