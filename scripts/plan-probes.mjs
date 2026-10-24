import {readFile} from 'node:fs/promises';
import {importProbeStudy} from '../src/unknown-lab/probe-response.mjs';
import {planProbeAcquisition,importProbePlan} from '../src/unknown-lab/probe-planner.mjs';
import {probeExample} from '../src/unknown-lab/probe-fixture.mjs';
try{
 const args=process.argv.slice(2);let plan;
 if(args.length===1&&args[0]==='--example'){
  const study=probeExample('ambiguous');study.runs=study.runs.filter(r=>r.role==='training');
  plan=planProbeAcquisition(study,{contrastRadius:.01,budget:4,probes:[{id:'correlated',position:.6,rate:.6,cost:1},{id:'zero-rate',position:.6,rate:0,cost:2},{id:'reversed',position:.6,rate:-.6,cost:4}]});
 }else if(args.length===2&&args[0]==='--reopen')plan=importProbePlan(await readFile(args[1],'utf8'));
 else if(args.length===4&&args[0]==='--study'&&args[2]==='--options'){
  const study=importProbeStudy(await readFile(args[1],'utf8'));study.runs=study.runs.filter(r=>r.role==='training');
  plan=planProbeAcquisition(study,JSON.parse(await readFile(args[3],'utf8')));
 }else throw Error('Usage: node scripts/plan-probes.mjs --example | --reopen request.json | --study study.json --options offered-probes.json');
 process.stdout.write(JSON.stringify(plan,null,2)+'\n');
}catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
