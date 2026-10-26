import {validateOfferedInputs} from '../data.mjs';
import {predictAsymmetricDeadzone} from './asymmetric-command-deadzone.mjs';
import {rankPredictionRanges} from './prediction-range-plan.mjs';
export const MAX_MAPPED_PROBE_WORK=1_000_000;
const fields=['command','position','rate'];
export function checkedMappedOffers(raw){
 const offers=validateOfferedInputs(raw);
 if(!offers.length)throw Error('Supply at least one original offered state.');
 return offers;
}
/** No receiving outcomes enter this computation. Every globally competitive structure survives. */
export function planAsymmetricCommandExperiment(report,offeredInputs,{maxWork=MAX_MAPPED_PROBE_WORK}={}){
 const offers=checkedMappedOffers(offeredInputs);
 if(!report?.selected?.model||!Array.isArray(report.candidates)||!report.training?.length||!Number.isFinite(report.options?.ambiguityDelta))throw Error('Supply a complete asymmetric command comparison.');

 const ensemble=report.candidates.flatMap(c=>c.competitiveModels.filter(model=>model.metrics.score-report.selected.model.metrics.score<=report.options.ambiguityDelta).map(model=>({negative:c.negative,positive:c.positive,model,modelId:`${c.negative}/${c.positive}/${model.id}`})));
 if(!ensemble.length)throw Error('No globally competitive models are available.');
 const work=offers.length*ensemble.reduce((n,c)=>n+c.model.terms.length+1,0);
 if(!Number.isSafeInteger(maxWork)||maxWork<1||maxWork>MAX_MAPPED_PROBE_WORK||work>maxWork)throw Error('Complete mapped prediction course exceeds work limit; no shortlist accepted.');
 const domain=Object.fromEntries(fields.map(k=>[k,{min:Math.min(...report.training.map(r=>r[k])),max:Math.max(...report.training.map(r=>r[k]))}]));
 const predictions=offers.map((input,index)=>({index,input,predictions:ensemble.map(c=>({modelId:c.modelId,value:predictAsymmetricDeadzone(c,input)})),extrapolation:fields.filter(k=>input[k]<domain[k].min||input[k]>domain[k].max)}));
 return {...rankPredictionRanges(predictions,ensemble.map(c=>c.modelId),report.options.noiseSigma),ensemble:ensemble.map(c=>({modelId:c.modelId,negative:c.negative,positive:c.positive,structureId:c.model.id,score:c.model.metrics.score})),work:{reserved:work,limit:maxWork},domain,
  interpretation:'Training-only global competitive mapping/structure prediction range over explicitly offered original states. Includes every globally competitive structure, not just each mapping winner. This is a heuristic, not information gain, calibrated uncertainty, physical feasibility or permission to actuate. Receiving values are absent.'};
}
