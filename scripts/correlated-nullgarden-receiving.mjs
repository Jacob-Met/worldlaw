import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {designCorrelatedReadings} from '../src/trajectory/correlated-gaussian-discriminator.mjs';

// Preregistered taskpost158869 before execution. No outcome-dependent seed,
// case, threshold or feature selection. These are authored sensor experiments.
const source='75527fb3934f65310b63d6ac9880394c5b98dc29',seed=0x47b32d91;
const root=resolve(process.env.NULLGARDEN_SOURCE||''),out=resolve(process.env.NULLGARDEN_ARTIFACT_DIR||'.receipts/correlated-nullgarden');
assert.ok(process.env.NULLGARDEN_SOURCE,'Provide the independently received exact Nullgarden source');
assert.equal(execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),source);
assert.equal(execFileSync('git',['-C',root,'status','--porcelain','--untracked-files=all'],{encoding:'utf8'}).trim(),'');
const {makeServer}=await import(pathToFileURL(resolve(root,'server.mjs')).href);
const tau=-1/Math.log(.99),times=[0,1,2];
const models=sign=>[0,1].map(m=>({modelId:`law-${m}`,rows:times.map((time,i)=>({time,position:i===0?0:m*(i===1?1:sign)}))}));
const acquired=designCorrelatedReadings(models(-1),{sigma:1,targetZ:3.29,maxReadings:2,correlationTime:tau});
const refused=designCorrelatedReadings(models(1),{sigma:1,targetZ:1.2,maxReadings:2,correlationTime:tau});
assert.equal(acquired.status,'distinguishable');
assert.deepEqual(acquired.readings.map(x=>x.sampleIndex),[1,2]);
assert.notEqual(refused.status,'distinguishable');
let state=seed;
const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return(state+.5)/4294967296;};
const normal=()=>Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random());
const difference=()=>{const first=normal(),second=.99*first+Math.sqrt(1-.99**2)*normal();return first-second;};
const datasets=Object.fromEntries(['acquired','sham','constant'].map(name=>[name,['sample_id,batch,label,subject_id,contrast']]));
for(let pair=0;pair<6;pair++){
  const firstLabel=Number(random()<.5);
  for(let subject=0;subject<2;subject++){
    const label=subject?1-firstLabel:firstLabel,id=`p${pair}s${subject}`;
    const features={acquired:2*label+difference(),sham:difference(),constant:0};
    for(const [name,feature]of Object.entries(features))datasets[name].push(`${id},pair-${pair},${label},${id},${feature}`);
  }
}
await mkdir(out,{recursive:true});
const server=makeServer();
await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
const results={};
try{
  const post=async(path,body)=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
    const value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;
  };
  for(const [name,lines]of Object.entries(datasets)){
    const csv=lines.join('\n')+'\n';await writeFile(resolve(out,name+'.csv'),csv);
    const intake=await post('/api/dataset',{name:`Worldlaw declared covariance: ${name}`,csv});
    assert.equal(intake.n,12);assert.equal(intake.nSubjects,12);
    const report=await post('/api/run',{datasetId:intake.datasetId,controls:['within_batch_permutation','leave_batch_out','batch_only']});
    await writeFile(resolve(out,name+'.json'),JSON.stringify({intake,report},null,2)+'\n');
    const permutation=report.results.within_batch_permutation;
    assert.equal(permutation.pExact,true);assert.equal(permutation.orbitSize,64);assert.equal(permutation.permsRun,64);
    if(name==='constant')assert.equal(permutation.p,1);
    results[name]=report;
  }
  const receipt={source,seed,scope:'Three fixed authored six-pair cohorts; conditional label randomization, no physical or general covariance-calibration claim. Sham p retained without retuning.',
    acquired,commonModeRefusal:refused,results};
  await writeFile(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify(receipt));
}finally{await new Promise(yes=>server.close(yes));}
