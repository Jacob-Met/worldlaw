import test from 'node:test';
import assert from 'node:assert/strict';
import {discover,predict,evaluate,prepareTorquePredictor} from '../src/science/torque-discovery.mjs';
import {synthesizeEvolution,predictEvolution,assessEvolution} from '../src/science/operator-synthesis.mjs';
import {designEvolutionExcitation,rolloutEvolution,verifyEvolutionRollout} from '../src/science/operator-rollout.mjs';

const menu=['add','mul','div','sin','cos','tanh','abs'];
const grammar={operators:menu,maxNodes:4,maxTerms:2,beam:16,maxCandidates:1200,tolerance:1e-9};
const simple=kind=>({schema:'worldlaw.symbolic-evolution/v1',kind,terms:[{tree:'command',weight:1}]});
const drive=(id,initial,amp)=>({id,initial,step:.02,steps:20,forcing:{offset:0,amplitude:amp,startFrequency:1,endFrequency:3}});

test('the maintained torque entry distinguishes a command-position product from the fixed library',()=>{
  const train=[];
  for(const command of [-1,1]) for(const position of [-Math.PI,0,Math.PI]) for(const rate of [-1,1])
    train.push({command,position,rate,jointTorque:command*Math.cos(position)});
  const ordinary=discover(train,{terms:['command','command_position','rate','spring','gravity','cosine','cubic','quadratic','bias'],maxTerms:5,noiseSigma:.01});
  assert.equal(ordinary.diagnostics.adequacy,'residual_mismatch');
  assert.ok(Math.max(...train.map(x=>Math.abs(predict(ordinary.selected,x)-x.jointTorque)))>=1-1e-12);
  // New training angles break aliases which coincide on the three diagnostic angles.
  for(const position of [-2.3,-1.1,.4,1.7]) for(const command of [-.7,1.2]) for(const rate of [-.2,.5])
    train.push({position,command,rate,jointTorque:command*Math.cos(position)});
  const recovered=discover(train,{operatorGrammar:grammar});
  assert.equal(recovered.status,'candidate');
  assert.ok(evaluate(recovered.selected,train).maxAbsResidual < 1e-9);
  assert.ok(Math.abs(prepareTorquePredictor(recovered.selected)(2,0,0)-2)<1e-9);
  assert.deepEqual(recovered.model.terms.map(t=>t.tree),[['mul','command',['cos','position']]]);
  assert.ok(Math.abs(predict(recovered.model,{position:2.13,rate:-.6,command:-1.5})+1.5*Math.cos(2.13))<1e-9);
  assert.throws(()=>rolloutEvolution(recovered.model,drive('uncalibrated',[1,0],1)),/initial state/);
});

test('the same grammar recovers periodic advection and diffusion on changed spatial phases',()=>{
  const rows=[];
  for(const phase of [.2,.7,1.4]) {
    const u=Array.from({length:11},(_,k)=>Math.sin(phase+2*Math.PI*k/11)+.27*Math.cos(4*Math.PI*k/11-2*phase));
    for(let k=0;k<u.length;k++){
      const field=u[k],left=u[(k+10)%11],right=u[(k+1)%11],spacing=.5;
      rows.push({field,left,right,spacing,command:Math.sin(k-.3),change:-field*(right-left)/(2*spacing)+.2*(left-2*field+right)/(spacing**2)});
    }
  }
  const f=synthesizeEvolution(rows.slice(0,22),{...grammar,kind:'periodic'});
  assert.equal(f.status,'candidate');assert.equal(assessEvolution(f.model,rows.slice(22),1e-9).accepted,true);
  const zeroRows=[-2,2,-1,1].map(v=>({field:0,left:0,right:0,spacing:1,command:0,change:v/2}));
  const failed=synthesizeEvolution(zeroRows,{...grammar,kind:'periodic'});
  assert.equal(failed.status,'abstained');assert.ok(failed.training.maxError>=1);
});

