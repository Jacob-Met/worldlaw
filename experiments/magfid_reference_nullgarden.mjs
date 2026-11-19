// Source-pinned independent Nullgarden receiving for MAGF-ID Conf_2.
//
// This compares two frozen *forecasting algorithms on identical originals*.
// It is NOT a randomized physical intervention or a p-value about true physics.
// Four independent recordings permit 2^4=16 conditional allocations, not 64.
import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const args=process.argv.slice(2);
assert.equal(args.length,2,
  'Usage: NULLGARDEN_SOURCE=/exact/pinned/nullgarden node experiments/magfid-reference-nullgarden.mjs FINAL_TEST_JSON NEW_OUTPUT_DIR');
assert.ok(process.env.NULLGARDEN_SOURCE,'Independent Nullgarden original source required');
const work=resolve(process.env.NULLGARDEN_SOURCE);
const here=dirname(fileURLToPath(import.meta.url));
const planBytes=await readFile(resolve(here,'../research/magfid-covariance/nullgarden-control-plan.json'));
const plan=JSON.parse(planBytes);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(execFileSync('git',['-C',work,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),plan.nullgarden_commit);
assert.equal(execFileSync('git',['-C',work,'status','--porcelain','--untracked-files=all'],{encoding:'utf8'}).trim(),'');
const testBytes=await readFile(resolve(args[0]));
const test=JSON.parse(testBytes);
assert.equal(test.schema,'worldlaw.magfid-conf2-reference.v1.test');
assert.equal(test.partition,'test');
assert.equal(test.scores.recordings,4);
assert.ok(test.test_freeze_sha256&&test.train_model_sha256&&test.source_selection_sha256);
assert.equal(test.promotion?.gates?.independent_nullgarden_receipt,false,
  'Original physical receiver must never self-assert external causal qualification');
const source=test.scores.methods.reference_shared.recording_scores;
const baseline=test.scores.methods.contrast_only.recording_scores;
assert.equal(source.length,4);
assert.equal(baseline.length,4);
const output=resolve(args[1]);
await mkdir(output); // Refuse overwriting prior scientific evidence.
const {makeServer}=await import(pathToFileURL(resolve(work,'server.mjs')).href);
const {parseCsv}=await import(pathToFileURL(resolve(work,'src/data.mjs')).href);
const {repeatedCv,fitScore,conditionalOrbitSize,conditionalLabelAssignments}=
  await import(pathToFileURL(resolve(work,'src/core.mjs')).href);
const server=makeServer();
await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
const results={};
try{
  const post=async (path,body)=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify(body)});
    const value=await response.json();
    assert.equal(response.status,200,JSON.stringify(value));
    return value;
  };
  for(const kind of ['conditional_candidate_vs_contrast','identical_candidate_sham']){
    const lines=['sample_id,batch,label,subject_id,normalized_covariance_mse'];
    for(let i=0;i<4;i++){
      for(let label=0;label<2;label++){
        const val=label===0?source[i]:
          kind==='conditional_candidate_vs_contrast'?baseline[i]:source[i];
        assert.ok(Number.isFinite(val)&&val>=0,
          'Nonfinite normalized physical score must refuse Nullgarden import');
        const feature=val.toPrecision(12);
        for(let repeat=0;repeat<2;repeat++){
          lines.push(`r${i}m${label}t${repeat},physical-recording-${i},${label},r${i}m${label},${feature}`);
        }
      }
    }
    const csv=lines.join('\n')+'\n';
    await writeFile(resolve(output,kind+'.csv'),csv,{flag:'wx'});
    const ds=parseCsv(csv);
    assert.equal(ds.n,16);
    const intake=await post('/api/dataset',{name:'MAGF-ID Conf2: '+kind,csv});
    assert.equal(intake.n,16);
    assert.equal(intake.nSubjects,8);
    const http=await post('/api/run',{datasetId:intake.datasetId,
      controls:['within_batch_permutation','leave_batch_out','batch_only']});
    // Public HTTP product hardwires five folds. Four independent recordings
    // cannot justify that product; retain its exact refusal as evidence.
    const statistic=labels=>repeatedCv({...ds,y:labels},(train,heldout)=>
      fitScore(train.map(i=>ds.X[i]),train.map(i=>labels[i]),
        heldout.map(i=>ds.X[i]),plan.model_budget_k),
      {seed:plan.seed,repeats:3,folds:2});
    const observed=statistic(ds.y);
    const orbit=conditionalOrbitSize(ds.batch,ds.y,16,ds.subject);
    assert.equal(orbit,16);
    const distribution=[];
    let observedAllocations=0;
    for(const labels of conditionalLabelAssignments(ds.batch,ds.y,
        {maxAssignments:16,subject:ds.subject})){
      if(labels.every((label,i)=>label===ds.y[i]))observedAllocations++;
      distribution.push(statistic(labels));
    }
    assert.equal(distribution.length,16);
    assert.equal(observedAllocations,1);
    const valid=observed!==null&&Number.isFinite(observed)
      &&distribution.every(x=>x!==null&&Number.isFinite(x));
    const tail=valid?distribution.filter(x=>x>=observed).length/16:null;
    const conservative=tail===null?null:Math.max(tail,1/16);
    results[kind]={
      csv_sha256:digest(csv),http,
      nullgarden_original_commit:plan.nullgarden_commit,
      independently_frozen_data_grouping:'4 independent matched original recordings, 2 branch subjects and 2 repeated rows per recording',
      pairwise_forecasting_comparison_not_physical_intervention:true,
      conditional_orbit_size:16,
      observed_auc:observed,
      conditional_exact_tail_fraction:tail,
      conservative_resolution:conservative,
      technical_repeats_are_not_independent:true,
      conditional_exchangeability_is_not_randomized:true,
      valid,
      null_auc:distribution,
      csv_count:16,
      no_new_recording_transfer_claim:true,
    };
  }
  const receipt={
    schema:'worldlaw.magfid-conf2-independent-nullgarden.v1',
    receiver_sha256:digest(await readFile(fileURLToPath(import.meta.url))),
    pinned_original_nullgarden_commit:plan.nullgarden_commit,
    source_test_sha256:digest(testBytes),
    source_freeze_sha256:test.test_freeze_sha256,
    prior_plan_sha256:digest(planBytes),
    independent_original_test_records:4,
    calculations:results,
    boundary:'Four original recordings, engineered algorithm labels, technically repeated rows and selected forecast models. This has no physical causal p-value and cannot certify absolute sensor calibration or transferable planner settings.',
  };
  await writeFile(resolve(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({sha256:digest(await readFile(resolve(output,'receipt.json'))),
     results:Object.fromEntries(Object.entries(results).map(([k,v])=>[k,{
       observed_auc:v.observed_auc,exact_tail_fraction:v.conditional_exact_tail_fraction,
       valid:v.valid,orbit:v.conditional_orbit_size,
       http_naive:v.http.results?.naive}]))}));
} finally {
  await new Promise(yes=>server.close(yes));
}
