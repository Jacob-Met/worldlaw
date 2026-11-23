import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const cli=fileURLToPath(new URL('../scripts/continuous-worldlaw.mjs',import.meta.url));
const instrumentURL=new URL('../src/trajectory/controlled-instrument.mjs',import.meta.url).href;

function command(operation,input,expectedExit=0){
  const processResult=spawnSync(process.execPath,[cli,operation],{
    input:JSON.stringify(input),encoding:'utf8',maxBuffer:8*1024*1024,timeout:20000
  });
  if(processResult.error)throw processResult.error;
  assert.equal(processResult.status,expectedExit,processResult.stderr);
  if(expectedExit===0)return JSON.parse(processResult.stdout);
  assert.equal(processResult.stdout,'');
  const refusal=JSON.parse(processResult.stderr);
  assert.equal(refusal.status,'refused');
  return refusal;
}

// One separate instrument process owns the device for all three reads. The
// parent sends only the actual actuator request across this channel.
function openInstrument(parameters){
  const program=[
    'import {createControlledInstrument} from '+JSON.stringify(instrumentURL)+';',
    'const device=createControlledInstrument('+JSON.stringify(parameters)+');',
    'process.on("message",request=>{',
    '  try{process.send({run:device.acquire(request),reads:device.usage().acquired});}',
    '  catch(error){process.send({error:error.message});}',
    '});'
  ].join('\n');
  const child=spawn(process.execPath,['--input-type=module','--eval',program],
    {stdio:['ignore','ignore','inherit','ipc']});
  function acquire(request){
    return new Promise((resolve,reject)=>{
      const cleanup=()=>{
        child.off('message',message);
        child.off('error',failure);
        child.off('exit',exit);
      };
      const failure=error=>{cleanup();reject(error);};
      const exit=(code,signal)=>failure(new Error('Instrument exited: '+code+' '+signal));
      const message=reply=>{
        cleanup();
        if(reply.error)reject(new Error(reply.error));
        else resolve(reply);
      };
      child.once('message',message);
      child.once('error',failure);
      child.once('exit',exit);
      child.send(request,error=>{if(error)failure(error);});
    });
  }
  return {acquire,close:()=>child.kill()};
}

test('separate CLI processes verify a prospective seal, receive the actual command response and replay it',
  {timeout:60000},async t=>{
  const sigma=1e-6,worldId='subprocess-world';
  const device=openInstrument({sourceId:worldId,inertia:1,noiseSigma:sigma,seed:21,
    maximumAcquisitions:3,drive:{cubic:2},damping:0});
  t.after(device.close);
  function sourceRequest(initialPosition,sign){
    return {schema:'worldlaw.continuous-command-request/v1',inertia:1,initialPosition,initialRate:.2,
      duration:4,dt:.05,noiseSigma:sigma,segments:[1,-1,1,-1].map((u,i)=>
        ({startIndex:i*20,endIndex:(i+1)*20,amplitude:u*sign}))};
  }
  const first=await device.acquire(sourceRequest(.1,1));
  const second=await device.acquire(sourceRequest(-.1,-1));
  assert.deepEqual([first.reads,second.reads],[1,2]);
  const setup={trainingRuns:[first.run,second.run],worldId,policy:'active',policyId:'process-control',
    seed:7,maxRounds:1,fitOptions:{terms:['command','command_cubic'],maxTerms:1,noiseSigma:sigma,
      windowDuration:.5,windowStride:.25},plannerConfig:{inertia:1,initialPosition:.1,initialRate:.2,
      duration:4,dt:.05,maxStep:.02,amplitudeBounds:[-1,1],segmentDurations:[1,1,1,1],
      positionDomain:[-100,100],noiseSigma:sigma,starts:2,sweeps:2,maxTotalSteps:1000000,
      maxRefinementError:1e-8,minSeparation:3}};
  const initialized=command('init',{setup});
  assert.equal(initialized.status,'ready');
  const plan=command('plan',{notebook:initialized.notebook});
  assert.equal(plan.status,'awaiting_acquisition');
  assert.match(plan.requestSHA256,/^[a-f0-9]{64}$/);
  assert.match(plan.predictionSHA256,/^[a-f0-9]{64}$/);
  assert.equal(plan.completedRounds,0);
  const applied=await device.acquire(plan.request);
  assert.equal(applied.reads,3);
  assert.deepEqual(applied.run.source.request,plan.request);
  const input={notebook:plan.notebook,request:plan.request,requestSHA256:plan.requestSHA256,
    predictionSHA256:plan.predictionSHA256,run:applied.run};
  const flip=digest=>(digest[0]==='0'?'1':'0')+digest.slice(1);
  assert.match(command('receive',{...input,requestSHA256:flip(plan.requestSHA256)},2).message,
    /Request digest mismatch/);
  assert.match(command('receive',{...input,predictionSHA256:flip(plan.predictionSHA256)},2).message,
    /predictions differ/);
  const received=command('receive',input);
  assert.equal(received.completedRounds,1);
  assert.equal(received.selected.id,'command_cubic');
  assert.deepEqual(received.latestReceipt.plan.predictions,plan.plan.predictions);
  assert.deepEqual(received.latestReceipt.run,applied.run);
  assert.equal(received.latestReceipt.residual.rowsUsed,80);
  assert.equal(received.scientificDisposition,'unqualified');
  assert.deepEqual(received.events.map(event=>event.type),['source_fit',
    'predictions_owned_before_acquisition','prospective_residual_scored_before_refit','model_refit_after_receipt']);
  const replay=command('replay',{notebook:received.notebook});
  assert.deepEqual(replay.latestReceipt,received.latestReceipt);
  assert.deepEqual(replay.selected,received.selected);
  assert.deepEqual(replay.events,received.events);
});
