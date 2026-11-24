/** Recompute source-level interval certificates from both recorded streams and recount each arm. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root=process.argv[2];
if(!root) throw Error('usage: node scripts/receive-noisy-history-reset.mjs OUTPUT_DIR');
const read=(p)=>readFileSync(join(root,p));
const digest=b=>createHash('sha256').update(b).digest('hex');
const bytes=read('report.json'), report=JSON.parse(bytes);
const raw=readFileSync(new URL('../experiments/noisy-history-reset/protocol-v2.json',import.meta.url));
const protocol=JSON.parse(raw);
const roster=JSON.parse(readFileSync(new URL('../experiments/noisy-field-interventions/protocol.json',import.meta.url)));
assert.equal(report.status,'complete');assert.equal(report.schema,protocol.schema);
assert.equal(report.protocolSha256,digest(raw));
const expected=new Set([...roster.worlds,...roster.ood].flatMap(id=>protocol.seeds.flatMap(({seed})=>
  protocol.snr_db.map(db=>[id,seed,db].join('-')))));
const arms=['contender','committee','random','passive'];
const scores=Object.fromEntries(arms.map(a=>[a,{correct:0,wrong:0,abstain:0,shamBefore:0,sham:0,oodBefore:0,ood:0,
  vsContender:{'00':0,'01':0,'10':0,'11':0}}]));
const memory={inside:0,outside:0};
for(const row of report.rows) {
  const key=[row.id,row.seed,row.db].join('-');
  assert.ok(expected.delete(key),'duplicate or unknown cell');
  const outside=roster.ood.includes(row.id);assert.equal(row.outside,outside);
  assert.equal(row.pairedRecording.filename,key+'.json.gz');
  const compressed=read(key+'.json.gz');
  assert.equal(compressed.length,row.pairedRecording.bytes);assert.equal(digest(compressed),row.pairedRecording.sha256);
  const pair=JSON.parse(gunzipSync(compressed));assert.equal(pair.length,2);
  const [a,b]=pair;assert.equal(a.reset,b.reset);assert.equal(a.forcing,b.forcing);
  assert.deepEqual([a.preparation,b.preparation],['negative','positive']);
  const count=a.bounds.length;
  assert.ok([2,16].includes(count));assert.equal(count,b.bounds.length);
  for(const r of pair) {
    assert.equal(r.values.length,129);assert.equal(r.time.length,129);
    assert.ok(r.bounds.every(v=>Number.isFinite(v)&&v>=0));
  }
  let gap=-Infinity,witness=null;
  for(let i=0;i<129;i++) {
    assert.equal(a.time[i],i*.025);assert.equal(b.time[i],i*.025);
    assert.equal(a.values[i].length,count);assert.equal(b.values[i].length,count);
    for(let j=0;j<count;j++) {
      const x=a.values[i][j],y=b.values[i][j],h=a.bounds[j]+b.bounds[j];
      assert.ok([x,y,h].every(Number.isFinite));
      const g=64*Number.EPSILON*Math.max(1,Math.abs(x),Math.abs(y),h);
      const signed=(Math.max(x,y)-Math.min(x,y))-h-g;
      if(signed>gap){gap=signed;if(signed>0)witness={time:a.time[i],channel:j,left:x,right:y,
        leftBound:a.bounds[j],rightBound:b.bounds[j],guard:g,gap:signed};}
    }
  }
  assert.equal(row.memory.maximumGap,gap);assert.deepEqual(row.memory.witness,witness);
  const veto=gap>0;assert.equal(row.memory.contradiction,veto);
  if(veto) memory[outside?'outside':'inside']++;
  const hit={};
  for(const arm of arms){
    const entry=row.arms[arm], score=scores[arm];
    for(const fit of [entry.fit,entry.sham]){
      assert.equal(fit.admitted,Number.isFinite(fit.standardizedError)&&fit.standardizedError<=3);
    }
    const positive=entry.fit.admitted&&!veto,sham=entry.sham.admitted&&!veto;
    assert.equal(entry.admitted,positive);assert.equal(entry.shamAdmitted,sham);
    hit[arm]=positive&&entry.fit.law===row.id;
    if(entry.sham.admitted)score.shamBefore++;
    if(sham)score.sham++;
    if(outside){if(entry.fit.admitted)score.oodBefore++;if(positive)score.ood++;}
    else{score[positive?(hit[arm]?'correct':'wrong'):'abstain']++;}
  }
  if(!outside)for(const arm of arms)scores[arm].vsContender[(hit.contender?'1':'0')+(hit[arm]?'1':'0')]++;
}
assert.equal(expected.size,0);assert.equal(report.rows.length,144);
assert.equal(readdirSync(root).filter(p=>p.endsWith('.json.gz')).length,144);
assert.deepEqual(memory,report.memory);assert.deepEqual(scores,report.scores);
const s=scores.contender;
const gate=s.correct>scores.random.correct&&s.correct>scores.passive.correct&&s.sham===0&&s.ood===0;
assert.equal(report.primary,gate);
console.log(JSON.stringify({complete:report.rows.length,report_sha256:digest(bytes),scores,memory,gate}));
