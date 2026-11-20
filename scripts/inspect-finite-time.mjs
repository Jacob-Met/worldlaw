#!/usr/bin/env node
/** Read-only finite-time source-bound WORLDLAW angular model study. */
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {propagateFiniteTime} from '../src/finite-time/variational.mjs';

const MAX_BYTES=2*1024*1024;
const usage='Usage: node scripts/inspect-finite-time.mjs MODEL.json RUN.json [--max-step SECONDS] [--max-total-steps INTEGER]';
function load(path,label) {
 const size=statSync(path).size;
 if(!Number.isSafeInteger(size)||size<2||size>MAX_BYTES)throw Error(label+' file exceeds 2 MiB or is empty.');
 const raw=readFileSync(path);
 if(raw.byteLength!==size)throw Error(label+' changed during read.');
 return {value:JSON.parse(raw.toString('utf8')),sha256:createHash('sha256').update(raw).digest('hex')};
}
function options(args) {
 if(args.length<2||args.length>6)throw Error(usage);
 const [modelPath,runPath,...rest]=args;
 if(rest.length%2!==0)throw Error(usage);
 const params={};
 for(let i=0;i<rest.length;i+=2){
  const [name,value]=[rest[i],rest[i+1]];
  if(!['--max-step','--max-total-steps'].includes(name)||Object.hasOwn(params,name))throw Error('Unknown/repeated flag. '+usage);
  const number=Number(value);
  if(!value||!Number.isFinite(number))throw Error('Invalid numeric flag '+name);
  params[name]=number;
 }
 return {modelPath,runPath,settings:{...(params['--max-step']===undefined?{}:{maxStep:params['--max-step']}),
  ...(params['--max-total-steps']===undefined?{}:{maxTotalSteps:params['--max-total-steps']})}};
}
try {
 const {modelPath,runPath,settings}=options(process.argv.slice(2));
 const model=load(modelPath,'Model'),run=load(runPath,'Run');
 const result=propagateFiniteTime(model.value,run.value,settings);
 const receipt={...result,inputs:{modelSha256:model.sha256,runSha256:run.sha256},
  provenance:'exact input byte hashes; model and run are caller-supplied and not claimed as acquired physics'};
 process.stdout.write(JSON.stringify(receipt,null,2)+'\n');
} catch(error) {
 process.stderr.write('Finite-time study refused: '+error.message+'\n');
 process.exitCode=1;
}

