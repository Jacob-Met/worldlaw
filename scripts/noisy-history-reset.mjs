/** Run the preregistered state-only acquisition and hidden-memory falsifier. */
import { mkdirSync,readFileSync,writeFileSync,renameSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { laws,layoutFor,rollout } from '../src/trajectory/field-law-dictionary.mjs';
import { activeDesign,identify } from '../src/trajectory/noisy-field-intervention.mjs';
import { compareResetHistories,contenderDesign } from '../src/trajectory/reset-history-intervals.mjs';
import { initial,observe,outsider,rng,scrambled } from './noisy-field-acquisition.mjs';
import { acquireHistoryPair } from './generate-reset-histories.mjs';

const output=process.argv[2];
if(!output)throw Error('usage: node scripts/noisy-history-reset.mjs OUTPUT_DIR');
mkdirSync(output,{recursive:true});
const raw=readFileSync(new URL('../experiments/noisy-history-reset/protocol.json',import.meta.url));
const protocol=JSON.parse(raw);
const old=JSON.parse(readFileSync(new URL('../experiments/noisy-field-interventions/protocol.json',import.meta.url)));
const cases=[...old.worlds,...old.ood],rows=[];
const digest=x=>createHash('sha256').update(x).digest('hex');

function runCell(id,index,outer,db) {
  const {seed,coefficients}=outer,layout=layoutFor(id),outside=!laws[layout].includes(id);
  const start=initial(layout,seed),vstart=initial(layout,seed+982451653),key=seed+10163*index+421*db;
  function acquire(s,drive,noise) {
    const path=outside?outsider(id,s,drive,coefficients):rollout(id,coefficients,s,drive);
    if(!path)throw Error('nonfinite acquisition '+id);
    return observe(path,layout,drive,db,noise);
  }
  const pilot=acquire(start,-1,key+1),verify=acquire(vstart,2,key+3);
  const shuffledPilot=scrambled(pilot,key+5),shuffledVerify=scrambled(verify,key+11);
  const pair=acquireHistoryPair(id,coefficients,start,vstart,db,key+1000003);
  const memory=compareResetHistories(...pair);
  const filename=id+'-'+seed+'-'+db+'.json.gz',archive=gzipSync(JSON.stringify(pair));
  writeFileSync(join(output,filename),archive);
  const random=Math.floor(rng(key+47)()*8),arms={};
  for(const [arm,plan,method] of [
    ['contender',contenderDesign,'weak'],['committee',activeDesign,'weak'],
    ['random',()=>({drive:random}),'weak'],['passive',()=>({drive:-1}),'sindy']]) {
    const intended=plan(pilot),shamIntent=plan(shuffledPilot);
    const response=acquire(start,intended.drive,key+2);
    const shamResponse=scrambled(acquire(start,shamIntent.drive,key+2),key+7);
    const fit=identify([pilot,response],verify,method);
    const sham=identify([shuffledPilot,shamResponse],shuffledVerify,method);
    arms[arm]={drive:intended.drive,shamDrive:shamIntent.drive,fit,sham,
      admitted:fit.admitted&&!memory.contradiction,shamAdmitted:sham.admitted&&!memory.contradiction};
  }
  return {id,seed,db,outside,arms,memory,pairedRecording:{filename,bytes:archive.length,sha256:digest(archive)}};
}

function save(value) {
  const tmp=join(output,'report.pending');
  writeFileSync(tmp,JSON.stringify(value)+'\n');renameSync(tmp,join(output,'report.json'));
}
const report={schema:protocol.schema,protocolSha256:digest(raw),node:process.version,rows,status:'running'};
save(report);
for(const [index,id] of cases.entries()) {
  for(const world of protocol.seeds)for(const db of protocol.snr_db)rows.push(runCell(id,index,world,db));
  save(report);
}
const inside=rows.filter(r=>!r.outside),outside=rows.filter(r=>r.outside);
if(inside.length!==132||outside.length!==12)throw Error('incomplete denominator');
const hit=(r,a)=>r.arms[a].admitted&&r.arms[a].fit.law===r.id;
report.scores={};
for(const arm of ['contender','committee','random','passive']) {
  report.scores[arm]={
    correct:inside.filter(r=>hit(r,arm)).length,
    wrong:inside.filter(r=>r.arms[arm].admitted&&!hit(r,arm)).length,
    abstain:inside.filter(r=>!r.arms[arm].admitted).length,
    shamBefore:rows.filter(r=>r.arms[arm].sham.admitted).length,
    sham:rows.filter(r=>r.arms[arm].shamAdmitted).length,
    oodBefore:outside.filter(r=>r.arms[arm].fit.admitted).length,
    ood:outside.filter(r=>r.arms[arm].admitted).length,
    vsContender:Object.fromEntries(['00','01','10','11'].map(pair=>[pair,inside.filter(r=>
      (hit(r,'contender')?'1':'0')+(hit(r,arm)?'1':'0')===pair).length]))
  };
}
report.memory={inside:inside.filter(r=>r.memory.contradiction).length,outside:outside.filter(r=>r.memory.contradiction).length};
const s=report.scores.contender;
report.primary=s.correct>report.scores.random.correct&&s.correct>report.scores.passive.correct&&s.sham===0&&s.ood===0;
report.status='complete';save(report);
console.log(JSON.stringify({primary:report.primary,scores:report.scores,memory:report.memory}));
