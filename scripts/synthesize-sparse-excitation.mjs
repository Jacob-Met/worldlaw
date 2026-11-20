#!/usr/bin/env node
/** Source-only exact finite sparse actuation compiler and sealed replay. */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {
  synthesizeSparseExcitation,replaySparseExcitation,ACTIVE_SPARSE_SYNTHESIS_SCHEMA
} from '../src/science/active-control-synthesis.mjs';
const usage='Usage: node scripts/synthesize-sparse-excitation.mjs --input SOURCE.json [--output NEW_CERT.json] [--replay EXISTING_CERT.json]';
let input='examples/active-sparse-three-law.json',output=null,replay=null;
const argv=process.argv.slice(2);
for(let i=0;i<argv.length;i++){
  if(argv[i]==='--help'){console.log(usage);process.exit(0);}
  const option=argv[i],value=argv[++i];
  if(!['--input','--output','--replay'].includes(option)||!value)
    throw Error(usage);
  if(option==='--input')input=resolve(value);
  if(option==='--output')output=resolve(value);
  if(option==='--replay')replay=resolve(value);
}
const original=await readFile(input);
const source=JSON.parse(original);
if(source?.schema!==ACTIVE_SPARSE_SYNTHESIS_SCHEMA)
  throw Error('Expected source schema '+ACTIVE_SPARSE_SYNTHESIS_SCHEMA);
const result=synthesizeSparseExcitation(source);
const report={
  originalSourceSHA256:createHash('sha256').update(original).digest('hex'),
  sourcePath:input,
  ...result,
  evidenceLevel:'finite source-only exact model-conditional prospective sparse intervention; no physical acquisition, calibration or law identification'
};
if(replay){
  const prior=JSON.parse(await readFile(replay,'utf8'));
  if(prior.originalSourceSHA256!==report.originalSourceSHA256)
    throw Error('source bytes changed: preserve the original contract before replay');
  const body=Object.fromEntries(Object.keys(result).map(k=>[k,prior[k]]));
  replaySparseExcitation(source,body);
  console.error('Verified original source bytes and full exact sparse certificate; no physical action performed.');
}
if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
else process.stdout.write(JSON.stringify(report,null,2)+'\n');
if(result.exhausted)process.exitCode=2;
