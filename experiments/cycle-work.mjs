/** Reused physical recording experiment; all families retained, never validation selected. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createChallenge} from '../src/trajectory/session.mjs';
import {cycleWorkInvestigation} from '../src/trajectory/cycle-work.mjs';
const bytes=readFileSync(new URL('../examples/physical-pasco-92be.json',import.meta.url));
const bundle=JSON.parse(bytes),state=createChallenge(bundle,{method:'weak',modelLimit:1});
const result=cycleWorkInvestigation(bundle,state.discovery.selected,{windowSize:9,crossingAngle:0,maxStep:.01});
console.log(JSON.stringify({meaning:'Exploratory comparison on already reused PASCO recordings, not fresh blind validation. Frozen restoring law from training1/2; cycle-work coefficients from training only. All families retained without a receiving winner.',bundleSHA256:createHash('sha256').update(bytes).digest('hex'),declaration:result.fit.declaration,restoringModel:result.fit.restoringModel,cycleCount:result.fit.cycleCount,admittedCycleCount:result.fit.admittedCycleCount,records:result.fit.records,candidates:result.fit.candidates,receiving:result.receiving.map(({rollout,...r})=>({...r,metrics:rollout?.metrics??null})),solver:result.solver,limitations:result.fit.limitations,selected:result.selected},null,2));
