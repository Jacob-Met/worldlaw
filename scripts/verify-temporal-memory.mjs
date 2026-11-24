import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const dir=process.argv[2], read=n=>JSON.parse(readFileSync(join(dir,n),'utf8'));
const report=read('report.json');
assert.equal(readdirSync(dir).length,37);
assert.equal(report.rows.length,18);
const arms=['local','transient','wrongHistory','memory'];
const stats={};
const keys=new Set();
for(const row of report.rows){
  const key=[row.world,row.snr,row.seed].join('-');
  assert.ok(!keys.has(key));keys.add(key);
  const saved=read(key+'-predictions.json'), {truth,metrics}=read(key+'-score.json');
  assert.equal(truth.length,390);
  assert.deepEqual(metrics,row.metrics);
  for(const arm of arms){
    const states=saved[arm].states;
    assert.equal(saved[arm].diverged,states.length<390);
    for(const [h,name] of [[50,'short'],[390,'full']]){
      let a=0,b=0;
      if(states.length>=h){
        for(let i=0;i<h;i++)for(let j=0;j<2;j++){
          assert.ok(Number.isFinite(states[i][j])&&Number.isFinite(truth[i][j]));
          a+=(states[i][j]-truth[i][j])**2;b+=truth[i][j]**2;
        }
      }
      const actual=states.length<h?10:Math.min(10,Math.sqrt(a/Math.max(1e-12,b)));
      assert.ok(Math.abs(actual-row.metrics[arm][name])<1e-12);
    }
  }
  if(row.world==='outside_projected_lorenz'){
    let total=0,energy=0,max=-1,worst,mostControl;
    for(let t=0;t<390;t++){
      const e=saved.memory.states[t].reduce((s,v,j)=>s+(v-truth[t][j])**2,0);
      total+=e;energy+=truth[t].reduce((s,v)=>s+v*v,0);
      if(e>max){max=e;worst={suffixStep:t+1,truth:truth[t],prediction:saved.memory.states[t],
        transient:saved.transient.states[t],wrongHistory:saved.wrongHistory.states[t]};}
    }
    stats[key]={full:Math.sqrt(total/energy),lambda:row.metrics.memory.lambda,
      gradientMemory:row.metrics.memory.coefficients.at(-1),g:row.metrics.memory.prefixNuisance,worst};
  }
}
const ordered=Object.entries(stats).sort((a,b)=>b[1].full-a[1].full);
const controls=report.rows.filter(r=>r.world==='matched_local_cubic').sort((a,b)=>b.metrics.memory.full-a.metrics.memory.full);
const recompute=arms.filter(a=>a!=='memory').every(a=>{
  const v=report.rows.filter(r=>r.world==='outside_projected_lorenz');
  return v.filter(r=>r.metrics.memory.full<r.metrics[a].full).length>=7&&
      v.reduce((s,r)=>s+r.metrics.memory.full-r.metrics[a].full,0)<0;
});
assert.equal(recompute,report.gate);
console.log('FROZEN_AUDIT',JSON.stringify({forecasts:72,metrics:144,worlds:18,gate:recompute,
  omittedWorst:ordered[0],selectedDecay:ordered.map(([k,v])=>[k,v.lambda]),
  localWorst:{snr:controls[0].snr,seed:controls[0].seed,memory:controls[0].metrics.memory,
    transient:controls[0].metrics.transient.full,wrongHistory:controls[0].metrics.wrongHistory.full}}));
