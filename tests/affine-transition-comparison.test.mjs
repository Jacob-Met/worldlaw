import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {recoverAffineOscillator} from '../src/science/affine-transition-identification.mjs';
import {constantOscillatorFlow} from '../src/science/affine-oscillator-flow.mjs';

const receipt=JSON.parse(readFileSync(new URL('../docs/receipts/affine-transition-identification/paired-course.json',import.meta.url)));
const override=process.env.WORLDLAW_WEAK_BASELINE;
const baselineUrl=override?pathToFileURL(resolve(override)):new URL('../src/science/operator-synthesis.mjs',import.meta.url);
const bytes=readFileSync(baselineUrl);
const baselineBlob=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
if(override)assert.equal(baselineBlob,receipt.weakBlob,'Use the registered weak-fitter blob');
const weakFit=baselineBlob===receipt.weakBlob?(await import(baselineUrl.href)).synthesizeWeakEvolution:null;

const worlds=[[-.6,.25,.8],[-.6,1.25,.8],[-1.4,.5,-.7],[-1.4,1,-.7],[-2.2,.75,1.3],[-2.2,1.25,1.3]];
const changed=[[.31,-.27,-.91],[-.42,.65,.33],[1.07,-.41,1.67]];
function physical(b,g,q,v,u,t) {
  const terminal=-(.17+g*u)/b;
  return [q+terminal*t+(v-terminal)*Math.expm1(b*t)/b,terminal+(v-terminal)*Math.exp(b*t)];
}
function training(b,g,step,sigma){
  const runs=[];
  for(const q of [-1.3,1.9])for(const v of [-.8,1.2])for(const u of [-.5,.9]){
    const j=runs.length,values=Array.from({length:17},(_,i)=>{
      const [x,velocity]=physical(b,g,q,v,u,i*step);
      return i===0?[x,velocity]:[x+sigma*Math.sin(1.37*i+.73*j),velocity+sigma*Math.cos(.91*i-1.17*j)];
    });
    runs.push({id:'run-'+j,step,values,commands:Array(17).fill(u),intervalCommands:Array(16).fill(u)});
  }
  return runs;
}
function score(fit,b,g){
  if(fit.status!=='candidate')return null;
  let worst=0;
  for(const [q,v,u] of changed){
    const course={initial:[q,v],forcing:{offset:u,amplitude:0},step:.15,steps:12};
    const states=constantOscillatorFlow(fit.model,course);
    for(let i=0;i<states.length;i++) {
      const truth=physical(b,g,q,v,u,i*.15);
      worst=Math.max(worst,Math.abs(states[i][0]-truth[0]),Math.abs(states[i][1]-truth[1]));
    }
  }
  return worst;
}
export function finiteCadenceComparison(){
  const rows=[];
  for(const sigma of [0,1e-6,1e-3])for(const [b,step,g] of worlds){
    const runs=training(b,g,step,sigma),tolerance=20*sigma+1e-9;
    const weak=weakFit?weakFit(runs,{kind:'oscillator',step,width:4,stride:2,operators:['mul'],
      maxNodes:1,maxCandidates:10,maxTerms:3,beam:8,tolerance}):null;
    const direct=recoverAffineOscillator(runs,{positionTolerance:tolerance,velocityTolerance:tolerance});
    const saved=receipt.rows[rows.length];
    assert.deepEqual([sigma,b,step,g],[saved.sigma,saved.b,saved.step,saved.g]);
    if(weak){
      assert.equal(weak.status,saved.weakStatus);
      assert.ok(Math.abs(score(weak,b,g)-saved.weakMax)<1e-10,'registered weak comparison drifted');
    }
    rows.push({sigma,b,step,g,weakStatus:saved.weakStatus,directStatus:direct.status,
      weakMax:saved.weakMax,directMax:score(direct,b,g)});
  }
  return rows;
}
test('paired finite-cadence course retains every clean and disturbed outcome',()=>{
  const rows=finiteCadenceComparison();
  assert.equal(rows.length,18);
  for(const [i,row] of rows.entries()){
    assert.equal(row.directStatus,receipt.rows[i].directStatus);
    assert.ok(Math.abs(row.directMax-receipt.rows[i].directMax)<1e-10);
  }
  const clean=rows.filter(r=>r.sigma===0);
  assert.equal(clean.length,6);
  for(const r of clean){
    assert.equal(r.directStatus,'candidate');assert.equal(r.weakStatus,'candidate');
    assert.ok(r.directMax<1e-9&&r.directMax<r.weakMax);
  }
});
