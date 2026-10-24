/** Exploratory existing physical recording; declared conditional forecast design. */
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {createChallenge} from '../src/trajectory/session.mjs';
import {rollingOriginChallenge} from '../src/trajectory/rolling-origin.mjs';
const bytes=readFileSync(new URL('../examples/physical-pasco-92be.json',import.meta.url)),bundle=JSON.parse(bytes),state=createChallenge(bundle,{method:'weak',modelLimit:1});
const options={origins:Array.from({length:19},(_,i)=>(i+1)*100),horizonSamples:[10,50,100],windowSize:9,positionSigma:.001};
const result=rollingOriginChallenge(state.discovery.selected,bundle.challengeRuns[0],options);
console.log(JSON.stringify({schema:'worldlaw.rolling-origin-experiment/v1',evidence:'Exploratory reuse of existing PASCO recording; origin indices and horizons were declared before running this comparison. Reinitialized conditional forecasts do not improve the original-start free trajectory.',inputSHA256:createHash('sha256').update(bytes).digest('hex'),model:result.model,source:result.run.source,options:result.options,reservedSteps:result.reservedSteps,summaries:result.summaries,trials:result.trials.map(t=>({originIndex:t.originIndex,originTime:t.originTime,horizonSamples:t.horizonSamples,duration:t.duration,status:t.status,rateEstimate:t.rateEstimate,modelRMSE:t.receiving?.scores[0]?.rmse??null,baselineRMSE:t.baselines?.map(b=>({id:b.id,rmse:b.positionRMSE}))??null})),limitations:result.limitations},null,2));
