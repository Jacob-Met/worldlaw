/** Prospective finite-profile disagreement, never a physical acquisition. */
import {validateOfferedInputs} from '../data.mjs';
import {predictAngularFrequency} from './angular-frequency.mjs';
const key=r=>JSON.stringify([r.command,r.position,r.rate]);
export function compareFrequencyOffers(report,rawOffers,{maxWork=1000000}={}) {
  if(report?.schema!=='worldlaw.angular-frequency-profile/v1')throw Error('Compute a complete angular-frequency profile first.');
  const offers=validateOfferedInputs(rawOffers),seen=new Set(report.training.map(key));
  const models=[],modelsSeen=new Set();
  for(const profile of [report.noPeriod,...report.profile])for(const model of profile.candidates){
    if(model.score-report.selected.score>report.settings.ambiguityDelta)continue;
    const identity=JSON.stringify([model.frequency,model.terms,model.sine,model.cosine]);
    if(!modelsSeen.has(identity)){modelsSeen.add(identity);models.push(model);}
  }
  const reserved=models.length*offers.length;
  if(!Number.isSafeInteger(maxWork)||maxWork<1||maxWork>1000000||reserved>maxWork)throw Error('Complete original offered course exceeds prediction budget.');
  const outcomes=offers.map((input,sourceIndex)=>{
    const predictions=models.map((model,modelIndex)=>({modelIndex,frequency:model.frequency,value:predictAngularFrequency(model,input)}));
    const values=predictions.map(p=>p.value),spread=values.length?Math.max(...values)-Math.min(...values):0;
    return {input,sourceIndex,previouslyObserved:seen.has(key(input)),predictions,spread};
  });
  const available=outcomes.filter(o=>!o.previouslyObserved).sort((a,b)=>b.spread-a.spread||a.sourceIndex-b.sourceIndex);
  const best=available[0]??null,selected=report.status==='residual_mismatch'?null:best;
  return {status:report.status==='residual_mismatch'?'unsupported_training':!selected?'no_unobserved_offers':models.length<2||selected.spread<=2*report.settings.noiseSigma?'uninformative':'proposed',
    selected,outcomes,models,work:{reserved,limit:maxWork},interpretation:'Maximum spread across the retained competitive sampled profile only. Not a continuous-family envelope, calibrated information gain or guarantee that the new reading will improve prediction.'};
}
