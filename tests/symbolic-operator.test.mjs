import test from 'node:test';
import assert from 'node:assert/strict';
import {discover,predict} from '../src/science/torque-discovery.mjs';
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
  assert.throws(()=>predictEvolution(singular,row),/Undefined/);
  assert.equal(assessEvolution(singular,[row],1).reason,'undefined_operator');
  assert.throws(()=>synthesizeEvolution(Array(8).fill(row),{...grammar,kind:'oscillator',maxCandidates:5}),/candidate budget/);
});
