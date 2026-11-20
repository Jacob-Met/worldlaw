#!/usr/bin/env node
/**
 * Cold source-only linear-law hypothesis experiment designer.
 * No values, sensors, endpoints or physical actuators are read.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {designActiveLinearFamily,replayActiveLinearFamily,ACTIVE_LINEAR_FAMILY_SCHEMA,
  designActiveInterventionFamily,replayActiveInterventionFamily,ACTIVE_INTERVENTION_SCHEMA}
  from '../src/science/active-linear-family.mjs';
const usage='Usage: node scripts/active-linear-family.mjs [--input FILE] [--output NEW_FILE] [--replay PRIOR_CERTIFICATE]';
let input='examples/active-linear-family-decays.json',output=null,replay=null;
const argv=process.argv.slice(2);
for(let i=0;i<argv.length;i++){
  if(argv[i]==='--help'){console.log(usage);process.exit(0);}
  if(!['--input','--output','--replay'].includes(argv[i])||i+1>=argv.length)
    throw Error(usage);
  const flag=argv[i],value=resolve(argv[++i]);
  if(flag==='--input')input=value;
  else if(flag==='--output')output=value;
  else replay=value;
}
const bytes=await readFile(input);
const request=JSON.parse(bytes.toString('utf8'));
const multiple=request.schema===ACTIVE_INTERVENTION_SCHEMA;
if(!multiple&&request.schema!==ACTIVE_LINEAR_FAMILY_SCHEMA)
  throw Error('Unrecognized active experiment source schema; choose linear family or intervention family v1');
const core=multiple?designActiveInterventionFamily(request):designActiveLinearFamily(request);
const report={
  sourceSHA256:createHash('sha256').update(bytes).digest('hex'),
  sourcePath:input,
  ...core,
  evidenceLevel:'source-conditional exact rational proof; no physical observation, acquisition, calibration or identified law',
};
if(replay){
  const old=JSON.parse(await readFile(replay,'utf8'));
  if(old.sourceSHA256!==report.sourceSHA256)
    throw Error('Original source bytes changed; cannot replay experiment certificate');
  const prior=Object.fromEntries(Object.keys(core).map(k=>[k,old[k]]));
  if(multiple)replayActiveInterventionFamily(request,prior);
  else replayActiveLinearFamily(request,prior);
  console.error('Exact source and prospective schedule verified; no physical action replayed.');
}
if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
else process.stdout.write(JSON.stringify(report,null,2)+'\n');
if(['search_inconclusive','candidate_uncertified'].includes(core.status))process.exitCode=2;
