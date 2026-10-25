import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import * as after from '../src/science/torque-discovery.mjs';
import * as afterDeadzone from '../src/science/command-deadzone.mjs';

assert.ok(process.env.WORLDLAW_BASELINE_DIR, 'Set WORLDLAW_BASELINE_DIR to the unmodified source pin');
const base = resolve(process.env.WORLDLAW_BASELINE_DIR);
const before = await import(pathToFileURL(resolve(base, 'src/science/torque-discovery.mjs')));
const beforeDeadzone = await import(pathToFileURL(resolve(base, 'src/science/command-deadzone.mjs')));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const model = terms => ({schema:'worldlaw.torque-model/v1', terms});
let seed = 0x2894a1ed;
const random = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0) + .5) / 4294967296;
let successfulCourses = 0, statesCompared = 0;
for (let i=0; i<96; i++) {
  const terms=after.TERMS.filter(() => random()>.25).map(({id}) => ({id,
    coefficient:id==='spring'?-.3:id==='rate'?-.1:(random()-.5)*.02}));
  if (i%2) terms.reverse();
  const input = {model:model(terms), initial:{position:(random()-.5)*.6, rate:(random()-.5)*.4},
    settings:{duration:.1+random()*1.9,dt:i%3===0?.013:.02,inertia:.7+random(),command:(random()-.5)*.5}};
  const snapshot=structuredClone(input);
  const oldResult=before.simulate(input.model,input.initial,input.settings);
  const newResult=after.simulate(input.model,input.initial,input.settings);
  assert.ok(oldResult.length>1); assert.deepEqual(newResult,oldResult); assert.deepEqual(input,snapshot);
  successfulCourses++; statesCompared+=oldResult.length;
}
const stable=model([{id:'command',coefficient:1},{id:'rate',coefficient:-.4},{id:'gravity',coefficient:-4},{id:'quadratic',coefficient:-.03}]);
const initial={position:.8,rate:0}, settings={duration:100,dt:.02,inertia:1,command:.1};
const baseline=before.simulate(stable,initial,settings), candidate=after.simulate(stable,initial,settings);
assert.equal(baseline.length,5001); assert.deepEqual(candidate,baseline);
const errorOf=fn=>{try{fn();return null;}catch(error){return {name:error.name,code:error.code,message:error.message};}};
const refusals=[
  ['invalid-model',{},initial,settings],
  ['unknown-term',model([{id:'unknown',coefficient:1}]),initial,settings],
  ['coefficient-bound',model([{id:'bias',coefficient:1e19}]),initial,settings],
  ['missing-initial',stable,undefined,settings],
  ['invalid-initial',stable,{position:NaN,rate:0},settings],
  ['invalid-command',stable,initial,{...settings,command:Infinity}],
  ['zero-duration',stable,initial,{...settings,duration:0}],
  ['zero-step',stable,initial,{...settings,dt:0}],
  ['zero-inertia',stable,initial,{...settings,inertia:0}],
  ['step-budget',stable,initial,{...settings,dt:.0001}],
  ['evolving-coordinate-bound',model([{id:'bias',coefficient:1e18}]),initial,{duration:1,dt:.01}],
];
for (const [name,m,i,s] of refusals) {
  const oldError=errorOf(()=>before.simulate(m,i,s)),newError=errorOf(()=>after.simulate(m,i,s));
  assert.ok(oldError,name+' must refuse'); assert.deepEqual(newError,oldError,name);
}
let deadzoneCourses=0;
for (const width of [0,.1,.4]) for (const command of [-.5,-.1,0,.1,.5]) {
  const candidate={width,model:stable}, options={duration:2,dt:.013,inertia:1.2,command};
  assert.deepEqual(afterDeadzone.simulateDeadzone(candidate,initial,options),beforeDeadzone.simulateDeadzone(candidate,initial,options));
  deadzoneCourses++;
}
const times={baseline:[],candidate:[]};
for(let round=0;round<14;round++) {
  for(const key of (round%2?['candidate','baseline']:['baseline','candidate'])) {
    const api=key==='baseline'?before:after, started=performance.now();
    const result=api.simulate(stable,initial,settings),elapsed=performance.now()-started;
    assert.deepEqual(result,baseline);
    if(round>=4)times[key].push(elapsed);
  }
}
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return (sorted[4]+sorted[5])/2;};
const baselineMs=median(times.baseline),candidateMs=median(times.candidate);
console.log(JSON.stringify({schema:'worldlaw.prepared-studio-receiving/v1',runtime:process.version,
  baselineDirectory:base,successfulCourses,statesCompared,longCourseStates:baseline.length,
  longCourseSha256:hash(baseline),exactRefusals:refusals.map(([name])=>name),deadzoneCourses,
  timing:{rounds:10,warmupRounds:4,alternatingOrder:true,baselineMs,candidateMs,speedup:baselineMs/candidateMs,samplesMs:times},
  qualification:'Authored numerical parity and local performance receiving. Every state and torque is deeply equal; no measurement, accuracy, deployment or universal speed claim.'},null,2));
