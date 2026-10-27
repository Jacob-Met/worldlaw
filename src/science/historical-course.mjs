import {historicalTrainingContext} from './historical-training.mjs';
import {searchSharedTraining} from './shared-training-search.mjs';
import {checkSharedTrainingCertificate} from './shared-training-check.mjs';
export function historicalCourseContext(state,eventIndex,modelIndex=0,throughEvent=eventIndex){
 const anchor=historicalTrainingContext(state,eventIndex,modelIndex);
 if(!Number.isInteger(throughEvent)||throughEvent<eventIndex||throughEvent>=state.history.length||!state.history[throughEvent].experiment)throw Error('Choose a retained acquisition at or after the original anchor.');
 if(anchor.status!=='available')return anchor;
 const receiving=[],rowSources=[];let before=anchor.receipt.beforeCount;
 for(let index=eventIndex;index<=throughEvent;index++){
  const receipt=state.history[index].experiment;if(!receipt)continue;
  if(receipt.beforeCount!==before)throw Error('Acquisition sequence differs from the complete original source order.');
  if(receipt.bounded&&['command','position','rate'].some(k=>receipt.bounded.radii[k]!==0))return {...anchor,status:'unavailable',reason:'An acquired event declares coordinate uncertainty; the sequence checker requires exact coordinates.'};
  for(let row=0;row<receipt.rows.length;row++){
   const r=receipt.rows[row],actual=state.discovery.observations[before+row];
   if(!actual||['command','position','rate','jointTorque','torqueNoiseRatio'].some(k=>!Object.is(r[k],actual[k])))throw Error('Acquisition row differs from its original source.');
   receiving.push(structuredClone(r));rowSources.push({eventIndex:index,rowIndex:row,sourceIndex:before+row});
  }
  before+=receipt.rows.length;
 }
 if(receiving.length>128)return {...anchor,status:'unavailable',reason:'The complete selected acquisition sequence exceeds128 rows; no subset is checked.',throughEvent,receivingCount:receiving.length};
 return {...anchor,receiving,rowSources,throughEvent,status:'available'};
}
export function searchHistoricalCourse(state,eventIndex,modelIndex,throughEvent,options){const c=historicalCourseContext(state,eventIndex,modelIndex,throughEvent);return c.status==='available'?searchSharedTraining(c.model,c.training,c.receiving,options):{status:'unavailable',reason:c.reason};}
export function checkHistoricalCourse(state,eventIndex,modelIndex,throughEvent,options,certificate){const c=historicalCourseContext(state,eventIndex,modelIndex,throughEvent);if(c.status!=='available')throw Error(c.reason);return checkSharedTrainingCertificate(c.model,c.training,c.receiving,options,certificate);}
