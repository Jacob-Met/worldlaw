#!/usr/bin/env node
/**
 * Cold prospective designer and separately sealed readout evaluator.
 * Supplied files never trigger sensors, endpoints or physical actuators.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {designActiveLinearFamily,replayActiveLinearFamily,ACTIVE_LINEAR_FAMILY_SCHEMA,
  designActiveInterventionFamily,replayActiveInterventionFamily,ACTIVE_INTERVENTION_SCHEMA,
  evaluateActiveLinearReadings}
  from '../src/science/active-linear-family.mjs';
const usage='Usage: node scripts/active-linear-family.mjs [--input FILE] [--output NEW_FILE] [--replay PLAN] [--readings FILE [--replay-readings PRIOR_RESULT]]';
let input='examples/active-linear-family-decays.json',output=null,replay=null,readings=null,replayReadings=null;
const argv=process.argv.slice(2);
for(let i=0;i<argv.length;i++){
  if(argv[i]==='--help'){console.log(usage);process.exit(0);}
  if(!['--input','--output','--replay','--readings','--replay-readings'].includes(argv[i])||i+1>=argv.length)
    throw Error(usage);
  const flag=argv[i],value=resolve(argv[++i]);
  if(flag==='--input')input=value;
  else if(flag==='--output')output=value;
  else if(flag==='--replay')replay=value;
  else if(flag==='--readings')readings=value;
  else replayReadings=value;
}
if(readings&&!replay)throw Error('Readouts require --replay PLAN from the prospective design.');
if(replayReadings&&!readings)throw Error('--replay-readings requires --readings and --replay PLAN.');
const bytes=await readFile(input);
const request=JSON.parse(bytes.toString('utf8'));
const multiple=request.schema===ACTIVE_INTERVENTION_SCHEMA;
if(!multiple&&request.schema!==ACTIVE_LINEAR_FAMILY_SCHEMA)
  throw Error('Unrecognized active experiment source schema; choose linear family or intervention family v1');
const core=multiple?designActiveInterventionFamily(request):designActiveLinearFamily(request);
const hash=value=>createHash('sha256').update(value).digest('hex');
const sourceSHA256=hash(bytes),planSHA256=hash(JSON.stringify(core));
let report={
  sourceSHA256,planSHA256,
  sourcePath:input,
  ...core,
  evidenceLevel:'source-conditional exact rational proof; no physical observation, acquisition, calibration or identified law',
};
if(replay){
  const old=JSON.parse(await readFile(replay,'utf8'));
  if(old.sourceSHA256!==report.sourceSHA256)
    throw Error('Original source bytes changed; cannot replay experiment certificate');
  if(old.planSHA256!==planSHA256)
    throw Error('Prospective plan digest changed; cannot replay experiment certificate');
  const prior=Object.fromEntries(Object.keys(core).map(k=>[k,old[k]]));
  if(multiple)replayActiveInterventionFamily(request,prior);
  else replayActiveLinearFamily(request,prior);
  console.error('Exact source and prospective schedule verified; no physical action replayed.');
}
if(readings){
  const readingBytes=await readFile(readings),supplied=JSON.parse(readingBytes.toString('utf8'));
  if(supplied.sourceSHA256!==sourceSHA256||supplied.planSHA256!==planSHA256)
    throw Error('Readout source or plan digest does not match the frozen prospective certificate.');
  const result=evaluateActiveLinearReadings(request,core,supplied);
  report={sourceSHA256,planSHA256,readingsSHA256:hash(readingBytes),sourcePath:input,
    planPath:replay,readingsPath:readings,...result,
    evidenceLevel:'Conditional exact consistency of supplied readings; physical origin, actuation and error calibration are not verified'};
  if(replayReadings){
    const old=JSON.parse(await readFile(replayReadings,'utf8'));
    const keys=['sourceSHA256','planSHA256','readingsSHA256',...Object.keys(result)];
    const take=value=>Object.fromEntries(keys.map(key=>[key,value[key]]));
    if(JSON.stringify(take(old))!==JSON.stringify(take(report)))
      throw Error('Readout bytes, source, plan or result changed; exact readout replay refused.');
    console.error('Exact source, frozen plan, readout bytes and conditional result verified.');
  }
}
if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
else process.stdout.write(JSON.stringify(report,null,2)+'\n');
if(['search_inconclusive','candidate_uncertified','readout_inconclusive'].includes(report.status))process.exitCode=2;
