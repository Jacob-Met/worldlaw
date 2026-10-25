import test from 'node:test';
import assert from 'node:assert/strict';
import {fitSoftL1Columns,softL1Loss,softL1Weight,SOFT_L1_MAX_WORK} from '../src/science/robust-fit.mjs';
import {discover,refitDiscovery,evaluate,predict,simulate,discoveryRobustWork} from '../src/science/torque-discovery.mjs';
import {createSession,refitSession,appendMeasurements,sessionPlan,exportSession,restoreSession,undoSession} from '../src/session.mjs';

const near=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const columnsFor=xs=>[xs,xs.map(()=>1)];
const grid=(count,phase=0)=>Array.from({length:count},(_,i)=>{
  const command=.8*Math.sin(i*1.379+phase),position=2.2*Math.sin(i*.793+.4+phase),rate=1.8*Math.cos(i*2.417+phase);
  return {command,position,rate,jointTorque:1.6*command-.7*position-.23*rate*Math.abs(rate)+.004*Math.sin(i*4.217)};
});
function spiked(){const rows=grid(121);for(const i of [3,17,42,78,103])rows[i].jointTorque+=i%2?12:-12;return rows;}
const options={noiseSigma:.01,loss:'soft_l1',lossScale:.03};

test('soft-L1 loss and weights match independent scalar identities',()=>{
  near(softL1Loss(0,.4),0,0);
  near(softL1Loss(.4,.4),.32*(Math.SQRT2-1),1e-15);
  near(softL1Loss(-.4,.4),softL1Loss(.4,.4),0);
  near(softL1Weight(.4,.4),1/Math.SQRT2,1e-15);
  near(softL1Loss(1e-15,1),1e-30,1e-45);
  assert.ok(Number.isFinite(softL1Loss(1e12,1e-7)));
});

test('fixed intercept fit agrees with independently bracketed monotone score root',()=>{
  const readings=[1,1,1,9],scale=.5;
  let lower=1,upper=9;
  for(let i=0;i<100;i++){
    const mid=(lower+upper)/2;
    const derivative=readings.reduce((sum,y)=>sum+(mid-y)/Math.sqrt(1+((mid-y)/scale)**2),0);
    if(derivative>0)upper=mid;else lower=mid;
  }
  const fitted=fitSoftL1Columns([readings.map(()=>1)],readings,scale);
  assert.equal(fitted.status,'converged');near(fitted.coefficients[0],(lower+upper)/2,2e-8);
  assert.ok(fitted.coefficients[0]<1.2);assert.ok(fitted.scaledGradient<=fitted.stationarityTolerance);
});

test('independent gradient and perturbations verify a multicolumn optimum without mutating evidence',()=>{
  const x=Array.from({length:31},(_,i)=>(i-15)/7),y=x.map((v,i)=>1.7*v-.4+.015*Math.sin(i*1.3)+(i===4?5:0));
  const columns=columnsFor(x),snapshot=JSON.stringify({columns,y});
  const fitted=fitSoftL1Columns(columns,y,.05);assert.equal(fitted.status,'converged');
  const objective=b=>y.reduce((sum,value,i)=>sum+.0025*(Math.sqrt(1+((value-x[i]*b[0]-b[1])/.05)**2)-1),0);
  const original=objective(fitted.coefficients);
  for(const a of [-1,0,1])for(const b of [-1,0,1])assert.ok(objective([fitted.coefficients[0]+a*.0001,fitted.coefficients[1]+b*.0001])>=original-1e-12);
  for(const column of columns){
    const g=y.reduce((sum,value,i)=>{const r=value-x[i]*fitted.coefficients[0]-fitted.coefficients[1];return sum+column[i]*r/Math.sqrt(1+(r/.05)**2);},0);
    assert.ok(Math.abs(g)/Math.hypot(...column)/Math.sqrt(y.length)<=5e-10);
  }
  assert.equal(JSON.stringify({columns,y}),snapshot);
  const rescaled=fitSoftL1Columns([x.map(v=>v*1e-8),x.map(()=>1)],y,.05);
  assert.equal(rescaled.status,'converged');near(rescaled.coefficients[0]*1e-8,fitted.coefficients[0],1e-8);near(rescaled.coefficients[1],fitted.coefficients[1],1e-8);
});

