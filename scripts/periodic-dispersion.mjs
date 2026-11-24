#!/usr/bin/env node
import {fitDispersiveProbe,predictDispersiveProbe} from '../src/science/periodic-dispersion.mjs';
try{
  const chunks=[];let bytes=0;
  for await(const chunk of process.stdin){
    bytes+=chunk.length;if(bytes>4_000_000)throw Error('Observation budget exceeded');
    chunks.push(chunk);
  }
  const x=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!['fit','forecast'].includes(x.operation))throw Error('Use fit or forecast');
  const result=x.operation==='fit'?fitDispersiveProbe(x.recordings,x.modes):
    predictDispersiveProbe(x.model,x.prefix,x.spacing,x.steps);
  console.log(JSON.stringify(result));
}catch(error){console.error(error.message);process.exitCode=1;}
