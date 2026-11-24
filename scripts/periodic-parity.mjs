#!/usr/bin/env node
import {chooseParityProbe,fitParityDecay,predictParityModes} from '../src/science/periodic-parity.mjs';

try {
  const chunks=[];
  let bytes=0;
  for await (const chunk of process.stdin) {
    bytes+=chunk.length;
    if(bytes>4_000_000)throw Error('State observations exceed four MB.');
    chunks.push(chunk);
  }
  const {operation,...job}=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  let result;
  if(operation==='design') result=chooseParityProbe(job.observedModes,job.menu,job.n,job.spacing);
  else if(operation==='fit') result=fitParityDecay(job.recordings,job.modes);
  else if(operation==='forecast') result=predictParityModes(job.model,job.prefix,job.times,job.spacing,job.modes);
  else throw Error('Use design, fit or forecast.');
  console.log(JSON.stringify(result));
} catch(error) {
  console.error(error.message);
  process.exitCode=1;
}
