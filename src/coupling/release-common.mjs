/** Shared reporting for retained release trajectories; never integrates or fits. */
import {requireThat} from './science.mjs';

export function compactReleaseTrajectory(run){
 return {status:run.status,screen:run.screen,failure:run.failure??null,
  domainStatus:run.refined?.domainStatus??null,firstOutside:run.refined?.firstOutside??null,
  steps:run.refined?run.coarse.steps+run.refined.steps:null};
}

export function compareRetainedReleasePair(a,b){
 if(a.refined&&b.refined)requireThat(a.refined.rows.length===b.refined.rows.length,'Release courses lost their common output population.','numerical_failure');
 const curve=a.refined&&b.refined?a.refined.rows.map((row,j)=>{
  const other=b.refined.rows[j];
  requireThat(row.time===other.time,'Release courses lost their common output clock.','numerical_failure');
  return {time:row.time,separation:Math.hypot(row.position[0]-other.position[0],row.position[1]-other.position[1])};
 }):[];
 const peak=curve.length?curve.reduce((best,row)=>row.separation>best.separation?row:best):null;
 return {curve,peak,screened:a.status==='screened'&&b.status==='screened'};
}

export function rankReleaseScores(releases,settings){
 const ranked=releases.filter(r=>r.status==='screened').sort((a,b)=>b.score-a.score||a.index-b.index);
 const best=ranked[0]??null;
 const bestIndices=best?ranked.filter(r=>best.score-r.score<=settings.tieTolerance).map(r=>r.index):[];
 const status=!best?'unresolved':best.score<=settings.minimumSeparation?'not_separated':'proposed';
 return {status,rankedIndices:ranked.map(r=>r.index),bestIndices,
  proposedIndices:status==='proposed'?bestIndices.filter(i=>releases[i].score>settings.minimumSeparation):[]};
}
