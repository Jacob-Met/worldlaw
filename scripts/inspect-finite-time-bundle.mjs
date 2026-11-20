#!/usr/bin/env node
/** Source-bound read-only finite-time sensitivity from an original angular bundle. */
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createChallenge} from '../src/trajectory/session.mjs';
import {propagateFiniteTime} from '../src/finite-time/variational.mjs';
import {ANGULAR_BUNDLE_SCHEMA} from '../src/trajectory/angular-discovery.mjs';

const USAGE='Usage: node scripts/inspect-finite-time-bundle.mjs ANGULAR_BUNDLE.json [--challenge-id ID] [--method weak|integral] [--max-step SECONDS] [--max-total-steps INTEGER]';
try {
 const args=process.argv.slice(2);
 if(args.length<1||args.length>9||(args.length-1)%2!==0)throw Error(USAGE);
 const [path,...rest]=args, opts={};
 for(let i=0;i<rest.length;i+=2){
  const name=rest[i],value=rest[i+1];
  if(!['--challenge-id','--method','--max-step','--max-total-steps'].includes(name)||!value||Object.hasOwn(opts,name))throw Error(USAGE);
  opts[name]=value;
 }
 const method=opts['--method']??'weak';
 if(!['weak','integral'].includes(method))throw Error('Choose weak or integral training method.');
 const maxStep=opts['--max-step']===undefined?.01:Number(opts['--max-step']);
 const maxTotalSteps=opts['--max-total-steps']===undefined?400000:Number(opts['--max-total-steps']);
 if(!(Number.isFinite(maxStep)&&maxStep>=1e-5&&maxStep<=.1))throw Error('maxStep must be 0.00001–0.1 seconds.');
 if(!(Number.isSafeInteger(maxTotalSteps)&&maxTotalSteps>=2&&maxTotalSteps<=1000000))throw Error('maxTotalSteps must be 2–1000000.');
 const bytes=statSync(path).size;
 if(!Number.isSafeInteger(bytes)||bytes<2||bytes>2*1024*1024)throw Error('Original bundle file must be 2–2097152 bytes.');
 const raw=readFileSync(path);
 if(raw.length!==bytes)throw Error('Original source changed during read.');
 const bundle=JSON.parse(raw.toString('utf8'));
 if(bundle?.schema!==ANGULAR_BUNDLE_SCHEMA)throw Error('Expected a WORLDLAW angular source bundle.');
 if(!Array.isArray(bundle.challengeRuns)||!bundle.challengeRuns.length)throw Error('Original angular bundle requires a challenge course.');
 const id=opts['--challenge-id'];
 if(!id&&bundle.challengeRuns.length!==1)throw Error('Declare --challenge-id when the original bundle has more than one challenge.');
 const run=bundle.challengeRuns.find(v=>v.id===(id??bundle.challengeRuns[0].id));
 if(!run)throw Error('Requested challenge ID is absent from the original source.');
 const trained=createChallenge(bundle,{method,modelLimit:1});
 const model=trained.discovery.selected;
 const transition=propagateFiniteTime(model,run,{maxStep,maxTotalSteps});
 const digest=createHash('sha256').update(raw).digest('hex');
 process.stdout.write(JSON.stringify({
  schema:'worldlaw.finite-time-bundle-receipt/v1',
  originalBundleSha256:digest,
  originalBundleLabel:bundle.label,
  modelSelection:{method,trainingOnly:true,selectedId:model.id,terms:model.terms},
  target:{runId:run.id,kind:run.kind,sourceLabel:run.source?.label},
  transition,
  limitations:[
   'The maintained discovery model is chosen from the supplied training courses, not from receiving challenge errors.',
   'The source-provided measured/synthetic kind and provenance are not independently authenticated.',
   'Measured training/challenge reuse is not new blind validation or evidence of a physical mechanism.',
   ...transition.limitations
  ]
 },null,2)+'\n');
} catch(error) {
 process.stderr.write('Finite-time bundle study refused: '+error.message+'\n');
 process.exitCode=1;
}

