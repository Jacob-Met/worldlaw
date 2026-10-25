/** Reused licensed measured source; fixed documented rounded law, no fitting. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {rolloutAngular,ANGULAR_MODEL_UNITS,ANGULAR_COEFFICIENT_UNITS} from '../src/trajectory/angular-discovery.mjs';
import {residualEpochs} from '../src/trajectory/residual-epochs.mjs';
const bytes=readFileSync(new URL('../examples/physical-pasco-92be.json',import.meta.url));
assert.equal(createHash('sha256').update(bytes).digest('hex'),'7e42868153d3aa15fc9722f665f5ed62cc491c4445768f8db74a6e36b85cb0e6');
const run=JSON.parse(bytes).challengeRuns[0];
const model={schema:'worldlaw.angular-model/v1',id:'published-rounded-gravity+bias',scaleMeaning:'angular_acceleration_only_absolute_torque_unknown',physicalInertia:null,absoluteTorqueIdentified:false,units:ANGULAR_MODEL_UNITS,
  terms:[['gravity',-39.9074995],['bias',-.2918417]].map(([id,coefficient])=>({id,coefficient,coefficientUnit:ANGULAR_COEFFICIENT_UNITS[id]}))};
const original=JSON.stringify({run,model});
const coarse=rolloutAngular(model,run,{maxStep:.01,maxSteps:200000}),fine=rolloutAngular(model,run,{maxStep:.005,maxSteps:200000});
const result=residualEpochs(coarse.rows,{boundaries:[5,10,15,20,25],bands:[{lowerSeconds:.4999,upperSeconds:.5001}]});
assert.equal(JSON.stringify({run,model}),original);
assert.equal(result.sourceCount,result.accountedSourceCount);
assert.ok(result.pairPartitions.every(p=>p.pairCount===p.accountedPairCount));
console.log(JSON.stringify({source:run.source,model,modelSource:'Fixed published rounded coefficients, not an exact recovered full-precision fitted object.',fitExecuted:false,
  fullRMSE:coarse.metrics.positionRMSE,maxCoarseFineDifference:Math.max(...coarse.rows.map((r,i)=>Math.abs(r.predicted-fine.rows[i].predicted))),
  epochs:result.epochs.map(({rowIndices,...e})=>({...e,firstOriginalIndex:rowIndices[0],lastOriginalIndex:rowIndices.at(-1)})),
  pairPartitions:result.pairPartitions.map(p=>({total:p.pairCount,accounted:p.accountedPairCount,within:p.withinEpochs.map(({pairIndices,...e})=>e),crossCount:p.crossEpoch.count,crossCorrelation:p.crossEpoch.correlation})),
  scope:'Reused measured source with maintained solver. Descriptive epoch attribution only; no refit, forecast reset, identified frequency, causal attribution or physical validation.'},null,2));
