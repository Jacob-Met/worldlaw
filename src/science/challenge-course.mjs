import {challengeTrainingContext} from './challenge-training.mjs';
import {searchSharedTraining} from './shared-training-search.mjs';
import {checkSharedTrainingCertificate} from './shared-training-check.mjs';
export function challengeCourseContext(state,eventIndex,modelIndex=0,throughEvent=eventIndex){
 const anchor=challengeTrainingContext(state,eventIndex,modelIndex);
 if(!Number.isInteger(throughEvent)||throughEvent<eventIndex||throughEvent>=state.history.length||!state.history[throughEvent].challenge)throw Error('Choose a retained independent challenge at or after the original anchor.');
 if(anchor.status!=='available')return anchor;
 const receiving=[],rowSources=[];
 for(let i=eventIndex;i<=throughEvent;i++){
  if(!state.history[i].challenge)continue;
  const c=challengeTrainingContext(state,i,i===eventIndex?modelIndex:0);
  if(c.knownBounds.some(r=>['command','position','rate'].some(k=>r[k]!==0)))return {...anchor,status:'unavailable',reason:'A challenge in the complete course declares coordinate uncertainty; exact coordinates are required.'};
  for(let j=0;j<c.receiving.length;j++){receiving.push(c.receiving[j]);rowSources.push({eventIndex:i,rowIndex:j,source:c.source});}
 }
 if(receiving.length>128)return {...anchor,status:'unavailable',reason:'The complete independent challenge course exceeds128 rows; no subset is checked.',receivingCount:receiving.length,throughEvent};
 return {...anchor,receiving,rowSources,throughEvent,status:'available'};
}
export function searchChallengeCourse(state,eventIndex,modelIndex,throughEvent,options){const c=challengeCourseContext(state,eventIndex,modelIndex,throughEvent);return c.status==='available'?searchSharedTraining(c.model,c.training,c.receiving,options):{status:'unavailable',reason:c.reason};}
export function checkChallengeCourse(state,eventIndex,modelIndex,throughEvent,options,certificate){const c=challengeCourseContext(state,eventIndex,modelIndex,throughEvent);if(c.status!=='available')throw Error(c.reason);return checkSharedTrainingCertificate(c.model,c.training,c.receiving,options,certificate);}
