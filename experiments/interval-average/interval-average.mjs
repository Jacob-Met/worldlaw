// Research-only trapezoidal observation operator on exact supplied prediction nodes.
// No interpolation, synthetic observed positions, or inferred exposure intervals.
export function averagePredictedIntervals(rows, intervals, {maxSegments=100000}={}) {
  if(!Array.isArray(rows)||rows.length<2||rows.length>10000)throw Error('Bounded complete prediction nodes required');
  if(!Array.isArray(intervals)||intervals.length<1||intervals.length>256)throw Error('Declare1–256 explicit observation intervals');
  if(!Number.isSafeInteger(maxSegments)||maxSegments<1||maxSegments>100000)throw Error('Bounded segment budget required');
  const index=new Map();
  rows.forEach((r,i)=>{if(!Number.isFinite(r.time)||!Number.isFinite(r.predicted)||Math.abs(r.time)>1e6||Math.abs(r.predicted)>1e6||(i&&r.time<=rows[i-1].time))throw Error('Finite strictly increasing prediction nodes required');index.set(r.time,i);});
  let work=0;
  const plan=intervals.map(r=>{
    if(!r||!Number.isFinite(r.start)||!Number.isFinite(r.end)||!(r.end>r.start)||!Number.isFinite(r.reportedTime)||!['center','end'].includes(r.timestampConvention))throw Error('Explicit finite ordered interval and timestamp convention required');
    const expected=r.timestampConvention==='center'?r.start+(r.end-r.start)/2:r.end;
    if(r.reportedTime!==expected)throw Error('Reported timestamp does not match declared convention');
    if(!index.has(r.start)||!index.has(r.end))throw Error('Interval endpoints require exact existing prediction nodes');
    const a=index.get(r.start),b=index.get(r.end);work+=b-a;
    return {r,a,b};
  });
  if(work>maxSegments)throw Error('Complete interval population exceeds segment budget');
  return {segments:work,method:'composite trapezoids on original prediction nodes; no observation interpolation',rows:plan.map(({r,a,b})=>{
    const duration=r.end-r.start;let sum=0;
    for(let i=a;i<b;i++)sum+=(rows[i+1].time-rows[i].time)/duration*(rows[i].predicted/2+rows[i+1].predicted/2);
    if(!Number.isFinite(sum))throw Error('Finite averaged prediction required');
    return {...r,averagePrediction:sum};
  })};
}
