import {summarizeBoundedReceipt} from './bounded-experiment-receipts.mjs';
import {receiveTrainingResponse} from './training-response-plan.mjs';
export function retainScalarQuestion(plan){
 if(plan.status!=='proposed'||!plan.selected||!plan.radii)throw Error('Choose an available bounded scalar suggestion before freezing its question.');
 return {...(plan.tiePolicy==='remaining-overlap'?{tiePolicy:plan.tiePolicy,remainingOverlap:structuredClone(plan.selected.remainingOverlap)}:{}),input:{...plan.selected.input},radii:{...plan.radii},method:plan.method,...(plan.trainingRadius!=null?{trainingRadius:plan.trainingRadius}:{}),intervals:structuredClone(plan.selected.intervals),pairs:structuredClone(plan.selected.pairs),evaluations:plan.evaluations,products:plan.products??0,pairComparisons:plan.pairComparisons};
}
export function receiveScalarQuestion(state,rows,receipt){
 const question=state.history.at(-1)?.question;if(!question)return null;
 const questionEvent=state.events.length-1;
 const base={questionEvent,plannedInput:{...question.input},actualInputs:rows.map(r=>Object.fromEntries(['command','position','rate'].map(k=>[k,r[k]])))};
 if(rows.length!==1)return {...base,status:'course-mismatch',reason:'This frozen question requests one original state; a batch is retained as actual evidence but does not execute that single-reading protocol.'};
 const deviated=['command','position','rate'].filter(k=>rows[0][k]!==question.input[k]);
 if(deviated.length)return {...base,status:'coordinate-deviation',deviated,reason:'Actual coordinates differ from the exact frozen question. Declared coordinate uncertainty is not permission to shift the measurement box. Original model separation is not claimed for this execution.'};
 const ids=question.intervals.map(x=>x.id);
 const originalReceipt={...receipt,models:receipt.models.filter(m=>ids.includes(m.id))};
 const originalDiscovery={...state.discovery,competitive:state.discovery.competitive.filter(m=>ids.includes(m.id))};
 if(originalReceipt.models.length!==ids.length)throw Error('Original question models differ from retained receiving models.');
 const used=state.history.reduce((n,h)=>n+(h.questionOutcome?.screen?.evaluations??0),0);
 const screen=question.trainingRadius!=null?receiveTrainingResponse(originalDiscovery,rows,question.radii,question.trainingRadius,used):summarizeBoundedReceipt(originalReceipt,question.radii,used);
 return {...base,status:'exact-coordinate-match',screen,qualification:'Coordinates match the frozen nominal question exactly; uncertainty, source and execution remain declarations. Original bounds are reused, not estimated from outcomes. Model exclusion is conditional and separate from later adaptation.'};
}
