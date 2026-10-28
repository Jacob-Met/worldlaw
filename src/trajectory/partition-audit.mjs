import {segmentAudit} from './segment-audit.mjs';
export function partitionAudit(rows,boundaries){
 const whole=segmentAudit(rows);
 if(!Array.isArray(boundaries)||boundaries.length<2||boundaries.length>33||!boundaries.every(Number.isFinite)||boundaries.some((x,i)=>i&&x<=boundaries[i-1])||boundaries[0]!==whole.source[0].time||boundaries.at(-1)!==whole.source.at(-1).time)throw Error('Declare 2–33 increasing finite boundaries that exactly cover the original first and last times.');
 const scale=whole.source.reduce((m,r)=>Math.max(m,Math.abs(r.residual)),0);
 const epochs=boundaries.slice(1).map((end,index)=>({index,start:boundaries[index],end,pieces:[],linearNorm:0,squaredNorm:0,differenceNorm:0}));let e=0,pieceCount=0;
 for(const interval of whole.segments){const {earlier,later,duration}=interval,a=scale?earlier.residual/scale:0,b=scale?later.residual/scale:0;let start=earlier.time;
  while(start<later.time){while(e<epochs.length-1&&start>=epochs[e].end)e++;const epoch=epochs[e],end=Math.min(later.time,epoch.end),dt=end-start;
   const u=(start-earlier.time)/duration,v=(end-earlier.time)/duration,cu=(later.time-start)/duration,cv=(later.time-end)/duration;
   const ea=cu*a+u*b,eb=cv*a+v*b,linear=Math.hypot((ea+eb)/2,(ea-eb)/Math.sqrt(12));
   const rd=Math.sqrt(duration),ru=Math.sqrt(start-earlier.time)/rd,rv=Math.sqrt(end-earlier.time)/rd,rcu=Math.sqrt(later.time-start)/rd,rcv=Math.sqrt(later.time-end)/rd;
   const rm=Math.hypot(ru,rv)/Math.SQRT2,rcm=Math.hypot(rcu,rcv)/Math.SQRT2;
   const squared=Math.hypot(rcm*a,rm*b),difference=Math.abs(b-a)*Math.hypot(ru*rcu/Math.sqrt(6),Math.sqrt(2/3)*rm*rcm,rv*rcv/Math.sqrt(6));
   const rf=Math.sqrt(dt)/Math.sqrt(whole.span),re=Math.sqrt(dt)/Math.sqrt(epoch.end-epoch.start);
   epoch.linearNorm=Math.hypot(epoch.linearNorm,re*linear);epoch.squaredNorm=Math.hypot(epoch.squaredNorm,re*squared);epoch.differenceNorm=Math.hypot(epoch.differenceNorm,re*difference);
   epoch.pieces.push({earlier,later,start,end,duration:dt,u,v,startIsOriginal:start===earlier.time,endIsOriginal:end===later.time,linearContributionRMS:rf*linear*scale,squaredContributionRMS:rf*squared*scale,conventionDifferenceRMS:rf*difference*scale});pieceCount++;start=end;
  }
 }
 return {whole,boundaries:boundaries.slice(),pieceCount,epochs:epochs.map(({linearNorm,squaredNorm,differenceNorm,...epoch})=>({...epoch,linearResidualRMS:linearNorm*scale,linearSquaredResidualRMS:squaredNorm*scale,conventionDifferenceRMS:differenceNorm*scale})),meaning:'Complete attribution of the same two assumed curves, including the initial interval. Computed cuts are not observations. No refit, reset, or physical intersample bound.'};
}
