/** Retrospective eight-drive census on the original, fully received held report. */
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { initial,observe,outsider } from './noisy-field-acquisition.mjs';
import { identify } from '../src/trajectory/noisy-field-intervention.mjs';
import { layoutFor,rollout } from '../src/trajectory/field-law-dictionary.mjs';

const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('usage: node scripts/noisy-history-drive-census.mjs RECEIVED_REPORT OUTPUT');
const original=readFileSync(input);
const sourceSha=createHash('sha256').update(original).digest('hex');
assert.equal(sourceSha,'cf21e2fa364f8b0c9590005c8ab469d0cdb77d0fb61f672082d625365f618ad3');
const report=JSON.parse(original);
const protocol=JSON.parse(readFileSync(new URL('../experiments/noisy-history-reset/protocol-v2.json',import.meta.url)));
const roster=JSON.parse(readFileSync(new URL('../experiments/noisy-field-interventions/protocol.json',import.meta.url)));
const ids=[...roster.worlds,...roster.ood];
const rows=[],fixed=Array(8).fill(0),histogram=Array(9).fill(0);
let mass=[1n],numerator=0,unreachable=0,joined=0;
for(const row of report.rows) {
  const {id,seed,db,outside}=row,layout=layoutFor(id),index=ids.indexOf(id);
  const outer=protocol.seeds.find(w=>w.seed===seed),coef=outer.coefficients;
  assert.ok(index>=0&&protocol.snr_db.includes(db));
  const key=seed+10163*index+421*db;
  const start=initial(layout,seed),other=initial(layout,seed+982451653);
  function acquire(s,drive,noise) {
    const clean=outside?outsider(id,s,drive,coef):rollout(id,coef,s,drive);
    assert.ok(clean,'unavailable physical acquisition '+id+' drive '+drive);
    return observe(clean,layout,drive,db,noise);
  }
  const pilot=acquire(start,-1,key+1),verify=acquire(other,2,key+3);
  const alternatives=[];
  for(let drive=0;drive<8;drive++) {
    const response=acquire(start,drive,key+2),fit=identify([pilot,response],verify,'weak');
    for(const arm of ['contender','committee','random'])if(row.arms[arm].drive===drive) {
      assert.deepEqual(fit,row.arms[arm].fit);joined++;
    }
    const admitted=fit.admitted&&!row.memory.contradiction;
    alternatives.push({drive,law:fit.law,fitAdmitted:fit.admitted,admitted,correct:!outside&&admitted&&fit.law===id});
    if(!outside&&admitted&&fit.law===id)fixed[drive]++;
  }
  const successes=alternatives.filter(a=>a.correct).length;
  rows.push({id,seed,db,outside,alternatives,contender:row.arms.contender.drive,random:row.arms.random.drive,
    contradiction:row.memory.contradiction,witness:row.memory.witness,successes});
  if(outside)continue;
  numerator+=successes;
  histogram[successes]++;
  if(successes===0)unreachable++;
  const next=Array(mass.length+1).fill(0n);
  mass.forEach((m,k)=>{next[k]+=m*BigInt(8-successes);next[k+1]+=m*BigInt(successes);});
  mass=next;
}
assert.equal(rows.length,144);assert.equal(joined,3*144);
const inCount=histogram.reduce((a,b)=>a+b,0);
assert.equal(inCount,132);
assert.equal(numerator,fixed.reduce((a,b)=>a+b,0));
const denominator=8n**BigInt(inCount);
assert.equal(mass.reduce((a,b)=>a+b,0n),denominator);
const threshold=report.scores.contender.correct;
const tail=mass.slice(threshold).reduce((a,b)=>a+b,0n);
function gcd(a,b) {while(b){[a,b]=[b,a%b];}return a;}
const common=gcd(tail,denominator);
const summary={scope:'retrospective fixed finite roster and noise, hypothetical independent uniformly chosen drives',
  original_report_sha256:sourceSha, joined_fits:joined, inRoster:inCount, outside:rows.length-inCount,
  countsByNumberOfSuccessfulDrives:histogram,fixedDriveCorrect:fixed,uniformMeanCorrect:numerator/8,
  oracleCorrect:inCount-unreachable,originalContenderCorrect:threshold,hypotheticalUniformTail:{
    atLeast:threshold,numerator:String(tail/common),denominator:String(denominator/common)},
  partialOrUnreachable:rows.filter(r=>!r.outside&&r.successes<8).map(r=>({
    id:r.id,seed:r.seed,db:r.db,correctDrives:r.alternatives.filter(a=>a.correct).map(a=>a.drive),
    contender:r.contender,random:r.random})),
  ood:rows.filter(r=>r.outside).map(r=>({id:r.id,seed:r.seed,db:r.db,contradiction:r.contradiction,
    preVeto:r.alternatives.filter(a=>a.fitAdmitted).map(a=>a.drive),
    postVeto:r.alternatives.filter(a=>a.admitted).map(a=>a.drive)}))};
writeFileSync(output,JSON.stringify({summary,rows})+'\n');console.log(JSON.stringify(summary));
