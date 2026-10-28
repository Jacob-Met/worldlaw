/** Separate two differences in already executed amplification samples.
 * This identity is about finite grids, not an estimate of the exact trajectory. */
export function decomposeReleasePeakSamples(coarse,fine){
 const admit=(rows,label)=>{
  if(!Array.isArray(rows)||!rows.length)throw Error('Supply a complete '+label+' sample grid');
  let previous=-Infinity;
  for(const row of Array.from(rows)){
   if(!row||!Number.isFinite(row.time)||row.time<0||row.time<=previous||!Number.isFinite(row.positive)||row.positive<0||!Number.isFinite(row.negative)||row.negative<0)throw Error('Invalid '+label+' sample grid');
   previous=row.time;
  }
 };
 admit(coarse,'coarse');admit(fine,'fine');
 if(coarse[0].time!==fine[0].time||coarse.at(-1).time!==fine.at(-1).time)throw Error('Compare the same complete time interval');
 const fineByTime=new Map(fine.map(row=>[row.time,row]));
 const peak=rows=>{let witness=null;for(const row of rows)for(const side of ['positive','negative'])if(!witness||row[side]>witness.value)witness={value:row[side],time:row.time,side};return witness;};
 const fineShared=coarse.map(row=>{const matched=fineByTime.get(row.time);if(!matched)throw Error('Fine grid must contain every exact coarse sample time');return matched;});
 const coarsePeak=peak(coarse),fineSharedPeak=peak(fineShared),finePeak=peak(fine);
 return {coarsePeak,fineSharedPeak,finePeak,
  sharedGridPeakShift:fineSharedPeak.value-coarsePeak.value,
  additionalSamplePeakGain:finePeak.value-fineSharedPeak.value,
  totalPeakShift:finePeak.value-coarsePeak.value,
  interpretation:'The shared-grid peak shift compares two numerical executions at original times. The additional-sample gain compares the fine execution with its own original-time subset. Their sum is the total sampled-peak shift up to floating-point rounding; neither component bounds continuous-time error.'};
}
