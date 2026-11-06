import fs from 'node:fs';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const argv=process.argv.slice(process.execArgv.includes('-e')?1:2);assert.equal(argv.length,1,'Pass the pinned original source root; read base-input JSON from stdin.');
const p=JSON.parse(fs.readFileSync(0,'utf8')),root=argv[0],hash=s=>crypto.createHash('sha256').update(s).digest('hex');
assert.equal(hash(JSON.stringify(p.fixture)),p.historicalInputSHA256);
let forward;
for(const pin of p.sourcePins){const s=fs.readFileSync(root+'/'+pin.path);assert.equal(hash(s),pin.sha256);assert.equal(s.length,pin.bytes);if(pin.path.endsWith('forward.mjs'))forward=s.toString('utf8');}
const match=forward.match(/const STATE_BOUND = ([0-9.e+]+);/);assert(match,'Expected fixed state-bound declaration');p.stateBound=Number(match[1]);
assert(forward.includes('const segments = timeline?.intervals[index] ?? [{duration: sample.time - evidence.samples[index].time, command: evidence.samples[index].command}];'));
assert(forward.includes('const steps = Math.max(1, Math.ceil(duration / maxStep));'));
assert(forward.includes('return { ...segment, steps, step: duration / steps };'));
const times=p.fixture.runs[0].samples.map(x=>x.time);
for(const run of p.fixture.runs)assert.deepEqual(run.samples.map(x=>x.time),times);
p.grids=p.maxSteps.map(maxStep=>{const intervals=times.slice(1).map((t,i)=>{const duration=t-times[i],steps=Math.max(1,Math.ceil(duration/maxStep)),h=duration/steps;return{duration,steps,h};});return{maxStep,intervals,coarseStepsPerCourse:intervals.reduce((s,x)=>s+x.steps,0)};});
assert.deepEqual(p.grids.map(g=>g.coarseStepsPerCourse),[354,604,1104]);
for(const s of p.snapshots)for(const n of s.native){const grid=p.grids.find(g=>g.maxStep===n.maxStep);for(const run of n.centerRuns)assert.equal(run.resolution.stepsCoarse,grid.coarseStepsPerCourse);}
p.uniqueSteps=[...new Set(p.grids.flatMap(g=>g.intervals.map(i=>i.h)))].sort((a,b)=>a-b);
p.preflight={perPrecision:10*3*p.grids.reduce((s,g)=>s+g.coarseStepsPerCourse,0)+4*3*p.grids[0].coarseStepsPerCourse,precisionCount:p.precisions.length,independentControls:2*3*p.uniqueSteps.length*p.precisions.length};
assert.equal(p.preflight.perPrecision,p.expectedPrimalTransitionsPerPrecision);
assert(p.preflight.perPrecision*p.precisions.length<=p.primalTransitionCap);assert(p.preflight.independentControls<=p.controlCap);
p.nativeGrid={node:process.version,method:'Identical inspected binary64 subtraction, ceil and division; grid reconstructed without new rollouts and coarse counts checked against prior actual receiver receipts.',sameTimesAllThreeCourses:true};
console.log(JSON.stringify(p));