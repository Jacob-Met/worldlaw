import{TERMS}from'./torque-discovery.mjs';
import{searchSharedTraining}from'./shared-training-search.mjs';
import{checkSharedTrainingCertificate}from'./shared-training-check.mjs';
const keys=['command','position','rate','jointTorque','torqueNoiseRatio'];
const same=(a,b)=>a&&b&&keys.every(k=>Object.is(a[k],b[k]));
export function challengeTrainingContext(state,eventIndex,modelIndex=0){
 if(!Number.isInteger(eventIndex)||eventIndex<1||eventIndex>=state.history.length)throw Error('Choose a retained independent challenge.');
 const h=state.history[eventIndex],receipt=h.challenge,event=state.events[eventIndex-1];
 if(!receipt||event?.kind!=='challenge'||state.lab)throw Error('Choose an imported original challenge, not a later refit.');
 if(!Number.isInteger(modelIndex)||modelIndex<0||modelIndex>=receipt.models.length)throw Error('Choose an original challenged law.');
 const training=[...state.base.observations,...state.events.slice(0,eventIndex-1).flatMap(e=>e.kind==='measurement'?e.rows:[])];
 if(training.length!==receipt.beforeCount||!training.every((r,i)=>same(r,state.discovery.observations[i])))throw Error('Original training source prefix differs from the retained challenge.');
 if(event.rows.length!==receipt.rows.length||!event.rows.every((r,i)=>same(r,receipt.rows[i])))throw Error('Original challenge source rows differ from its retained receipt.');
 const model=receipt.models[modelIndex],bounds=[];
 if(h.questionOutcome){const question=state.history[h.questionOutcome.questionEvent+1]?.question;if(!question)throw Error('Original challenge question reference is missing.');bounds.push(question.radii);}
 for(const e of state.events)if(e.kind==='assess-achieved-bounds'&&e.challengeEvent===eventIndex-1)bounds.push(e.radii);
 const base={receipt,model,training:structuredClone(training),receiving:structuredClone(receipt.rows),eventIndex,modelIndex,source:structuredClone(event.source),knownBounds:structuredClone(bounds)};
 if((receipt.options.loss??'least_squares')!=='least_squares'||(model.fitting?.loss??'least_squares')!=='least_squares')return{...base,status:'unavailable',reason:'Original challenged fit is robust or weighted; the maintained ordinary least-squares envelope does not apply.'};
 if(model.terms.length===0||model.terms.some(t=>!TERMS.some(x=>x.id===t.id)))return{...base,status:'unavailable',reason:'The maintained checker requires a nonempty named-term structure; generated terms are unsupported.'};
 if(bounds.some(r=>['command','position','rate'].some(k=>r[k]!==0)))return{...base,status:'unavailable',reason:'This original challenge has declared coordinate uncertainty. The shared-training checker requires exact coordinates and does not drop those bounds.'};
 return{...base,status:'available'};
}
export function searchChallengeTraining(state,eventIndex,modelIndex,options){const c=challengeTrainingContext(state,eventIndex,modelIndex);return c.status==='available'?searchSharedTraining(c.model,c.training,c.receiving,options):{status:'unavailable',reason:c.reason};}
export function checkChallengeTraining(state,eventIndex,modelIndex,options,certificate){const c=challengeTrainingContext(state,eventIndex,modelIndex);if(c.status!=='available')throw Error(c.reason);return checkSharedTrainingCertificate(c.model,c.training,c.receiving,options,certificate);}
