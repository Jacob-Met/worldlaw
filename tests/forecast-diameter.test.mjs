import assert from 'node:assert/strict';
import test from 'node:test';
import {forecastRms, forecastDistances, planForecastDiameter} from '../src/experiment-design/forecast-diameter.mjs';

test('ambiguous nearest neighbours do not merge transitively', () => {
  const row = forecastDistances([[0], [1], [2]]);
  const plan = planForecastDiameter([row, row], .5);
  assert.deepEqual(plan.best.ambiguous, [0,2]);
  assert.equal(plan.best.diameter,1);
  assert.deepEqual(plan.minimumPlan,[0]);
  assert.equal(plan.minimumExperiments,1);
});

test('finite midpoint observations independently recover the minimax guarantee', () => {
  const forecasts = [[0,0,3,4],[0,2,1,4],[0,1,2,3],[4,0,2,4],[1,2,1,0]];
  const radius=.5;
  const distances=forecasts.map(row=>forecastDistances(row.map(x=>[x])));
  const result=planForecastDiameter(distances,radius);
  const ys=Array.from({length:11},(_,i)=>(i-1)/2);
  let optimum=Infinity, best, sum=0, count=0;
  for(let a=0;a<forecasts.length;a++)for(let b=a+1;b<forecasts.length;b++){
    let worst=0;
    for(const y of ys)for(const z of ys){
      const survivors=forecasts[a].map((v,m)=>Math.abs(v-y)<=radius && Math.abs(forecasts[b][m]-z)<=radius);
      if(!survivors.some(Boolean))continue;
      for(const row of forecasts){
        const compatible=row.filter((_,i)=>survivors[i]);
        worst=Math.max(worst, Math.max(...compatible)-Math.min(...compatible));
      }
    }
    if(worst<optimum){optimum=worst;best=[a,b];}
    sum+=worst;count++;
  }
  assert.deepEqual(result.best.indices,best);
  assert.equal(result.best.diameter,optimum);
  assert.equal(result.uniformMeanDiameter,sum/count);
});

test('identical futures need no experiment; invalid model traces are rejected', () => {
  assert.deepEqual(planForecastDiameter([[0],[0]],0).minimumPlan,[]);
  assert.equal(forecastRms([0,0],[3,4]),5/Math.sqrt(2));
  assert.throws(()=>forecastRms([0],['0']));
  assert.throws(()=>forecastRms([Infinity],[1]));
  assert.throws(()=>planForecastDiameter([[1],[1,2]],.1));
});

test('finite RMS and uniform means survive large intermediate sums', () => {
  const h = 1e308;
  assert.equal(forecastRms([h,h,h,h], [0,0,0,0]), h);
  assert.equal(forecastRms([h,0,0,0], [-h,0,0,0]), h);
  assert.throws(() => forecastRms([h], [-h]), RangeError);
  const rows = [[0,h],[0,h],[h,0],[0,0],[0,0],[0,0]];
  const unit = planForecastDiameter(rows.map(row => row.map(x => x / h)), 0);
  assert.equal(planForecastDiameter(rows, 0).uniformMeanDiameter, unit.uniformMeanDiameter * h);
});
