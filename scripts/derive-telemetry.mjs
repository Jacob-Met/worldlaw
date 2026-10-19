#!/usr/bin/env node
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {basename} from 'node:path';
import {deriveTorqueObservations,splitTrajectoryEvidence} from '../src/science/trajectory-observations.mjs';

const help = `Derive an importable WORLDLAW observation dataset from angular telemetry.
Usage: node scripts/derive-telemetry.mjs --input telemetry.json --inertia 0.8
       [--window 7] [--position-sigma 0.001] [--training-fraction 0.7]

Input: an array, or {schema:"worldlaw.angular-telemetry/v1",samples:[...]};
each sample has time (seconds), unwrapped position (radians), command (N·m).
Inertia is known constant kg·m². JSON output goes to stdout; errors to stderr.
The output fits the studio's existing JSON observation import. No files change.
`;

try {
  const args=process.argv.slice(2);
  if(args.length===1 && args[0]==='--help') { process.stdout.write(help); }
  else {
    const allowed=new Set(['--input','--inertia','--window','--position-sigma','--training-fraction']);
    const values={};
    for(let i=0;i<args.length;i+=2) {
      if(!allowed.has(args[i]) || i+1>=args.length || Object.hasOwn(values,args[i])) throw new Error('Unknown, duplicate or incomplete argument. Use --help.');
      values[args[i]]=args[i+1];
    }
    if(!values['--input'] || values['--inertia']===undefined) throw new Error('--input and --inertia are required.');
    const numeric=(flag,defaultValue)=> {
      if(values[flag]===undefined) return defaultValue;
      const text=values[flag];
      if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text) || !Number.isFinite(Number(text))) throw new Error(`${flag} requires a finite decimal number.`);
      return Number(text);
    };
    const metadata=await stat(values['--input']);
    if(!metadata.isFile() || metadata.size>2_000_000) throw new Error('Input must be a JSON file no larger than 2 MB.');
    const bytes=await readFile(values['--input']);
    if(bytes.length>2_000_000) throw new Error('Input exceeds 2 MB.');
    const input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(input?.schema && input.schema!=='worldlaw.angular-telemetry/v1') throw new Error('Unsupported angular telemetry schema.');
    const expectedUnits={time:'s',position:'rad',command:'N·m'};
    if(input?.units && Object.entries(expectedUnits).some(([key,unit])=>input.units[key]!==unit)) throw new Error('Convert telemetry to seconds, unwrapped radians and N·m before deriving torque.');
    const derived=deriveTorqueObservations(Array.isArray(input)?input:input?.samples,{
      inertia:numeric('--inertia'),windowSize:numeric('--window',7),positionSigma:numeric('--position-sigma',null),
    });
    const split=splitTrajectoryEvidence(derived,{trainingFraction:numeric('--training-fraction',.7)});
    if(split.observations.length<8 || split.heldOut.length<1) throw new Error('After the source-window guard, at least 8 fitting rows and 1 held-out row are required. Supply more telemetry or change the split.');
    const sourceLabel=String(input?.source?.label || basename(values['--input'])).slice(0,160);
    const result={schema:'worldlaw.observations/v1',source:{
      label:`Derived angular telemetry — ${sourceLabel}`,kind:'derived_from_angular_position',
      units:{command:'N·m',position:'rad',rate:'rad/s',jointTorque:'N·m'},
      inputSha256:createHash('sha256').update(bytes).digest('hex'),
      derivation:{settings:derived.settings,diagnostics:derived.diagnostics,split:split.split},
    },observations:split.observations,heldOut:split.heldOut};
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
  }
} catch(error) {
  process.stderr.write(`Telemetry derivation failed: ${error.message}\n`);
  process.exitCode=1;
}
