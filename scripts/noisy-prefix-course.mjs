/** Execute the registered fresh course; all truth remains in acquisition/scoring. */
import {mkdirSync,readFileSync,writeFileSync,renameSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {gzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {availableParallelism,totalmem} from 'node:os';
import {getHeapStatistics} from 'node:v8';
import {laws,layoutFor,rollout} from '../src/trajectory/field-law-dictionary.mjs';
import {activeDesign,identify} from '../src/trajectory/noisy-field-intervention.mjs';
import {compareResetHistories,contenderDesign} from '../src/trajectory/reset-history-intervals.mjs';
import {initial,outsider,rng,scrambled} from './noisy-field-acquisition.mjs';
import {acquireHistoryPair} from './generate-reset-histories.mjs';

const output=process.argv[2];
if(!output)throw Error('usage: node scripts/noisy-prefix-course.mjs OUTPUT_DIR');
mkdirSync(output,{recursive:true});
const protocolPath='experiments/noisy-prefix-initialization/protocol.json';
const rawProtocol=readFileSync(new URL('../'+protocolPath,import.meta.url));
const protocol=JSON.parse(rawProtocol),rows=[];
const digest=x=>createHash('sha256').update(x).digest('hex');
const sourcePaths=['src/science/prefix-state-fit.mjs','src/science/state-trajectory.mjs',
  'src/science/trajectory-operator-synthesis.mjs','src/science/linear-fit.mjs',
  'src/trajectory/field-law-dictionary.mjs','src/trajectory/noisy-field-intervention.mjs',
  'src/trajectory/reset-history-intervals.mjs','scripts/noisy-field-acquisition.mjs',
  'scripts/generate-reset-histories.mjs','scripts/noisy-prefix-course.mjs',protocolPath];
const sources=Object.fromEntries(sourcePaths.map(path=>[path,digest(readFileSync(new URL('../'+path,import.meta.url)))]));
let commit=null;try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
const report={schema:protocol.schema,status:'running',protocolSha256:digest(rawProtocol),sources,commit,
  githubRun:process.env.GITHUB_RUN_ID??null,environment:{node:process.version,availableParallelism:availableParallelism(),
    hostMemoryBytes:totalmem(),heapLimitBytes:getHeapStatistics().heap_size_limit,
    limits:'Node heap cap only; no aggregate kernel memory limit asserted'},rows};
function save() {
  const tmp=join(output,'report.pending');
  writeFileSync(tmp,JSON.stringify(report)+'\n');renameSync(tmp,join(output,'report.json'));
}
function observeIndependent(clean,layout,drive,db,seed) {
  const random=rng(seed),values=clean.map(row=>row.slice()),sigma=[],realizedSnrDb=[];
  for(let k=0;k<clean[0].length;k++) {
    const signal=clean.map(row=>row[k]),mean=signal.reduce((s,x)=>s+x,0)/signal.length;
    const power=signal.reduce((s,x)=>s+(x-mean)**2,0)/signal.length,scale=Math.sqrt(power)*10**(-db/20);
    if(!(scale>0))throw Error('zero signal channel');
    let noisePower=0;
    for(let t=0;t<values.length;t++) {
      const noise=scale*Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random());
      values[t][k]+=noise;noisePower+=noise*noise/values.length;
    }
    sigma.push(scale);realizedSnrDb.push(10*Math.log10(power/noisePower));
  }
  return {recording:{layout,drive,values,sigma},realizedSnrDb};
}
const definitions=[['contender',contenderDesign,'weak'],['committee',activeDesign,'weak'],
  ['random',null,'weak'],['passive',()=>({drive:-1}),'sindy']];
function runCell(id,index,world,db) {
  const {seed,coefficients}=world,layout=layoutFor(id),outside=!laws[layout].includes(id);
  const start=initial(layout,seed),vstart=initial(layout,seed+982451653),key=seed+10163*index+421*db;
  function acquire(s,drive,noiseSeed) {
    const clean=outside?outsider(id,s,drive,coefficients):rollout(id,coefficients,s,drive);
    if(!clean)throw Error('nonfinite acquisition '+id);
    return observeIndependent(clean,layout,drive,db,noiseSeed);
  }
  const pilotAcq=acquire(start,-1,key+1),verifyAcq=acquire(vstart,2,key+3);
  const pilot=pilotAcq.recording,verification=verifyAcq.recording;
  const shuffledPilot=scrambled(pilot,key+5),shuffledVerification=scrambled(verification,key+11);
  const pair=acquireHistoryPair(id,coefficients,start,vstart,db,key+1000003),memory=compareResetHistories(...pair);
  const randomDrive=Math.floor(rng(key+47)()*8),arms={},responses={},realizedSnrDb={pilot:pilotAcq.realizedSnrDb,verification:verifyAcq.realizedSnrDb,responses:{}};
  for(const [arm,planner,method] of definitions) {
    const plan=planner??(()=>({drive:randomDrive})),intended=plan(pilot),shamIntent=plan(shuffledPilot);
    const acquired=acquire(start,intended.drive,key+2),shamAcquired=acquire(start,shamIntent.drive,key+2);
    const response=acquired.recording,shamResponse=scrambled(shamAcquired.recording,key+7);
    const oldOptions={scoreStart:protocol.prefixPoints};
    const newOptions={initialization:'prefix-shooting',prefixPoints:protocol.prefixPoints,scoreStart:protocol.prefixPoints};
    arms[arm]={drive:intended.drive,shamDrive:shamIntent.drive,method,
      legacy:identify([pilot,response],verification,method,oldOptions),
      prefix:identify([pilot,response],verification,method,newOptions),
      legacySham:identify([shuffledPilot,shamResponse],shuffledVerification,method,oldOptions),
      prefixSham:identify([shuffledPilot,shamResponse],shuffledVerification,method,newOptions)};
    responses[arm]={response,shamResponse};
    realizedSnrDb.responses[arm]={actual:acquired.realizedSnrDb,shamBeforePermutation:shamAcquired.realizedSnrDb};
  }
  const envelope={schema:'worldlaw-prefix-recordings/v1',id,seed,db,pilot,verification,shuffledPilot,shuffledVerification,pair,responses};
  const archive=gzipSync(JSON.stringify(envelope)),filename=id+'-'+seed+'-'+db+'.json.gz';
  writeFileSync(join(output,filename),archive);
  return {id,seed,db,outside,arms,memory,realizedSnrDb,recording:{filename,bytes:archive.length,sha256:digest(archive)}};
}
const admitted=(r,arm,variant)=>r.arms[arm][variant].admitted&&!r.memory.contradiction;
const hit=(r,arm,variant)=>admitted(r,arm,variant)&&r.arms[arm][variant].law===r.id;
function scores(arm,variant) {
  const inside=rows.filter(r=>!r.outside),outside=rows.filter(r=>r.outside);
  return {correct:inside.filter(r=>hit(r,arm,variant)).length,
    wrong:inside.filter(r=>admitted(r,arm,variant)&&!hit(r,arm,variant)).length,
    abstain:inside.filter(r=>!admitted(r,arm,variant)).length,
    shamBefore:rows.filter(r=>r.arms[arm][variant+'Sham'].admitted).length,
    sham:rows.filter(r=>admitted(r,arm,variant+'Sham')).length,
    oodBefore:outside.filter(r=>r.arms[arm][variant].admitted).length,
    ood:outside.filter(r=>admitted(r,arm,variant)).length,
    initializationFailures:rows.filter(r=>r.arms[arm][variant].prefix&&r.arms[arm][variant].prefix.status!=='fitted').length,
    versusRandom:Object.fromEntries(['00','01','10','11'].map(pair=>[pair,inside.filter(r=>(hit(r,arm,variant)?'1':'0')+(hit(r,'random',variant)?'1':'0')===pair).length]))};
}
save();
try {
  for(const [index,id] of [...protocol.worlds,...protocol.ood].entries()) {
    for(const world of protocol.seeds)for(const db of protocol.snrDb){rows.push(runCell(id,index,world,db));save();}
    console.log(JSON.stringify({completedFamily:id,cells:rows.length}));
  }
  const inside=rows.filter(r=>!r.outside),outside=rows.filter(r=>r.outside);
  if(inside.length!==protocol.denominators.inside||outside.length!==protocol.denominators.outside)throw Error('incomplete denominator');
  report.scores=Object.fromEntries(['legacy','prefix'].map(variant=>[variant,Object.fromEntries(definitions.map(([arm])=>[arm,scores(arm,variant)]))]));
  report.paired=Object.fromEntries(definitions.map(([arm])=>[arm,Object.fromEntries(['00','01','10','11'].map(pair=>[pair,inside.filter(r=>(hit(r,arm,'legacy')?'1':'0')+(hit(r,arm,'prefix')?'1':'0')===pair).length]))]));
  const current=report.scores.prefix.contender,old=report.scores.legacy.contender;
  report.primary=current.correct>report.scores.prefix.random.correct&&current.correct>report.scores.prefix.passive.correct&&current.wrong===0&&current.sham===0&&current.ood===0;
  report.estimatorGate=current.correct>old.correct&&current.wrong<=old.wrong&&current.sham<=old.sham&&current.ood<=old.ood;
  report.memory={inside:inside.filter(r=>r.memory.contradiction).length,outside:outside.filter(r=>r.memory.contradiction).length};
  report.status='complete';
  console.log(JSON.stringify({primary:report.primary,estimatorGate:report.estimatorGate,scores:report.scores,paired:report.paired,memory:report.memory}));
} catch(error) {
  report.status='failed';report.failure={name:error.name,message:error.message,stack:error.stack};throw error;
} finally {report.resourceUsage=process.resourceUsage();save();}
