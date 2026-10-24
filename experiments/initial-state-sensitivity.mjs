/** Exploratory replay of already reused PASCO evidence, not a new blind study. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createChallenge} from '../src/trajectory/session.mjs';
import {initialStateSensitivity} from '../src/trajectory/initial-state-sensitivity.mjs';
const bytes=readFileSync(new URL('../examples/physical-pasco-92be.json',import.meta.url));
const bundle=JSON.parse(bytes),state=createChallenge(bundle,{method:'weak',modelLimit:1});
const result=initialStateSensitivity(state.discovery.selected,bundle.challengeRuns[0],{positionHalfWidth:.001,rateHalfWidth:.01});
console.log(JSON.stringify({schema:'worldlaw.initial-state-experiment/v1',evidence:'Existing physical benchmark reused during development; declared widths are not calibrated uncertainty.',inputSHA256:createHash('sha256').update(bytes).digest('hex'),model:state.discovery.selected,trainingMismatch:state.discovery.diagnostics.trainingRmseInNoiseUnits,result},null,2));
