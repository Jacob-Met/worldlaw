import fs from 'node:fs';
import {fitConditionTrajectories} from '../../src/condition-trajectories/fit.mjs';
import {fitTrajectoryLM} from '../../src/trajectory-lm/fit.mjs';
const freeze=JSON.parse(fs.readFileSync(new URL('../held-condition/frozen-method.json',import.meta.url))),bundle=JSON.parse(fs.readFileSync(new URL('../../examples/physical-pasco-92be.json',import.meta.url))),held=JSON.parse(fs.readFileSync(new URL('../held-condition/held-run.json',import.meta.url)));
const seed=freeze.models.find(x=>x.label==='trajectory_lm').model;
const runs=[...bundle.trainingRuns,held];
const options={iterations:3,maxStep:.02,screen:.001,sharedBounds:[[-100,-1]],rateBounds:runs.map(()=>[-5,1]),maxTotalSteps:4000000};
let initialRefusal;try{fitConditionTrajectories(seed,runs,{...options,iterations:8});throw Error('Expected budget refusal');}catch(e){initialRefusal=e.message;if(!/reservation/.test(initialRefusal))throw e;}
const joint=fitConditionTrajectories(seed,runs,options),pooled=fitTrajectoryLM(seed,runs,{iterations:3,maxStep:.02,screen:.001,bounds:seed.terms.map(t=>t.id==='rate'?[-5,1]:[-100,-1]),maxTotalSteps:4000000});
const summarize=r=>({status:r.status,best:r.best,models:r.models,model:r.model,reservation:r.reservation,maximumEvaluations:r.maximumEvaluations,trials:r.trials,parameterOrder:r.parameterOrder});
const result={initialEightIterationRefusal:initialRefusal,meaning:'Exploratory joint calibration using the now-consumed baffle course as TRAINING. No held-back/generalization claim; cannot overwrite frozen negative transfer. Shared gravity, separately declared linear damping per original course; fixed original starts, all2001rows percourse.',options,joint:summarize(joint),pooled:summarize(pooled)};
fs.writeFileSync(new URL('measured.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify({joint:{status:joint.status,rmse:joint.best.rmse,models:joint.models,work:joint.reservation},pooled:{status:pooled.status,rmse:pooled.best.rmse,model:pooled.model}},null,2));
