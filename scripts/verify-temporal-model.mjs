#!/usr/bin/env node
import {independentTemporalEvidence} from '../src/science/temporal-evidence.mjs';
try {
  const chunks=[];
  let bytes=0;
  for await(const chunk of process.stdin){
    bytes+=chunk.length;
    if(bytes>4_000_000)throw Error('Verification recording exceeds four MB');
    chunks.push(chunk);
  }
  const {model,recording}=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  console.log(JSON.stringify(independentTemporalEvidence(model,recording)));
} catch(error){console.error(error.message);process.exitCode=1;}
