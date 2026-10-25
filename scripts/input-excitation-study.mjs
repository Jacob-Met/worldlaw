/** Fixed-policy receiving course declared separately from the development fixture. */
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createSession,sessionPlan,sessionPilotPlan,appendMeasurements,exportSession,restoreSession,refitSession} from '../src/session.mjs';
import {evaluate} from '../src/science/torque-discovery.mjs';

const seeds=[8233,19073,31847,47017,65521,81799];
const policy={seeds,trainingCount:96,receivingCount:83,methods:['unchanged model-disagreement planner','input-rank pilot'],
  modes:['exact-additive','noisy-additive','omitted-cubic','no-exciting-offer'],
  selection:'Complete fixed three-state course; first numerical +1 rank gain, no output-aware ranking.',
  scope:'Authored independent-seed software receiving. No physical accuracy or calibrated uncertainty.'};
function random(seed){let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const courses=[];
for(const seed of seeds)for(const mode of policy.modes){
  const rng=random(seed),gain=1+rng(),spring=-.3-rng(),damping=-.1-.4*rng();
  const law=p=>gain*p.command+spring*p.position+damping*p.rate+(mode==='omitted-cubic'?.25*p.position**3:0);
  const noise=()=>mode==='noisy-additive'?.004*(rng()+rng()+rng()-1.5):0;
  const observations=Array.from({length:policy.trainingCount},()=>{const p={command:0,position:5*(rng()-.5),rate:3*(rng()-.5)};return {...p,jointTorque:law(p)+noise()};});
  // Receiving coordinates and readings are independently drawn and never passed
  // to either planner. They are used only after both selected inputs are frozen.
  const receiving=Array.from({length:policy.receivingCount},()=>{const p={command:2*(rng()-.5),position:5*(rng()-.5),rate:3*(rng()-.5)};return {...p,jointTorque:law(p)};});
  const offeredInputs=[{command:0,position:.37,rate:-.21},{command:1.1,position:.37,rate:-.21},{command:-1.2,position:.37,rate:-.21}];
  if(mode==='no-exciting-offer')for(let i=0;i<3;i++)Object.assign(offeredInputs[i],{command:0,position:.37+i/10});
  const dataset={schema:'worldlaw.observations/v2',source:{label:`Authored seed ${seed} / ${mode}`},observations,heldOut:[],offeredInputs};
  const start=performance.now(),state=createSession(dataset),fittedMs=performance.now()-start;
  const nominalStart=performance.now(),nominal=sessionPlan(state),nominalMs=performance.now()-nominalStart;
  const pilotStart=performance.now(),pilot=sessionPilotPlan(state),pilotMs=performance.now()-pilotStart;
  const raw=exportSession(state);
  assert.equal(state.base.heldOut.length,0);assert.equal(pilot.currentRank,6);
  // Entirely different training torques and poisoned held-out values cannot
  // change this input-only pilot, including its complete retained course.
  const poisoned=createSession({...dataset,observations:observations.map((p,i)=>({...p,jointTorque:100*Math.sin(i*.37)})),heldOut:receiving.map(p=>({...p,jointTorque:99999}))});
  assert.deepEqual(sessionPilotPlan(poisoned),pilot);assert.equal(exportSession(state),raw);
  const acquire=input=>({...input,jointTorque:law(input)+noise()});
  const baseline=nominal.selected?appendMeasurements(state,[acquire(nominal.selected.input)]):state;
  const advanced=pilot.selected?appendMeasurements(state,[acquire(pilot.selected.input)]):state;
  const before=evaluate(state.discovery.selected,receiving).rmse;
  const ordinary=evaluate(baseline.discovery.selected,receiving).rmse;
  const after=evaluate(advanced.discovery.selected,receiving).rmse;
  const replay=restoreSession(exportSession(advanced));
  assert.deepEqual(replay.discovery.selected,advanced.discovery.selected);
  if(mode==='no-exciting-offer'){
    assert.equal(pilot.status,'no_rank_gain');assert.equal(pilot.selected,null);
    assert.equal(exportSession(advanced),raw);assert.equal(after,before);
  }else{
    assert.equal(pilot.selected.sourceIndex,1);
    assert.equal(advanced.discovery.diagnostics.fullLibraryRank,7);
  }
  if(mode==='exact-additive'){assert.ok(before>.3);assert.ok(ordinary>.3);assert.ok(after<1e-10);}
  if(mode==='omitted-cubic')assert.equal(advanced.discovery.diagnostics.adequacy,'residual_mismatch');
  courses.push({seed,mode,trainingSHA256:digest(observations),receivingSHA256:digest(receiving),offeredSHA256:digest(offeredInputs),
    beforeHeldOutRMSE:before,nominalHeldOutRMSE:ordinary,pilotHeldOutRMSE:after,
    nominalSourceIndex:nominal.selected?.index??null,pilotSourceIndex:pilot.selected?.sourceIndex??null,
    inputRankBefore:pilot.currentRank,inputRankAfter:advanced.discovery.diagnostics.fullLibraryRank,
    pilotStatus:pilot.status,fitAdequacyAfter:advanced.discovery.diagnostics.adequacy,
    timingsMs:{fit:fittedMs,nominal:nominalMs,pilot:pilotMs},completePilot:pilot});
}
// Exercise composition with the independently merged robust-loss notebook path.
const r=random(49331),rows=Array.from({length:40},()=>{const p={command:0,position:4*(r()-.5),rate:2*(r()-.5)};return {...p,jointTorque:-.7*p.position-.25*p.rate};});
let robust=createSession({schema:'worldlaw.observations/v2',observations:rows,offeredInputs:[{command:1.2,position:.3,rate:.4}]});
const plan=sessionPilotPlan(robust);robust=refitSession(robust,{loss:'soft_l1',lossScale:.03});
assert.equal(JSON.parse(exportSession(robust)).schema,'worldlaw.session/v3');
assert.deepEqual(sessionPilotPlan(restoreSession(exportSession(robust))),plan);
const summary=Object.fromEntries(policy.modes.map(mode=>{
  const rows=courses.filter(x=>x.mode===mode);
  // No acquisition and floating-point roundoff can never count as a gain.
  const reductions=rows.filter(x=>x.pilotSourceIndex!==null && x.nominalHeldOutRMSE-x.pilotHeldOutRMSE>Math.max(1e-9,1e-8*x.nominalHeldOutRMSE));
  return [mode,{courses:rows.length,receivingReductionAfterPilot:reductions.length,
    receivingReductionWithoutResidualMismatch:reductions.filter(x=>x.fitAdequacyAfter!=='residual_mismatch').length,
    minBeforeRMSE:Math.min(...rows.map(x=>x.beforeHeldOutRMSE)),maxAfterRMSE:Math.max(...rows.map(x=>x.pilotHeldOutRMSE)),
    completeCourseRefusals:rows.filter(x=>x.pilotSourceIndex===null).length,
    residualMismatches:rows.filter(x=>x.fitAdequacyAfter==='residual_mismatch').length}];
}));
const receipt={status:'PASS',policy,summary,courses,robustNotebookComposition:'source offers and input-only rank preserved through v3 loss replay'};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({status:receipt.status,summary,robustNotebookComposition:receipt.robustNotebookComposition},null,2));