test('the actual finite-library consumer recovers an authored law under isolated reading spikes',()=>{
  const training=spiked(),heldOut=grid(83,.721),original=JSON.stringify(training);
  const ordinary=discover(training,{noiseSigma:.01}),robust=discover(training,options);
  assert.equal(ordinary.selected.id,'spring+quadratic');assert.equal(robust.selected.id,'command+spring+quadratic');
  assert.ok(evaluate(ordinary.selected,heldOut).rmse>1);
  assert.ok(evaluate(robust.selected,heldOut).rmse<.004);
  assert.equal(robust.candidates.length,ordinary.candidates.length);
  assert.equal(robust.diagnostics.adequacy,'residual_mismatch');
  assert.ok(robust.selected.metrics.rmse>ordinary.selected.metrics.rmse,'raw error must not be replaced by a reduced loss');
  assert.equal(robust.selected.metrics.robust.halfWeightCount,5);
  assert.ok(robust.candidates.every(m=>m.metrics.robust.scaledGradient<=m.metrics.robust.stationarityTolerance));
  assert.equal(JSON.stringify(training),original);
  assert.ok(Number.isFinite(predict(robust.selected,{command:.2,position:.7,rate:-.3})));
  const path=simulate(robust.selected,{position:.7,rate:-.3},{duration:.5,dt:.01,inertia:1,command:.2});
  assert.equal(path.at(-1).time,.5);assert.ok(path.every(row=>Number.isFinite(row.position)));
});

test('clean exact evidence agrees with least squares and the default path stays unchanged',()=>{
  const rows=grid(53,.2).map(row=>({...row,jointTorque:1.6*row.command-.7*row.position-.23*row.rate*Math.abs(row.rate)}));
  const ordinary=discover(rows,{noiseSigma:.01});
  assert.deepEqual(discover(rows,{noiseSigma:.01,loss:'least_squares',lossScale:.03}),ordinary);
  const robust=discover(rows,options);assert.equal(robust.selected.id,ordinary.selected.id);
  near(evaluate(robust.selected,rows).rmse,0,1e-12);
  for(let i=0;i<ordinary.selected.terms.length;i++)near(robust.selected.terms[i].coefficient,ordinary.selected.terms[i].coefficient,1e-11);
  assert.equal(Object.hasOwn(ordinary.selected,'fitting'),false);
});

test('private fit reuse cannot cross loss assumptions, scales or mutated robust answers',()=>{
  const rows=spiked(),ordinary=discover(rows,{noiseSigma:.01});
  const robust=refitDiscovery(ordinary,options);
  assert.deepEqual(robust,discover(rows,options));
  const changedScale={...options,lossScale:.2};
  assert.deepEqual(refitDiscovery(robust,changedScale),discover(rows,changedScale));
  assert.notDeepEqual(refitDiscovery(robust,changedScale).selected.terms,robust.selected.terms);
  assert.deepEqual(refitDiscovery(robust,{noiseSigma:.01}),ordinary);
  robust.selected.metrics.robust.meanLoss=0;
  robust.selected.fitting.scale=999;
  robust.selected.terms[0].coefficient=999;
  assert.deepEqual(refitDiscovery(robust,options),discover(rows,options));
  assert.deepEqual(refitDiscovery(ordinary,{noiseSigma:.4}),discover(rows,{noiseSigma:.4}));
});

test('high coordinate leverage can still defeat soft-L1 and is not hidden as a successful recovery',()=>{
  const x=Array.from({length:40},(_,i)=>Math.sin(i)),y=x.map(v=>2*v+1);x.push(100);y.push(-1000);
  const fitted=fitSoftL1Columns(columnsFor(x),y,.05);
  assert.equal(fitted.status,'converged');assert.ok(Math.abs(fitted.coefficients[0]-2)>5);
  const ordinaryRegionRMSE=Math.sqrt(y.slice(0,40).reduce((s,v,i)=>s+(v-x[i]*fitted.coefficients[0]-fitted.coefficients[1])**2,0)/40);
  assert.ok(ordinaryRegionRMSE>5,'retain the adverse high-leverage result');
});

