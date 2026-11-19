#!/usr/bin/env node
/** Standalone exact structural physical-source analyzer; no service or GPU.
 *
 * Default: a real 5-channel observational *geometry* from the original
 * MAGF-ID Conf2 evidence and a list of explicitly UNPERFORMED independent
 * physical anchor measurements. This does not acquire a sensor.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {designPhysicalAnchors,replayPhysicalAnchorCertificate}
  from '../src/science/physical-identifiability.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const args=process.argv.slice(2);
const usage='Usage: node scripts/physical-identifiability.mjs [--input PATH] [--output PATH] [--replay CERTIFICATE.json]\nWithout --input the maintained original five-gyro source-only physical case is evaluated.';
let input=fileURLToPath(new URL('../examples/physical-gyro-identifiability.json',import.meta.url));
let output=null,replay=null;
for(let i=0;i<args.length;i++){
  const arg=args[i];
  if(arg==='--help'){console.log(usage);process.exit(0);}
  if(!['--input','--output','--replay'].includes(arg)||i+1>=args.length)
    throw Error(usage);
  const value=args[++i];
  if(arg==='--input')input=resolve(value);
  else if(arg==='--output')output=resolve(value);
  else replay=resolve(value);
}
const inputBytes=await readFile(input);
const source=JSON.parse(inputBytes.toString('utf8'));
const original=designPhysicalAnchors(source);
const payload={
  ...original,
  exactInputSHA256:sha(inputBytes),
  sourcePath:input,
  checkedAtRuntime:false,
  provenance:'Only declared source equations and candidate physical measurement contracts, no sensor reading, no noise calibration, no successful physical action claim.'
};
if(replay){
  const old=JSON.parse(await readFile(replay,'utf8'));
  if(old.exactInputSHA256!==payload.exactInputSHA256)
    throw Error('Source input checksum changed since certificate. Reopen the source before claiming replay.');
  replayPhysicalAnchorCertificate(source,
    Object.fromEntries(Object.keys(original).map(k=>[k,old[k]])));
  console.error('Exact replay reproduced full structural certificate; no physical measurement was replayed.');
}
const data=JSON.stringify(payload,null,2)+'\n';
if(output)await writeFile(output,data,{flag:'wx'});
else process.stdout.write(data);
if(!original.initial.allTargetsIdentifiable)
  console.error('Original observation geometry is structurally insufficient. Selected physical anchors are PROPOSED, not authenticated or acquired. No physical calibration or law change.');
if(original.status==='search_inconclusive')process.exitCode=2;
