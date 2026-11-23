#!/usr/bin/env node
/**
 * Cold prospective designer and separately sealed readout evaluator.
 * Supplied files never trigger sensors, endpoints or physical actuators.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {BINARY_PLAN,MULTICLASS_PLAN} from '../src/science/active-guided-drift.mjs';
import {certifyMulticlassPositionDriftMinimum} from '../src/science/persistent-position-drift-multiclass-minimum.mjs';
import {planBinaryPositionDriftMinimum} from '../src/science/persistent-position-drift-all-horizon.mjs';
import {parseActiveOriginalJSON} from '../src/science/active-position-drift-readout.mjs';
import {recommendActiveFollowup,sealActivePlan,sealActiveReadout,replayActiveNotebook,receiveActiveNotebook,createActiveNotebook} from '../src/science/active-experiment-record.mjs';
const usage='Usage: node scripts/active-linear-family.mjs [--input FILE] [--output NEW_FILE] [--replay PLAN] [--readings FILE [--replay-readings PRIOR_RESULT]] | --notebook FILE [--readings FILE | --recommend INDEX] [--output NEW_FILE] | --input FILE [--binary-minimum | --multiclass-minimum [--enumerate-through N --word-budget N]] --create-notebook --output NEW_FILE | --input FILE --binary-minimum [--output NEW_FILE] | --input FILE --multiclass-minimum [--enumerate-through N --word-budget N] [--output NEW_FILE]';
let recommend=null,binaryMinimum=false,multiclassMinimum=false;
const searchLimits={};
let input='examples/active-linear-family-decays.json',output=null,replay=null,readings=null,replayReadings=null,notebook=null,inputChosen=false,createNotebook=false;
const argv=process.argv.slice(2);
for(let i=0;i<argv.length;i++){
  if(argv[i]==='--help'){console.log(usage);process.exit(0);}
  if(argv[i]==='--multiclass-minimum'){multiclassMinimum=true;continue;}
  if(argv[i]==='--enumerate-through'||argv[i]==='--word-budget'){
    const key=argv[i]==='--enumerate-through'?'enumerateThrough':'wordBudget';
    const raw=argv[++i];
    if(!/^(0|[1-9][0-9]*)$/.test(raw)||!Number.isSafeInteger(Number(raw)))throw Error(usage);
    searchLimits[key]=Number(raw);continue;
  }
  if(argv[i]==='--binary-minimum'){binaryMinimum=true;continue;}
  if(argv[i]==='--create-notebook'){createNotebook=true;continue;}
  if(!['--input','--output','--replay','--readings','--replay-readings','--notebook','--recommend'].includes(argv[i])||i+1>=argv.length)
    throw Error(usage);
  const flag=argv[i],raw=argv[++i];
  if(flag==='--recommend'){
    if(!/^(0|[1-9][0-9]*)$/.test(raw))throw Error('Recommendation index must be a nonnegative integer.');
    recommend=Number(raw);continue;
  }
  const value=resolve(raw);
  if(flag==='--input'){input=value;inputChosen=true;}
  else if(flag==='--output')output=value;
  else if(flag==='--replay')replay=value;
  else if(flag==='--readings')readings=value;
  else if(flag==='--replay-readings')replayReadings=value;
  else notebook=value;
}
if(binaryMinimum&&multiclassMinimum || Object.keys(searchLimits).length&&!multiclassMinimum)throw Error(usage);
if((binaryMinimum||multiclassMinimum)&&(!inputChosen||notebook||readings||replay||replayReadings||recommend!==null))
  throw Error('A minimum-horizon request requires --input, optionally with --create-notebook and --output.');
if(recommend!==null&&(!notebook||readings||createNotebook))throw Error('--recommend requires a preceding --notebook only.');
if(readings&&!replay&&!notebook)throw Error('Readouts require --replay PLAN or the preceding portable --notebook.');
if(replayReadings&&!readings)throw Error('--replay-readings requires --readings and --replay PLAN.');
if(notebook&&(inputChosen||replay||replayReadings||createNotebook))
  throw Error('--notebook replays its own original source, frozen plan and reading sets; do not mix input modes.');
if(createNotebook&&(!inputChosen||!output||replay||readings||replayReadings))
  throw Error('--create-notebook requires --input and --output and no separate plan or readings.');
let report;
if(multiclassMinimum&&!createNotebook){
  report=certifyMulticlassPositionDriftMinimum(parseActiveOriginalJSON(await readFile(input,'utf8')),searchLimits);
}else if(binaryMinimum&&!createNotebook){
  report=planBinaryPositionDriftMinimum(parseActiveOriginalJSON(await readFile(input,'utf8')));
}else if(notebook){
  const original=await readFile(notebook,'utf8');
  report=recommend!==null?await recommendActiveFollowup(original,recommend):readings?await receiveActiveNotebook(original,await readFile(readings,'utf8')):
    await replayActiveNotebook(original);
  console.error('Notebook source, frozen plan and every original reading set verified; physical origin is not authenticated.');
}else if(createNotebook){
  const design=binaryMinimum?{method:BINARY_PLAN}:multiclassMinimum?{method:MULTICLASS_PLAN,limits:searchLimits}:undefined;
  report=await createActiveNotebook(await readFile(input,'utf8'),{design});
}else{
const bytes=await readFile(input);
const prior=replay?parseActiveOriginalJSON(await readFile(replay,'utf8')):null;
const plan=await sealActivePlan(bytes,{prior,sourcePath:input});
if(replay)console.error('Exact source and prospective schedule verified; no physical action replayed.');
report=plan;
if(readings){
  const readingBytes=await readFile(readings);
  const old=replayReadings?parseActiveOriginalJSON(await readFile(replayReadings,'utf8')):null;
  report=await sealActiveReadout(bytes,plan,readingBytes,
    {prior:old,sourcePath:input,planPath:replay,readingsPath:readings});
  if(replayReadings)console.error('Exact source, frozen plan, readout bytes and conditional result verified.');
}
}
if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
else process.stdout.write(JSON.stringify(report,null,2)+'\n');
const status=report.status??report.readouts?.at(-1)?.result.status??report.plan?.status;
if(['search_inconclusive','candidate_uncertified','readout_inconclusive'].includes(status))process.exitCode=2;
