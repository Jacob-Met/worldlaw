import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {trajectoryBaselines,compareTrajectorySkill} from '../src/trajectory/baselines.mjs';
import {createChallenge,exportChallenge,restoreChallenge} from '../src/trajectory/session.mjs';
const run={id:'a',initialRate:2,samples:[{time:10,position:3},{time:11,position:5},{time:13,position:9}]};
const result=(r,p)=>({modelId:'law',runId:r.id,status:'ok',rollout:{rows:r.samples.map((s,i)=>({...s,predicted:p[i]}))}});
test('analytic rate reference uses elapsed time and no later observations',()=>{
 const [hold,rate]=trajectoryBaselines(run);assert.equal(rate.positionRMSE,0);assert.deepEqual(rate.rows.map(r=>r.predicted),[3,5,9]);assert.ok(Math.abs(hold.positionRMSE-Math.sqrt(20))<1e-14);
 const changed=structuredClone(run);changed.samples[1].position=700;changed.samples[2].position=-9;
 assert.deepEqual(trajectoryBaselines(changed).map(b=>b.rows.map(r=>r.predicted)),trajectoryBaselines(run).map(b=>b.rows.map(r=>r.predicted)));
});
test('skill distinguishes improvement, loss, and perfect baseline',()=>{
 const good=compareTrajectorySkill([run],[result(run,[3,5,9])],'law');assert.equal(good.baselines[0].skill,1);assert.equal(good.baselines[1].skill,null);
 assert.ok(compareTrajectorySkill([run],[result(run,[3,-5,-9])],'law').baselines[0].skill<0);
});
test('aggregate uses sample weights and retains failed run refusal',()=>{
 const b={id:'b',initialRate:0,samples:[{time:0,position:0},{time:1,position:1}]};const received=[result(run,[3,4,7]),result(b,[0,0])];
 assert.ok(Math.abs(compareTrajectorySkill([run,b],received,'law').modelRMSE-Math.sqrt(2))<1e-14);
 for(const bad of [{...received[1],status:'failed'}, {...received[1],rollout:{rows:[]}}]){
 const c=compareTrajectorySkill([run,b],[received[0],bad],'law');assert.equal(c.status,'incomplete');assert.equal(c.modelRMSE,null);assert.ok(c.baselines.every(x=>x.skill===null));assert.deepEqual(c.failedRunIds,['b']);}
 const shifted=result(run,[3,5,9]);shifted.rollout.rows[1].time=12;assert.equal(compareTrajectorySkill([run],[shifted],'law').status,'incomplete');
});
test('invalid input and overflow refuse',()=>{
 assert.throws(()=>trajectoryBaselines({...run,initialRate:NaN}));assert.throws(()=>trajectoryBaselines({...run,samples:[{time:1,position:1},{time:1,position:2}]}));assert.throws(()=>trajectoryBaselines({...run,initialRate:1e308}));
});
test('challenge/reopen comparison preserves training ranking',async()=>{
 const b=JSON.parse(await readFile(new URL('../examples/trajectory-pendulum-92be.json',import.meta.url),'utf8'));const c=createChallenge(b);assert.equal(c.summary.predictionSkill.status,'complete');assert.ok(Math.abs(c.summary.predictionSkill.modelRMSE-c.summary.selectedPositionRMSE)<1e-12);
 assert.deepEqual(restoreChallenge(exportChallenge(c)).summary.predictionSkill,c.summary.predictionSkill);
 const changed=structuredClone(b);changed.challengeRuns[0].samples[5].position+=1;assert.deepEqual(createChallenge(changed).discovery,c.discovery);
});

test('finite extreme errors retain finite per-run and weighted aggregate RMSE',()=>{
 const large={id:'large',initialRate:0,samples:[0,1e308,1e308,1e308,1e308].map((position,time)=>({time,position}))};
 const second={id:'second',initialRate:0,samples:[{time:0,position:0},{time:1,position:5e307}]};
 const close=(actual,expected)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual/expected-1)<1e-14);
 for(const b of trajectoryBaselines(large))close(b.positionRMSE,1e308);
 const exact=compareTrajectorySkill([large],[result(large,large.samples.map(s=>s.position))],'law');
 assert.equal(exact.status,'complete');assert.ok(exact.baselines.every(b=>b.skill===1&&b.skillStatus==='available'));
 const combined=compareTrajectorySkill([large,second],[result(large,[0,0,0,0,0]),result(second,[0,0])],'law');
 const expected=1e308*Math.sqrt(.85);close(combined.modelRMSE,expected);
 for(const b of combined.baselines){close(b.positionRMSE,expected);assert.ok(Math.abs(b.skill)<1e-14);}
 const impossible={id:'impossible',initialRate:0,samples:[{time:0,position:-1e308},{time:1,position:1e308}]};
 assert.throws(()=>trajectoryBaselines(impossible),/finite numerical range/);
 const invalidModel=result(large,[0,-1e308,-1e308,-1e308,-1e308]);
 const refused=compareTrajectorySkill([large],[invalidModel],'law');assert.equal(refused.status,'incomplete');assert.deepEqual(refused.failedRunIds,['large']);assert.equal(refused.modelRMSE,null);assert.ok(refused.baselines.every(b=>b.skill===null));
});
