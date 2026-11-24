/** Re-receive every retained raw recording and recompute the published decisions. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {identify} from '../src/trajectory/noisy-field-intervention.mjs';
import {rollout,laws,layoutFor} from '../src/trajectory/field-law-dictionary.mjs';
import {compareResetHistories} from '../src/trajectory/reset-history-intervals.mjs';

const root=process.argv[2];if(!root)throw Error('usage: node scripts/receive-noisy-prefix.mjs OUTPUT_DIR');
const digest=x=>createHash('sha256').update(x).digest('hex');
const raw=readFileSync(join(root,'report.json')),report=JSON.parse(raw);
const protocolBytes=readFileSync(new URL('../experiments/noisy-prefix-initialization/protocol.json',import.meta.url)),protocol=JSON.parse(protocolBytes);
assert.equal(report.status,'complete','partial originals are retained, never scored');
assert.equal(report.protocolSha256,digest(protocolBytes));
for(const [path,sha] of Object.entries(report.sources))assert.equal(digest(readFileSync(new URL('../'+path,import.meta.url))),sha,path);
const expected=new Set([...protocol.worlds,...protocol.ood].flatMap(id=>protocol.seeds.flatMap(s=>protocol.snrDb.map(db=>id+'/'+s.seed+'/'+db))));
assert.equal(report.rows.length,protocol.denominators.total);
const armNames=['contender','committee','random','passive'],causalLayouts=new Set();
let replays=0,rawBytes=0,suffixChecks=0;
for(const row of report.rows) {
  const identity=row.id+'/'+row.seed+'/'+row.db;assert.ok(expected.delete(identity),'missing or duplicate '+identity);
  assert.equal(row.outside,!laws[layoutFor(row.id)].includes(row.id));
  const bytes=readFileSync(join(root,row.recording.filename));rawBytes+=bytes.length;
  assert.equal(bytes.length,row.recording.bytes);assert.equal(digest(bytes),row.recording.sha256);
  const data=JSON.parse(gunzipSync(bytes));
  assert.equal(data.id,row.id);assert.equal(data.seed,row.seed);assert.equal(data.db,row.db);
  assert.deepEqual(compareResetHistories(...data.pair),row.memory);
  for(const arm of armNames)for(const variant of ['legacy','prefix'])for(const sham of [false,true]) {
    const options={scoreStart:protocol.prefixPoints,...(variant==='prefix'?{initialization:'prefix-shooting',prefixPoints:protocol.prefixPoints}:{})};
    const verification=sham?data.shuffledVerification:data.verification;
    const training=[sham?data.shuffledPilot:data.pilot,sham?data.responses[arm].shamResponse:data.responses[arm].response];
    const fit=identify(training,verification,row.arms[arm].method,options),recorded=row.arms[arm][variant+(sham?'Sham':'')];
    assert.equal(JSON.stringify(fit),JSON.stringify(recorded),identity+'/'+arm+'/'+variant+'/'+sham);replays++;
    assert.equal(fit.firstScored,protocol.prefixPoints);
    if(fit.standardizedError!==null) {
      const start=variant==='prefix'?fit.prefix.initial:verification.values[0];
      const path=rollout(fit.law,fit.coef,start,verification.drive);assert.ok(path);
      let squared=0,count=0;
      for(let t=protocol.prefixPoints;t<verification.values.length;t++)for(let k=0;k<verification.sigma.length;k++){
        squared+=((path[t][k]-verification.values[t][k])/verification.sigma[k])**2;count++;
      }
      assert.ok(Math.abs(Math.sqrt(squared/count)-fit.standardizedError)<1e-12);
      assert.equal(fit.scoredValues,count);assert.equal(fit.admitted,fit.standardizedError<=3);suffixChecks++;
    } else assert.equal(fit.admitted,false);
    if(!sham&&variant==='prefix'&&fit.prefix?.status==='fitted'&&!causalLayouts.has(verification.layout)) {
      const changed=structuredClone(verification);
      for(let t=protocol.prefixPoints;t<changed.values.length;t++)changed.values[t]=changed.values[t].map((x,k)=>x+.5*Math.sin(t+k));
      const altered=identify(training,changed,row.arms[arm].method,options);
      assert.deepEqual(altered.prefix,fit.prefix);assert.deepEqual(altered.coef,fit.coef);
      causalLayouts.add(verification.layout);
    }
  }
}
assert.equal(expected.size,0);assert.equal(causalLayouts.size,3);
const inside=report.rows.filter(r=>!r.outside),outside=report.rows.filter(r=>r.outside);
assert.equal(inside.length,132);assert.equal(outside.length,12);
const admitted=(r,a,v)=>r.arms[a][v].admitted&&!r.memory.contradiction;
const correct=(r,a,v)=>admitted(r,a,v)&&r.arms[a][v].law===r.id;
for(const variant of ['legacy','prefix'])for(const arm of armNames) {
  const score=report.scores[variant][arm];
  assert.equal(score.correct,inside.filter(r=>correct(r,arm,variant)).length);
  assert.equal(score.wrong,inside.filter(r=>admitted(r,arm,variant)&&!correct(r,arm,variant)).length);
  assert.equal(score.abstain,inside.filter(r=>!admitted(r,arm,variant)).length);
  assert.equal(score.sham,report.rows.filter(r=>admitted(r,arm,variant+'Sham')).length);
  assert.equal(score.ood,outside.filter(r=>admitted(r,arm,variant)).length);
  assert.equal(score.correct+score.wrong+score.abstain,132);
  for(const pair of ['00','01','10','11'])assert.equal(score.versusRandom[pair],
    inside.filter(r=>(correct(r,arm,variant)?'1':'0')+(correct(r,'random',variant)?'1':'0')===pair).length);
}
for(const arm of armNames)for(const pair of ['00','01','10','11'])assert.equal(report.paired[arm][pair],
  inside.filter(r=>(correct(r,arm,'legacy')?'1':'0')+(correct(r,arm,'prefix')?'1':'0')===pair).length);
const s=report.scores.prefix.contender,old=report.scores.legacy.contender;
assert.equal(report.primary,s.correct>report.scores.prefix.random.correct&&s.correct>report.scores.prefix.passive.correct&&s.wrong===0&&s.sham===0&&s.ood===0);
assert.equal(report.estimatorGate,s.correct>old.correct&&s.wrong<=old.wrong&&s.sham<=old.sham&&s.ood<=old.ood);
const received={schema:'worldlaw-prefix-receiving/v1',reportSha256:digest(raw),protocolSha256:digest(protocolBytes),
  recordings:report.rows.length,rawBytes,replays,suffixChecks,causalLayouts:[...causalLayouts],primary:report.primary,estimatorGate:report.estimatorGate,
  resourceUsage:process.resourceUsage(),scope:'complete raw-record replay and independent suffix arithmetic; synthetic finite roster, not an external physical oracle'};
writeFileSync(join(root,'received.json'),JSON.stringify(received,null,2)+'\n');console.log(JSON.stringify(received));
