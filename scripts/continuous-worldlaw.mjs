#!/usr/bin/env node
/** JSON consumer: plan, acquire independently, then score received evidence before refit. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createContinuousSession,planNextContinuous,continuousRequest,receiveContinuous,
  exportContinuousSession,restoreContinuousSession} from '../src/trajectory/continuous-session.mjs';
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':
  x&&typeof x==='object'?'{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const sha=x=>createHash('sha256').update(canonical(x)).digest('hex');
const predictionSeal=session=>sha({policyId:session.policyId,worldId:session.worldId,
  round:session.history.length+1,request:session.pending.plan.request,
  predictions:session.pending.plan.predictions});

export function continuousCommand(operation,input){
  let session;
  if(operation==='init'){
    session=createContinuousSession(input.setup??input);
  }else{
    if(!input||typeof input.notebook!=='string')throw new RangeError('Supply the retained input notebook');
    session=restoreContinuousSession(input.notebook);
    if(operation==='plan')session=planNextContinuous(session);
    else if(operation==='receive'){
      if(input.requestSHA256!==sha(input.request))throw new RangeError('Request digest mismatch');
      if(!session.pending||input.predictionSHA256!==predictionSeal(session))
        throw new RangeError('Restored predictions differ from the retained pre-acquisition seal');
      session=receiveContinuous(session,{request:input.request,run:input.run});
    }else if(operation!=='replay')throw new RangeError('Supported operations: init, plan, receive, replay');
  }
  const plan=session.pending?.plan??null;
  const assessments=session.history.map(h=>h.assessment.status);
  const disposition=assessments.includes('abstain')?'abstained':
    assessments.length&&assessments.every(s=>s==='not_rejected')?'not_rejected':'unqualified';
  const result={schema:'worldlaw.continuous-command-response/v1',operation,
    notebook:exportContinuousSession(session),policyId:session.policyId,worldId:session.worldId,
    completedRounds:session.history.length,selected:session.discovery.selected,
    modelStatus:'experimental_fit',scientificDisposition:disposition,
    interpretation:'A non-rejection does not establish law correctness or physical validity.',
    trainingDiagnostics:session.discovery.diagnostics,events:session.events,
    status:session.status==='refit_refused'?'refit_refused':plan?.status==='refused'?'refused':plan?'awaiting_acquisition':'ready',
    request:null,requestSHA256:null,predictionSHA256:null};
  if(plan){
    result.plan=plan;
    if(plan.status==='planned'){
      result.request=continuousRequest(session);
      result.requestSHA256=sha(result.request);
      result.predictionSHA256=predictionSeal(session);
    }
  }
  if(session.history.length)result.latestReceipt=session.history.at(-1);
  return result;
}
function main(){
  const args=process.argv.slice(2),operation=args.shift();
  if(!operation||operation==='--help'){
    console.log('node scripts/continuous-worldlaw.mjs init|plan|receive|replay [--input FILE] [--output FILE]');
    console.log('Read JSON on stdin. Retain the plan notebook and both hashes before acquiring; pass them with the received run.');
    return;
  }
  const options={};
  while(args.length){
    const key=args.shift(),value=args.shift();
    if(!['--input','--output'].includes(key)||!value||options[key])throw new RangeError('Invalid CLI arguments');
    options[key]=value;
  }
  const raw=readFileSync(options['--input']??0,'utf8');
  if(raw.length>3000000)throw new RangeError('Input exceeds3MB bounded notebook limit');
  const result=continuousCommand(operation,JSON.parse(raw));
  const text=JSON.stringify(result,null,2)+'\n';
  if(options['--output'])writeFileSync(options['--output'],text,{flag:'wx'});
  else process.stdout.write(text);
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  try{main();}catch(error){
    process.stderr.write(JSON.stringify({status:'refused',error:error.name,message:error.message})+'\n');
    process.exitCode=2;
  }
}
