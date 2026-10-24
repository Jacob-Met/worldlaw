/** Exploratory reuse: every declared window retained, never ranked on challenge. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createChallenge} from '../src/trajectory/session.mjs';
import {comparePrelude} from '../src/trajectory/prelude-investigation.mjs';
import {estimateAngularPrelude} from '../src/science/angular-prelude.mjs';
const bytes=readFileSync(new URL('../examples/physical-pasco-92be.json',import.meta.url));
const bundle=JSON.parse(bytes),run=bundle.challengeRuns[0],state=createChallenge(bundle,{method:'weak',modelLimit:1});
const csv=readFileSync(new URL('../examples/'+run.source.localRawFile,import.meta.url));
const sha=b=>createHash('sha256').update(b).digest('hex');
if(sha(csv)!==run.source.sha256)throw Error('Published raw recording identity differs.');
const rows=csv.toString().trim().split('\n').slice(1).map(line=>line.split(',').map(Number)).map(row=>({time:row[0],position:row[1]}));
const input={schema:'worldlaw.angular-prelude-input/v1',targetRunId:run.id,kind:run.kind,units:{time:'s',position:'rad'},source:{...run.source,label:'Original PASCO positions preceding the declared challenge start'},samples:rows.filter(row=>row.time<=run.samples[0].time).slice(-31)};
const windows=[5,9,17,31],comparisons=windows.map(chosenWindowSize=>{
 const r=comparePrelude(state.discovery.selected,run,input,{windowSizes:windows,positionSigma:.001,chosenWindowSize});
 return {chosenWindowSize,originalRate:r.originalRate,derivedRate:r.derivedRate,original:r.original.receiving,derived:r.derived.receiving,derivedScreen:r.derived.forecasts.variants.map(v=>v.status)};
});
const analytic=windows.map(windowSize=>{
 const rows=Array.from({length:windowSize},(_,i)=>({time:(i-windowSize+1)*.01,position:Math.cos(3*(i-windowSize+1)*.01+.7)}));
 const r=estimateAngularPrelude(rows,rows.at(-1),{windowSizes:[windowSize],positionSigma:.001}).estimates[0],truth=-3*Math.sin(.7);
 return {windowSize,rate:r.rate,truth,bias:r.rate-truth,conditionalSigma:r.rateSigma};
});
console.log(JSON.stringify({schema:'worldlaw.prelude-experiment/v1',meaning:'Previously reused physical recording; all windows shown without selecting a winner. Declared .001 rad noise is not calibration. Synthetic harmonic bias is a separate analytic counterexample.',bundleSHA256:sha(bytes),rawSHA256:sha(csv),trainingMismatch:state.discovery.diagnostics.trainingRmseInNoiseUnits,input,estimate:estimateAngularPrelude(input.samples,run.samples[0],{windowSizes:windows,positionSigma:.001}),comparisons,analytic},null,2));
