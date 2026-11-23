#!/usr/bin/env node
/** Native-only development course. Child CLI processes see recordings, never private instrument parameters. */
import {readFileSync,mkdirSync,readdirSync,openSync,writeSync,fsyncSync,closeSync} from 'node:fs';
import {resolve,join,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createControlledInstrument,commandSamples} from '../src/trajectory/controlled-instrument.mjs';
import {discoverSindy} from '../src/trajectory/sindy-discovery.mjs';
import {rollout} from '../src/trajectory/forward.mjs';
import {residualScore} from '../src/trajectory/residual-abstention.mjs';
import {RUN_UNITS} from '../src/trajectory/data.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const P=JSON.parse(readFileSync(join(ROOT,'experiments/continuous-law-protocol.json'),'utf8'));
const canonical=x=>Array.isArray(x)?'['+x.map(canonical).join(',')+']':x&&typeof x==='object'?
  '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}':JSON.stringify(x);
const digest=x=>createHash('sha256').update(x).digest('hex'),hash=x=>digest(canonical(x));
const clone=x=>JSON.parse(JSON.stringify(x));
const check=(ok,text)=>{if(!ok)throw new RangeError(text);};
const err=e=>({name:e.name,code:e.code??null,message:e.message});
function save(path,value){
  const bytes=typeof value==='string'?value:JSON.stringify(value,null,2)+'\n';
  const fd=openSync(path,'wx');
  const intended=Buffer.from(bytes);
  try{let offset=0;while(offset<intended.length){
    const count=writeSync(fd,intended,offset,intended.length-offset);
    check(count>0,'Incomplete evidence write');offset+=count;
  }fsyncSync(fd);}finally{closeSync(fd);}
  const actual=readFileSync(path);check(actual.equals(intended),'Evidence readback differs before acquisition');
  return {file:path,bytes:actual.length,sha256:digest(actual)};
}
function sourceManifest(){
  const files=[];
  function visit(path){
    for(const e of readdirSync(path,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
      const next=join(path,e.name);
      if(e.isDirectory())visit(next);
      else if(e.isFile()&&/\.(mjs|json)$/.test(e.name)){
        const b=readFileSync(next);files.push({path:relative(ROOT,next),bytes:b.length,sha256:digest(b)});
      }
    }
  }
  for(const dir of ['src','scripts'])visit(join(ROOT,dir));
  for(const path of ['experiments/continuous-law-course.mjs','experiments/continuous-law-protocol.json']){
    const b=readFileSync(join(ROOT,path));files.push({path,bytes:b.length,sha256:digest(b)});
  }
  files.sort((a,b)=>a.path.localeCompare(b.path));
  return {schema:'worldlaw.runtime-source-manifest/v1',files,sha256:hash(files),
    identity:'Exact executed bytes; original pull-dispatch receipt separately binds requested Git commit.'};
}
function uniform(seed){let counter=0;return ()=>{
  const bytes=createHash('sha256').update('worldlaw-continuous-parameters/v1:'+seed+':'+counter++).digest();
  return (bytes.readUInt32BE(0)+.5)/4294967296;};}
function privateWorld(entry,phase){
  const u=uniform(entry.seed),families=['spring','gravity','duffing'];
  const drawnFamily=families[Math.floor(3*u())],drawnActuator=u()<.5?'linear':'cubic';
  const family=entry.family??drawnFamily,actuator=entry.actuator??drawnActuator;
  const gain=.8+.4*u(),damping=.12+.18*u();
  const spring=.7+.5*u(),gravity=.8+.5*u(),duffingSpring=.6+.4*u(),duffingCubic=.15+.2*u();
  const restoring=family==='spring'?{spring}:family==='gravity'?{gravity}:{spring:duffingSpring,cubic:duffingCubic};
  const hidden={coupling:.7+.6*u(),frequency:1+.6*u(),damping:.15+.15*u()};
  return {worldId:'wlcv1-'+phase+'-'+entry.seed,seed:entry.seed,family,actuator,
    instrument:{inertia:P.inertia,noiseSigma:P.noiseSigma,seed:(entry.seed^0x6a09e667)>>>0,
      maximumAcquisitions:4,drive:{[actuator]:gain},restoring,damping,
      ...(entry.outOfFamily?{hidden}:{}),amplitudeBounds:[-1,1],integrationStep:P.instrumentMaximumStep},
    truth:{outOfFamily:!!entry.outOfFamily,terms:{[actuator==='linear'?'command':'command_cubic']:gain,
      rate:-damping,...Object.fromEntries(Object.entries(restoring).map(([k,v])=>[k,-v]))},
      hidden:entry.outOfFamily?hidden:null}};
}
function request(s){
  return {schema:'worldlaw.continuous-command-request/v1',inertia:P.inertia,
    initialPosition:s.initialPosition,initialRate:s.initialRate,duration:8,dt:.04,noiseSigma:P.noiseSigma,
    segments:s.amplitudes.map((amplitude,i)=>({startIndex:50*i,endIndex:50*(i+1),amplitude})),
    commandConvention:'hold amplitude on [startIndex*dt,endIndex*dt); terminal value unused'};
}
function cli(operation,input,directory,name){
  const inputRecord=save(join(directory,name+'.input.json'),input),startedAt=new Date().toISOString();
  const r=spawnSync(process.execPath,[join(ROOT,'scripts/continuous-worldlaw.mjs'),operation],
    {cwd:ROOT,input:JSON.stringify(input),encoding:'utf8',maxBuffer:12*1024*1024,timeout:180000});
  const outputRecord=save(join(directory,name+'.stdout.json'),r.stdout??'');
  save(join(directory,name+'.process.json'),{operation,startedAt,finishedAt:new Date().toISOString(),
    status:r.status,signal:r.signal,error:r.error?err(r.error):null,stderr:r.stderr??'',inputRecord,outputRecord});
  check(!r.error&&r.status===0,'CLI '+operation+' failed: '+(r.stderr||r.error?.message||r.signal));
  const parsed=JSON.parse(r.stdout);
  check(parsed.schema==='worldlaw.continuous-command-response/v1','Unexpected CLI response schema');
  return parsed;
}
function fitSindy(runs){
  try{const d=discoverSindy(runs,P.sindy);return d.status==='fit'?
    {status:'fit',model:d.selected,diagnostics:d.diagnostics}:
    {status:'refused',diagnostics:d.diagnostics,reason:d.reason??null};
  }catch(e){return {status:'refused',error:err(e)};}
}
function gradeModel(model,truth){
  if(!model)return {exactSupport:false,actuatorCorrect:false,coefficientRelativeError:null,coldLawSuccess:false};
  const expected=Object.keys(truth.terms).sort(),actual=model.terms.map(t=>t.id).sort();
  const exactSupport=canonical(actual)===canonical(expected),actuator=expected.includes('command')?'command':'command_cubic';
  const actuatorCorrect=actual.includes(actuator)&&!actual.includes(actuator==='command'?'command_cubic':'command');
  const coefficients=Object.fromEntries(model.terms.map(t=>[t.id,t.coefficient])),ids=[...new Set([...expected,...actual])];
  const coefficientRelativeError=Math.hypot(...ids.map(id=>(coefficients[id]??0)-(truth.terms[id]??0)))/
    Math.hypot(...Object.values(truth.terms));
  return {exactSupport,actuatorCorrect,coefficientRelativeError,
    coldLawSuccess:exactSupport&&coefficientRelativeError<=P.grading.coefficientTolerance};
}
function forecast(model,r){
  try{const {samples}=commandSamples(r);
    const placeholder={id:'sealed-final-holdout',label:'Unknown holdout',kind:'unknown',
      source:{label:'Only prescribed grid and initial conditions; no held observations'},units:{...RUN_UNITS},
      inertia:r.inertia,initialRate:r.initialRate,samples:samples.map(s=>({...s,position:r.initialPosition}))};
    const prediction=rollout(model,placeholder,{maxStep:.01,maxSteps:100000,positionDomain:P.planner.positionDomain});
    return {status:'predicted',model,positions:prediction.rows.map(row=>row.predicted),diagnostics:prediction.diagnostics};
  }catch(e){return {status:'refused',model,error:err(e)};}
}
function arm(world,policy,directory){
  mkdirSync(directory);
  const instrument=createControlledInstrument({...world.instrument,sourceId:world.worldId});
  let response=null,sourceModel=null,sourceSindy=null;
  const runs=[],scores=[],receipts=[];
  const finish=(status,error=null)=>{
    const result={status,error,sourceModel,sourceSindy,selected:response?.selected??null,sindy:fitSindy(runs),
      scores,receipts,usage:instrument.usage(),completedRounds:scores.length,
      trainingRows:runs.reduce((n,r)=>n+r.samples.length,0),sourceEvidenceHashes:runs.slice(0,2).map(hash),
      scientificDisposition:response?.scientificDisposition??'unqualified'};
    save(join(directory,'arm-summary.json'),result);return result;
  };
  try{
    for(const [i,s] of P.sourceRequests.entries()){
      const r=request(s);save(join(directory,'source-'+i+'.request.json'),r);
      const run=instrument.acquire(r);save(join(directory,'source-'+i+'.run.json'),run);runs.push(run);
    }
    sourceSindy=fitSindy(runs);save(join(directory,'source-sindy.json'),sourceSindy);
    response=cli('init',{setup:{trainingRuns:runs,fitOptions:P.fit,plannerConfig:P.planner,policy,
      policyId:P.protocolId+':'+policy,worldId:world.worldId,seed:parseInt(digest('policy-seed:'+world.seed).slice(0,8),16),maxRounds:P.maxRounds}},directory,'init');
    sourceModel=response.selected;
    for(let round=1;round<=P.maxRounds;round++){
      const plan=cli('plan',{notebook:response.notebook},directory,'round-'+round+'-plan');
      check(plan.status==='awaiting_acquisition'&&plan.request&&plan.plan?.status==='planned','Planner refused a required round');
      check(hash(plan.request)===plan.requestSHA256,'Request hash differs from owned request');
      check(hash({policyId:plan.policyId,worldId:plan.worldId,round,request:plan.request,
        predictions:plan.plan.predictions})===plan.predictionSHA256,'Forecast hash differs from pre-acquisition plan');
      const seal=save(join(directory,'round-'+round+'-pre-acquisition-seal.json'),
        {event:'forecast_saved_before_acquisition',worldId:world.worldId,policy,round,savedAt:new Date().toISOString(),
          requestSHA256:plan.requestSHA256,predictionSHA256:plan.predictionSHA256,planResponseSHA256:hash(plan)});
      // No access to this round's observations occurs before this fsynced seal.
      const acquired=instrument.acquire(clone(plan.request));
      const observed=save(join(directory,'round-'+round+'.run.json'),acquired);runs.push(acquired);
      response=cli('receive',{notebook:plan.notebook,request:plan.request,
        requestSHA256:plan.requestSHA256,predictionSHA256:plan.predictionSHA256,run:acquired},
        directory,'round-'+round+'-receive');
      check(response.completedRounds===round&&response.latestReceipt?.round===round,'Incomplete paid receipt');
      const scored=response.events.findIndex(e=>e.type==='prospective_residual_scored_before_refit'&&e.round===round);
      const refitted=response.events.findIndex(e=>(e.type==='model_refit_after_receipt'||e.type==='refit_refused')&&e.round===round);
      check(scored>=0&&refitted>scored,'Score-before-refit event order changed');
      scores.push(response.latestReceipt.residual.score);
      receipts.push({round,seal,observed,assessment:response.latestReceipt.assessment,
        requestSHA256:plan.requestSHA256,predictionSHA256:plan.predictionSHA256,
        selectedAfter:response.latestReceipt.selectedAfter,planWork:plan.plan.work});
      check(response.status!=='refit_refused','Paid acquisition retained but refitting refused');
    }
    const replay=cli('replay',{notebook:response.notebook},directory,'final-replay');
    check(hash(replay.selected)===hash(response.selected)&&replay.completedRounds===2,'Replay changed model or receipt count');
    return finish('complete');
  }catch(e){return finish('refused',err(e));}
}
function runWorld(entry,phase,directory,activePolicy){
  const world=privateWorld(entry,phase);mkdirSync(directory);
  const arms=Object.fromEntries(P.comparison.policies.map(policy=>[policy,arm(world,policy==='active'?activePolicy:policy,join(directory,policy))]));
  const commonSource=hash(arms.active.sourceEvidenceHashes)===hash(arms.random.sourceEvidenceHashes),r=request(P.holdoutRequest);
  const models={weak_source:arms.active.sourceModel,sindy_source:arms.active.sourceSindy?.model??null,
    weak_active:arms.active.status==='complete'?arms.active.selected:null,
    weak_random:arms.random.status==='complete'?arms.random.selected:null,
    sindy_active:arms.active.status==='complete'?(arms.active.sindy?.model??null):null,
    sindy_random:arms.random.status==='complete'?(arms.random.sindy?.model??null):null};
  const forecasts=Object.fromEntries(Object.entries(models).map(([name,model])=>[name,
    model?forecast(model,r):{status:'refused',reason:'No fully acquired model'}]));
  const jointSeal=save(join(directory,'holdout-all-forecasts.json'),{
    event:'all_final_forecasts_saved_before_outcome',worldId:world.worldId,savedAt:new Date().toISOString(),request:r,forecasts});
  const heldInstrument=createControlledInstrument({...world.instrument,sourceId:world.worldId+'-held',
    seed:(world.seed^0xbb67ae85)>>>0,maximumAcquisitions:1});
  const held=heldInstrument.acquire(r),heldReceipt=save(join(directory,'holdout-observations.json'),held);
  const metrics=Object.fromEntries(Object.entries(forecasts).map(([name,f])=>{
    const fit=gradeModel(f.model,world.truth),available=f.status==='predicted';
    return [name,{fitOnlyExactSupport:fit.exactSupport,fitOnlyColdLawSuccess:fit.coldLawSuccess,
      exactSupport:available&&fit.exactSupport,actuatorCorrect:available&&fit.actuatorCorrect,
      coldLawSuccess:available&&fit.coldLawSuccess,coefficientRelativeError:fit.coefficientRelativeError,
      forecastStatus:f.status,heldRmsInNoiseUnits:available?
        residualScore([f.positions],held.samples.map(s=>s.position),P.noiseSigma).score:null}];
  }));
  save(join(directory,'truth-opened-after-forecast.json'),{worldId:world.worldId,seed:world.seed,
    family:world.family,actuator:world.actuator,truth:world.truth,jointSeal,heldReceipt});
  const executionQualified=commonSource&&Object.values(arms).every(a=>a.status==='complete'&&a.completedRounds===2&&
    a.trainingRows===P.comparison.observationBudgetPerArm)&&
    ['weak_source','weak_active','weak_random'].every(name=>forecasts[name].status==='predicted');
  const result={worldId:world.worldId,seed:world.seed,family:world.family,actuator:world.actuator,
    commonSource,executionQualified,arms,metrics,jointSeal,heldReceipt};
  save(join(directory,'world-summary.json'),result);return result;
}
function main(){
  const args=process.argv.slice(2),options={};
  while(args.length){const k=args.shift(),v=args.shift();check(['--stage','--output','--active-policy'].includes(k)&&v&&!options[k],'Invalid arguments');options[k]=v;}
  check(options['--stage']==='development','Only six-world development is implemented. Calibration and evaluation remain closed.');
  const activePolicy=options['--active-policy']??'active';
  check(['active','active_joint'].includes(activePolicy),'Unknown development acquisition policy');
  check(options['--output'],'Require a fresh output directory');
  const output=resolve(options['--output']);mkdirSync(output,{recursive:false});
  const source=sourceManifest(),startedAt=new Date().toISOString();
  save(join(output,'runtime-source-manifest.json'),source);save(join(output,'protocol.json'),P);
  const worlds=[];
  for(const entry of P.sourceWorlds){
    try{const w=runWorld(entry,'development',join(output,'world-'+entry.seed),activePolicy);worlds.push(w);
      console.log(JSON.stringify({event:'development_world_finished',worldId:w.worldId,
        executionQualified:w.executionQualified,metrics:w.metrics}));
    }catch(e){const failure={seed:entry.seed,executionQualified:false,error:err(e)};worlds.push(failure);
      save(join(output,'world-'+entry.seed+'-failure.json'),failure);
      console.log(JSON.stringify({event:'development_world_failed',...failure}));}
  }
  const summary={schema:'worldlaw.continuous-development-receipt/v1',protocolId:P.protocolId,
    activePolicy,protocolSHA256:hash(P),runtimeSourceSHA256:source.sha256,startedAt,finishedAt:new Date().toISOString(),
    worldsExpected:P.sourceWorlds.length,worldsFinished:worlds.length,
    executionQualified:worlds.length===6&&worlds.every(w=>w.executionQualified),
    calibrationOpened:false,evaluationOpened:false,scope:P.scope,
    worlds:worlds.map(w=>({worldId:w.worldId??null,seed:w.seed,executionQualified:w.executionQualified,
      family:w.family??null,actuator:w.actuator??null,error:w.error??null,metrics:w.metrics??null,
      arms:w.arms?Object.fromEntries(Object.entries(w.arms).map(([policy,a])=>[policy,{
        status:a.status,completedRounds:a.completedRounds,trainingRows:a.trainingRows,
        scores:a.scores,usage:a.usage,error:a.error??null}])):null}))};
  const receipt=save(join(output,'development-summary.json'),summary);
  console.log(JSON.stringify({event:'development_course_finished',output,receipt,summary}));
  if(!summary.executionQualified)process.exitCode=2;
}
try{main();}catch(e){console.error(JSON.stringify({status:'refused',error:err(e)}));process.exitCode=2;}