test('whole-library work and input failures do not return a shortened successful search',()=>{
  assert.ok(discoveryRobustWork(400,options)>SOFT_L1_MAX_WORK);
  assert.throws(()=>discover(grid(400),options),error=>error.code==='work_limit'&&/No subset/.test(error.message));
  assert.throws(()=>discover(grid(12),{loss:'guess',lossScale:.03}),/Unknown/);
  assert.throws(()=>discover(grid(12),{loss:'soft_l1'}),/lossScale/);
  assert.throws(()=>discover(grid(12),{loss:'soft_l1',lossScale:0}),/scale/i);
  assert.throws(()=>fitSoftL1Columns([[1,2]],[1,NaN],.03),/finite/);
  assert.equal(fitSoftL1Columns([[1,1],[1,1]],[1,2],.03).status,'rank-unavailable');
  const zero=discover(Array.from({length:12},()=>({command:0,position:0,rate:0,jointTorque:0})),options);
  assert.equal(zero.selected.id,'zero');assert.equal(zero.diagnostics.identifiability,'insufficient_excitation');
});

test('an actual unresolved candidate refuses the whole search without an ordinary-fit fallback',()=>{
  const rows=Array.from({length:35},(_,i)=>{const command=Math.sin(i*1.3),position=Math.cos(i*.7),rate=Math.sin(i*2.3);return {command,position,rate,jointTorque:Math.sin(i*1.73)*100+position**5};});
  const state=createSession({observations:rows}),before=JSON.stringify(state);
  assert.throws(()=>refitSession(state,{loss:'soft_l1',lossScale:1e-7}),error=>error.code==='robust_fit_incomplete'&&/No partially optimized ranking/.test(error.message));
  assert.equal(JSON.stringify(state),before);
  const resolved=discover(rows,{loss:'soft_l1',lossScale:.01});
  assert.equal(resolved.diagnostics.adequacy,'residual_mismatch');assert.ok(resolved.selected.metrics.rmse>60);
});

test('notebook revisions, undo and v3 source replay retain the original fit and all readings',()=>{
  const initial=createSession({source:{label:'Authored isolated-spike control'},observations:spiked(),heldOut:grid(19,.721)});
  const before=JSON.stringify(initial),next=refitSession(initial,options),text=exportSession(next),raw=JSON.parse(text);
  assert.equal(raw.schema,'worldlaw.session/v3');assert.equal(next.history[1].label,'Revised reading-loss assumption');
  assert.equal(raw.discovery,undefined);assert.equal(raw.base.observations.length,121);
  assert.deepEqual(restoreSession(text),next);assert.deepEqual(undoSession(next),initial);assert.equal(JSON.stringify(initial),before);
  for(const schema of ['worldlaw.session/v1','worldlaw.session/v2'])assert.throws(()=>restoreSession(JSON.stringify({...raw,schema})),/v3/);
  const ordinaryAgain=refitSession(next,{loss:'least_squares'});
  assert.equal(JSON.parse(exportSession(ordinaryAgain)).schema,'worldlaw.session/v3');
  assert.deepEqual(restoreSession(exportSession(ordinaryAgain)),ordinaryAgain);
  raw.discovery={selected:{id:'fabricated-cache'}};assert.equal(restoreSession(JSON.stringify(raw)).discovery.selected.id,next.discovery.selected.id);
  const acquired=appendMeasurements(next,[{command:.1,position:.2,rate:.3,jointTorque:1.6*.1-.7*.2-.23*.3*.3}]);
  assert.equal(acquired.discovery.options.loss,'soft_l1');assert.equal(acquired.discovery.observations.length,122);
  assert.deepEqual(restoreSession(exportSession(acquired)),acquired);
});

test('held-out outcomes cannot change fit, scale, rank, planner or candidate population',()=>{
  const training=spiked(),heldOut=grid(19,.71);
  const a=createSession({observations:training,heldOut},options);
  const b=createSession({observations:training,heldOut:heldOut.map(r=>({...r,jointTorque:r.jointTorque+1000}))},options);
  assert.deepEqual(a.discovery,b.discovery);assert.deepEqual(sessionPlan(a),sessionPlan(b));
  assert.notEqual(a.history[0].heldOutRMSE,b.history[0].heldOutRMSE);
});

test('exportable robust histories reserve their complete replay and refuse before accumulating unbounded refits',()=>{
  const state=createSession({observations:spiked()},options),raw=JSON.parse(exportSession(state));
  raw.events=Array.from({length:12},()=>({kind:'options',options:{loss:'soft_l1',lossScale:.03}}));
  assert.throws(()=>restoreSession(JSON.stringify(raw)),/Complete soft-L1 notebook replay/);
  assert.throws(()=>refitSession(state,{lossScale:NaN}),/scale/i);
  assert.equal(state.events.length,0);
});
