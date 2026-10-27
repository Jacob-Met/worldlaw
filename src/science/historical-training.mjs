import {TERMS} from './torque-discovery.mjs';
import {searchSharedTraining} from './shared-training-search.mjs';
import {checkSharedTrainingCertificate} from './shared-training-check.mjs';
// Derived receipts are reconstructed by the maintained session replayer. Never
// substitute the current refit or future readings for this original prefix.
export function historicalTrainingContext(state,eventIndex,modelIndex=0){
 if(!Number.isInteger(eventIndex)||eventIndex<1||eventIndex>=state.history.length)throw Error('Choose a retained acquisition event.');
 const receipt=state.history[eventIndex].experiment;
 if(!receipt)throw Error('This event has no acquired outcome.');
 if(!Number.isInteger(modelIndex)||modelIndex<0||modelIndex>=receipt.models.length)throw Error('Choose an original earlier model.');
 const model=receipt.models[modelIndex];
 const training=[...state.base.observations,...state.history.slice(1,eventIndex).flatMap(h=>h.experiment?.rows??[])];
 if(training.length!==receipt.beforeCount)throw Error('Earlier source prefix disagrees with its receipt.');
 const keys=['command','position','rate','jointTorque','torqueNoiseRatio'];
 const same=(a,b)=>a&&b&&keys.every(k=>Object.is(a[k],b[k]));
 if(!training.every((r,i)=>same(r,state.discovery.observations[i]))||!receipt.rows.every((r,i)=>same(r,state.discovery.observations[receipt.beforeCount+i])))throw Error('Receipt differs from the original source course.');
 const base={receipt,model,training:structuredClone(training),receiving:structuredClone(receipt.rows),eventIndex,modelIndex};
 if((receipt.options.loss??'least_squares')!=='least_squares'||(model.fitting?.loss??'least_squares')!=='least_squares')return {...base,status:'unavailable',reason:'Earlier fit is robust or weighted; the maintained ordinary least-squares envelope does not apply.'};
 if(model.terms.length===0||model.terms.some(t=>!TERMS.some(x=>x.id===t.id)))return {...base,status:'unavailable',reason:'The maintained checker requires a nonempty named-term structure; generated terms are not supported by its coefficient envelope.'};
 if(receipt.bounded&&['command','position','rate'].some(k=>receipt.bounded.radii[k]!==0))return {...base,status:'unavailable',reason:'Earlier receiving declares coordinate uncertainty. This shared-training checker requires exact coordinates and does not drop those bounds.'};
 return {...base,status:'available'};
}
export function searchHistoricalTraining(state,eventIndex,modelIndex,options){
 const c=historicalTrainingContext(state,eventIndex,modelIndex);if(c.status!=='available')return {status:'unavailable',reason:c.reason};
 return searchSharedTraining(c.model,c.training,c.receiving,options);
}
export function checkHistoricalTraining(state,eventIndex,modelIndex,options,certificate){
 const c=historicalTrainingContext(state,eventIndex,modelIndex);if(c.status!=='available')throw Error(c.reason);
 return checkSharedTrainingCertificate(c.model,c.training,c.receiving,options,certificate);
}
