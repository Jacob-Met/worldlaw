#!/usr/bin/env node
/**
 * Independent source-pinned Nullgarden receiver for Worldlaw's prospective
 * unknown-initial-state linear-law discrimination. All controls and the
 * 6-pair test design are fixed in source; outcomes are generated only after
 * the prospective design has frozen, never fed into its optimizer.
 */
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {designActiveInterventionFamily}
  from '../src/science/active-linear-family.mjs';

const pinnedNullgarden='75527fb3934f65310b63d6ac9880394c5b98dc29';
const seed=0x19a72fcd;
const source=resolve(process.env.NULLGARDEN_SOURCE||'');
const output=resolve(process.env.NULLGARDEN_ARTIFACT_DIR||'.receipts/active-family-nullgarden');
assert.ok(process.env.NULLGARDEN_SOURCE,
  'Receive independently pinned Nullgarden via NULLGARDEN_SOURCE');
assert.equal(execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),pinnedNullgarden);
assert.equal(execFileSync('git',['-C',source,'status','--porcelain','--untracked-files=all'],{encoding:'utf8'}).trim(),'');
const original=await readFile(new URL('../examples/active-intervention-family-decays.json',import.meta.url));
const contract=JSON.parse(original);
const choice=designActiveInterventionFamily(contract);
assert.equal(choice.status,'optimal_certified_intervention');
assert.equal(choice.chosenIntervention,'early_impulse');
assert.equal(choice.numReadings,3);
assert.ok(choice.pairProof.length===1&&choice.pairProof[0].robustCertified);
const intervention=contract.interventions.find(x=>x.id===choice.chosenIntervention);
const sham=contract.interventions.find(x=>x.id==='no_actuation');
assert.ok(sham);
const ticks=choice.chosenReadings.map(x=>x.tick);
const frac=value=>{
  const [n,d]=String(value).split('/');
  return Number(n)/Number(d??1);
};
const weights=choice.pairProof[0].witness.weights.map(frac);
const eps=frac(contract.noiseBound);
const norm=weights.reduce((s,v)=>s+Math.abs(v),0);
const theoreticalGap=Math.abs(frac(choice.pairProof[0].witness.signedGap));
assert.ok(theoreticalGap>2*eps*norm);
let state=seed;
const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return (state+.5)/4294967296;};
function simulate(model,controls,initial){
  let x=initial;
  const a=frac(model.A[0][0]),b=frac(model.B[0][0]),c=frac(model.C[0]);
  const y=[];
  for(let t=0;t<=controls.length;t++){
    y.push(c*x);
    if(t<controls.length)x=a*x+b*frac(controls[t][0]);
  }
  return y;
}
function evaluate(model,controls,initial){
  const y=simulate(model,controls,initial);
  return weights.reduce((s,w,i)=>s+w*(y[ticks[i]]+eps*(2*rand()-1)),0);
}
const datasets=Object.fromEntries(
  ['selected','no_actuation','constant'].map(name=>[name,['sample_id,batch,label,subject_id,contrast']]));
const pairs=[];
for(let pair=0;pair<6;pair++){
  const first=rand()<.5?0:1;
  const byLabel={};
  for(let subject=0;subject<2;subject++){
    const label=subject===0?first:1-first;
    const model=contract.hypotheses[label];
    const initial=20*(rand()-.5); // completely independent unobserved initial state
    const selected=evaluate(model,intervention.controls,initial);
    const idle=evaluate(model,sham.controls,initial);
    const features={selected,no_actuation:idle,constant:0};
    const id='p'+pair+'s'+subject;
    for(const [name,score] of Object.entries(features))
      datasets[name].push([id,'pair-'+pair,label,id,score.toPrecision(17)].join(','));
    byLabel[label]={selected,idle,initial};
  }
  const delta=Math.abs(byLabel[0].selected-byLabel[1].selected);
  assert.ok(delta>=theoreticalGap-2*eps*norm-1e-8,
    'heldout changed initial state invalidated the prospective robust witness');
  pairs.push({pair,selectedContrastGap:delta,initialStates:[byLabel[0].initial,byLabel[1].initial]});
}
await mkdir(output,{recursive:true});
const {makeServer}=await import(pathToFileURL(resolve(source,'server.mjs')).href);
const server=makeServer();
await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
const results={};
try{
  const post=async(path,body)=>{
    const response=await fetch('http://127.0.0.1:'+server.address().port+path,
      {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const data=await response.json();
    assert.equal(response.status,200,JSON.stringify(data));
    return data;
  };
  for(const [name,lines] of Object.entries(datasets)){
    const csv=lines.join('\n')+'\n';
    await writeFile(resolve(output,name+'.csv'),csv);
    const intake=await post('/api/dataset',{name:'Worldlaw frozen synthetic intervention '+name,csv});
    assert.equal(intake.n,12);
    assert.equal(intake.nSubjects,12);
    const report=await post('/api/run',{
      datasetId:intake.datasetId,
      controls:['within_batch_permutation','leave_batch_out','batch_only']
    });
    const p=report.results.within_batch_permutation;
    assert.equal(p.pExact,true);
    assert.equal(p.orbitSize,64);
    assert.equal(p.permsRun,64);
    if(name==='constant')assert.equal(p.p,1);
    if(name==='selected')assert.ok(p.p<=.05,'frozen 6-pair selected stimulus should separate synthetic labels');
    results[name]={p:p.p,report};
    await writeFile(resolve(output,name+'.json'),JSON.stringify({intake,report},null,2)+'\n');
  }
  const receipt={
    schema:'worldlaw.active-family-nullgarden-receiver/v1',
    sourceSha256:createHash('sha256').update(original).digest('hex'),
    nullgardenCommit:pinnedNullgarden,seed,
    scope:'Synthetic output from the source-declared competing scalar laws with independent hidden initial state; prospective input and observation schedule frozen before generating outcomes. No real sensor, physical intervention, noise calibration, mechanism identification, generalization claim.',
    selectedIntervention:choice.chosenIntervention,
    selectedReadings:choice.chosenReadings,
    theoreticalGap,
    perReadoutNoiseBound:eps,
    selectedWitness:choice.pairProof[0].witness,
    changedInitialStatePairProof:pairs,
    outcomes:results,
    negativeControls:['same initial-state unconstrained source law','no_actuation','constant','64 exact label permutations','source-pinned independent Nullgarden'],
  };
  await writeFile(resolve(output,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({status:'RECEIVED_SYNTHETIC_ONLY',selected:choice.chosenIntervention,
    readings:choice.numReadings,minimumObservedPairGap:Math.min(...pairs.map(p=>p.selectedContrastGap)),
    nullgarden:pinnedNullgarden,pValues:Object.fromEntries(Object.entries(results).map(([k,v])=>[k,v.p]))}));
}finally{
  await new Promise(done=>server.close(done));
}