test('finite excitation design scores input-only chirps and refuses singular or unbudgeted requests',()=>{
  const plain=simple('oscillator');
  const coupled={...plain,terms:[{tree:['mul','command',['cos','position']],weight:1}]};
  const quiet=drive('quiet',[0,0],0),active=drive('active',[2.2,0],2);
  const d=designEvolutionExcitation([plain,coupled],[quiet,active]);
  assert.equal(d.selected,'active');assert.ok(d.ranked[0].minimumSeparation>0);assert.equal(d.ranked[1].minimumSeparation,0);
  assert.equal(designEvolutionExcitation([plain,plain],[active]).status,'indistinguishable_on_menu');
  const exact=rolloutEvolution(coupled,active,16);
  assert.equal(verifyEvolutionRollout(coupled,active,exact,{maxError:1e-5,resolutionTolerance:1e-5}).accepted,true);
  assert.equal(verifyEvolutionRollout(plain,active,exact,{maxError:1e-5,resolutionTolerance:1e-5}).reason,'trajectory_mismatch');
  const singular={...plain,terms:[{tree:['div','command','rate'],weight:1}]};
  const row={position:1,rate:0,command:1,change:0};
  assert.throws(()=>predictEvolution(singular,row),/undefined_operator/);
  const held=verifyEvolutionRollout(singular,quiet,rolloutEvolution(plain,quiet),{maxError:1,resolutionTolerance:1});
  assert.deepEqual(held,{accepted:false,reason:'undefined_operator',resolution:null,held:null});
  assert.equal(designEvolutionExcitation([singular,plain],[quiet]).status,'no_admissible_course');
  const mixed=designEvolutionExcitation([singular,plain],[quiet,drive('finite',[1,2],1)]);
  assert.equal(mixed.selected,'finite');
  assert.deepEqual(mixed.excluded,[{id:'quiet',reason:'undefined_operator'}]);
  assert.equal(assessEvolution(singular,[row],1).reason,'undefined_operator');
  assert.throws(()=>synthesizeEvolution(Array(8).fill(row),{...grammar,kind:'oscillator',maxCandidates:5}),/candidate budget/);
});

test('continuous forcing is resolved before ranking or checking held trajectories',()=>{
  const active=simple('oscillator');
  const idle={...active,terms:[{tree:'command',weight:0}]};
  const sine=f=>({id:`sin-${f}`,initial:[0,0],step:1,steps:8,
    forcing:{amplitude:1,offset:0,startFrequency:f,endFrequency:f}});
  const dc={...sine(0),id:'dc',forcing:{amplitude:0,offset:.05,startFrequency:1e308,endFrequency:1e308}};
  const trajectory=f=>Array.from({length:9},(_,t)=>{
    const w=2*Math.PI*f;
    return [t/w-Math.sin(w*t)/(w*w),(1-Math.cos(w*t))/w];
  });
  const dcPath=Array.from({length:9},(_,t)=>[.025*t*t,.05*t]);
  const rms=path=>Math.sqrt(path.flat().reduce((sum,value)=>sum+value*value,0)/(2*path.length));
  for(const f of [.25,1.25]){
    const course=sine(f),truth=trajectory(f);
    const plan=designEvolutionExcitation([active,idle],[course,dc]);
    assert.equal(plan.selected,rms(truth)>rms(dcPath)?course.id:dc.id);
    const score=plan.ranked.find(row=>row.id===course.id);
    assert.ok(Math.abs(score.minimumSeparation-rms(truth))<.001);
    assert.equal(verifyEvolutionRollout(active,course,truth,{maxError:.001,resolutionTolerance:.001}).accepted,true);
  }
  const unresolved=sine(8.25);
  assert.ok(rms(trajectory(8.25))<rms(dcPath));
  for(const [startFrequency,endFrequency] of [[8.25,8.25],[8.25,0],[0,8.25]]){
    const c={...unresolved,forcing:{...unresolved.forcing,startFrequency,endFrequency}};
    const plan=designEvolutionExcitation([active,idle],[c,dc]);
    assert.equal(plan.selected,'dc');
    assert.deepEqual(plan.excluded,[{id:c.id,reason:'forcing_resolution_budget'}]);
    assert.equal(verifyEvolutionRollout(active,c,trajectory(8.25),{maxError:1,resolutionTolerance:1}).reason,'forcing_resolution_budget');
  }
  assert.equal(designEvolutionExcitation([active,active],[sine(1.25),dc]).status,'indistinguishable_on_menu');
});

test('the chirp phase survives a reciprocal time and frequency rescaling',()=>{
  const model=simple('periodic');
  const solve=duration=>rolloutEvolution(model,{
    id:'rescaled',initial:[0,0,0],spacing:1,step:duration,steps:1,
    forcing:{offset:0,amplitude:1/duration,startFrequency:0,endFrequency:1/duration,spatialMode:0},
  },16).at(-1);
  const normal=solve(1),rescaled=solve(1e308);
  assert.ok(normal[0]>.5);
  for(let i=0;i<normal.length;i++)assert.ok(Math.abs(normal[i]-rescaled[i])<1e-13);
});
