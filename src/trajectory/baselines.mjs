/** No-learning reference forecasts. Never estimate velocity from test positions. */
const IDS = ['persistence', 'initial_rate'];
export function trajectoryBaselines(run) {
  if (!run || !Array.isArray(run.samples) || run.samples.length < 2 || run.samples.length > 10000 || !Number.isFinite(run.initialRate)) throw new Error('A finite initial rate and 2–10000 samples are required.');
  const first = run.samples[0];
  for (let i=0;i<run.samples.length;i++) {
    const sample=run.samples[i];
    if (!Number.isFinite(sample.time) || !Number.isFinite(sample.position) || (i && !(sample.time>run.samples[i-1].time))) throw new Error('Baseline samples need finite positions and strictly increasing finite times.');
  }
  return IDS.map(id=>{
    let norm=0;
    const scale=Math.sqrt(run.samples.length-1);
    const rows=run.samples.map((sample,index)=>{
      const elapsed=sample.time-first.time;
      const predicted=first.position+(id==='initial_rate'?run.initialRate*elapsed:0);
      const residual=sample.position-predicted;
      if (![elapsed,predicted,residual].every(Number.isFinite)) throw new Error('Baseline forecast exceeds finite numerical range.');
      if(index)norm=Math.hypot(norm,residual/scale);
      return {time:sample.time,predicted,observed:sample.position,residual};
    });
    if(!Number.isFinite(norm))throw new Error('Baseline RMSE exceeds finite numerical range.');
    return {id,runId:run.id,rows,count:rows.length-1,positionRMSE:norm,
      assumption:id==='persistence'?'Initial angle stays fixed.':'Supplied initial angular rate stays fixed; commands and forces are ignored.',
      observationsResetState:false,initialSampleExcludedFromMetrics:true};
  });
}
/** Compare complete, matched runs only. No winner selection or refitting. */
export function compareTrajectorySkill(runs, results, modelId) {
  if(!Array.isArray(runs)||!runs.length||new Set(runs.map(r=>r.id)).size!==runs.length)throw new Error('Supply distinct challenge runs.');
  const baselines=runs.map(trajectoryBaselines);
  const count=runs.reduce((n,run)=>n+run.samples.length-1,0);
  const reference=IDS.map((id,index)=>({id,count,positionRMSE:Math.hypot(...baselines.map(b=>b[index].positionRMSE*Math.sqrt(b[index].count/count)))}));
  if(reference.some(b=>!Number.isFinite(b.positionRMSE)))throw new Error('Aggregate baseline RMSE exceeds finite numerical range.');
  let modelNorm=0;
  const scale=Math.sqrt(count);
  const failedRunIds=[];
  for(const run of runs) {
    const matches=results.filter(result=>result.modelId===modelId&&result.runId===run.id);
    const result=matches[0],rows=result?.rollout?.rows;
    if(matches.length!==1||result.status!=='ok'||!Array.isArray(rows)||rows.length!==run.samples.length||rows.some((row,i)=>row.time!==run.samples[i].time||!Number.isFinite(row.predicted))) {failedRunIds.push(run.id);continue;}
    for(let i=1;i<rows.length;i++){
      const residual=run.samples[i].position-rows[i].predicted;
      if(!Number.isFinite(residual)){failedRunIds.push(run.id);break;}
      modelNorm=Math.hypot(modelNorm,residual/scale);
    }
  }
  const complete=failedRunIds.length===0&&Number.isFinite(modelNorm);
  const modelRMSE=complete?modelNorm:null;
  return {status:complete?'complete':'incomplete',modelId,count,runCount:runs.length,failedRunIds,modelRMSE,
    baselines:reference.map(b=>{const skill=complete&&b.positionRMSE>0?1-(modelRMSE/b.positionRMSE)**2:null;return {...b,skill:Number.isFinite(skill)?skill:null,skillStatus:!complete?'incomplete_model':b.positionRMSE===0?'perfect_baseline':Number.isFinite(skill)?'available':'numerical_range'};}),
    meaning:'Skill = 1 − model squared error / baseline squared error on identical non-initial samples; positive is better, negative is worse. Zero baseline error has undefined skill. No challenge-based model selection.',
    limitations:'No-learning references are not physical laws. Initial angle/rate are supplied; recording independence is not authenticated. Results describe these recordings, not generalization guarantees.'};
}
