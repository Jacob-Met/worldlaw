/** Reconstruct fixed-denominator decisions from a completed native receipt. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {laws,layoutFor} from '../src/trajectory/field-law-dictionary.mjs';
const protocolBytes=readFileSync(new URL('../experiments/noisy-field-interventions/protocol.json',import.meta.url));
const protocol=JSON.parse(protocolBytes);
const report=JSON.parse(readFileSync(process.argv[2],'utf8'));
assert.equal(report.status,'complete');
assert.equal(report.protocol_sha256,createHash('sha256').update(protocolBytes).digest('hex'));
const expected=new Set([...protocol.worlds,...protocol.ood].flatMap(id=>protocol.outer_worlds.flatMap(w=>
  protocol.snr_db.map(db=>[id,w.seed,db].join('/')))));
const newCounts=()=>({correct:0,wrong:0,abstain:0,sham_admissions:0,ood_admissions:0});
const scores=Object.fromEntries(protocol.arms.map(a=>[a,newCounts()]));
const bySnr=Object.fromEntries(protocol.snr_db.map(db=>[db,Object.fromEntries(protocol.arms.map(a=>[a,newCounts()]))]));
const difference={active_only:0,random_only:0,both:0,neither:0};
for(const row of report.rows){
  assert.ok(expected.delete([row.id,row.seed,row.db].join('/')),'missing, duplicate or unregistered world');
  assert.equal(row.outside,protocol.ood.includes(row.id));
  assert.deepEqual(Object.keys(row.arms).sort(),[...protocol.arms].sort());
  assert.deepEqual([...row.plan.scores].map(z=>z.drive).sort((a,b)=>a-b),[0,1,2,3,4,5,6,7]);
  assert.ok(row.plan.scores.every(z=>Number.isFinite(z.separation)&&z.separation>=0));
  const best=[...row.plan.scores].sort((a,b)=>b.separation-a.separation||a.drive-b.drive)[0];
  assert.equal(row.plan.drive,best.drive);
  assert.equal(row.arms['active-weak'].drive,best.drive);
  assert.equal(row.arms['passive-sindy'].drive,-1);
  assert.ok(Number.isInteger(row.arms['random-weak'].drive)&&row.arms['random-weak'].drive>=0&&row.arms['random-weak'].drive<8);
  assert.equal(new Set(row.plan.committee).size,4);
  for(const name of protocol.arms){
    const arm=row.arms[name];
    for(const fit of [arm.fit,arm.sham]){
      assert.ok(laws[layoutFor(row.id)].includes(fit.law));
      assert.equal(fit.coef.length,2);
      assert.ok(fit.coef.every(x=>Number.isFinite(x)&&x>=.15&&x<=2));
      const e=fit.standardizedError;
      assert.ok(e===null||Number.isFinite(e)&&e>=0);
      assert.equal(fit.admitted,e!==null&&e<=3);
    }
    const correct=!row.outside&&arm.fit.admitted&&arm.fit.law===row.id;
    const wrong=arm.fit.admitted&&(row.outside||arm.fit.law!==row.id);
    assert.equal(arm.correct,correct); assert.equal(arm.wrong,wrong);
    for(const tgt of [scores[name],bySnr[row.db][name]]){
      if(row.outside)tgt.ood_admissions+=Number(arm.fit.admitted);
      else {tgt.correct+=Number(correct);tgt.wrong+=Number(wrong);tgt.abstain+=Number(!arm.fit.admitted);}
      tgt.sham_admissions+=Number(arm.sham.admitted);
    }
  }
  if(!row.outside){
    const a=row.arms['active-weak'].correct,r=row.arms['random-weak'].correct;
    difference[a?(r?'both':'active_only'):(r?'random_only':'neither')]++;
  }
}
assert.equal(expected.size,0);
assert.deepEqual(report.scores,scores);
const a=scores['active-weak'];
const admitted=a.correct>scores['random-weak'].correct&&a.correct>scores['passive-sindy'].correct
  &&a.sham_admissions===0&&a.ood_admissions===0;
assert.equal(admitted,report.admitted);
console.log(JSON.stringify({decisions:report.rows.length,admitted,scores,bySnr,paired_correctness:difference},null,2));
