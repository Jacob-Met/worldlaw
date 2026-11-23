import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {certifyLargeNoiseMinimum,verifyLargeNoiseMinimum,receiveLargeNoiseMinimum} from '../src/science/position-drift-fixed-tape-optimum.mjs';

const example='examples/active-position-drift-large-noise-minimum.json';
const source=()=>JSON.parse(readFileSync(example));
function run(exe,args){
  const out=spawnSync(exe,args,{encoding:'utf8'});
  assert.equal(out.status,0,out.stderr);return out.stdout;
}
test('inverse agrees with exhaustive dwell and horizon enumeration across strict rational boundaries',()=>{
  const src=source();
  for(let h=66n;h<=170n;h++){
    let product=0n;
    for(let k=1n;6n*k<h;k++)product=[product,k*(h-6n*k)].reduce((x,y)=>x>y?x:y);
    for(const perturbation of [-1n,0n,1n]){
      const numerator=1000n*product+perturbation,denominator=4000n*h;
      if(16n*numerator<11n*denominator)continue;
      src.catalog.noiseBound=numerator+'/'+denominator;
      let expected=66n;
      for(;;expected++){
        let success=false;
        for(let k=1n;6n*k<expected;k++)if(k*(expected-6n*k)*denominator>4n*expected*numerator){success=true;break;}
        if(success)break;
      }
      const p=certifyLargeNoiseMinimum(src);assert.equal(p.minimum,String(expected));
      assert.equal(p.candidates.length<=2,true);assert.equal(p.course.atRequestedNoise,'policy-separates');
    }
  }
  src.catalog.noiseBound='10/16';assert.throws(()=>certifyLargeNoiseMinimum(src),/11\/16/);
  src.catalog.noiseBound='11/16';src.catalog.laws[0].vertices.push(src.catalog.laws[0].vertices[0]);assert.throws(()=>certifyLargeNoiseMinimum(src),/four-vertex/);
});
test('public run reopens exact checkpoints and reconstructs a physical 66-pulse predecessor',()=>{
  const dir=mkdtempSync(join(tmpdir(),'large-minimum-'));
  try{
    const cli=['scripts/active-linear-family.mjs','--input',example,'--large-noise-minimum'];
    const save=join(dir,'plan.json'),ys=join(dir,'positions.json');
    run('node',[...cli,'--output',save]);const plan=JSON.parse(readFileSync(save));
    assert.equal(plan.minimum,'67');assert.equal(plan.predecessor.upper,'11/16');
    assert.deepEqual(plan.course.readAt,['0','31','67']);
    for(const [values,expected] of [[['0'],['A','B']],[['0','0','6'],['A']],[['0','0','0'],['B']]]){
      writeFileSync(ys,JSON.stringify(values));const received=JSON.parse(run('node',[...cli,'--replay',save,'--readings',ys]));
      assert.deepEqual(received.surviving,expected);
    }
    const original=source();const corrupt=structuredClone(plan);corrupt.predecessor.upper='2/3';
    assert.throws(()=>verifyLargeNoiseMinimum(original,corrupt),/saved minimum/);
    const predecessor=join(dir,'prior.json'),runs=join(dir,'runs.json');
    writeFileSync(predecessor,JSON.stringify(plan.predecessor.source));
    writeFileSync(runs,JSON.stringify([{command:'ref',repeats:33},{command:'x0',repeats:33}]));
    const obstruction=JSON.parse(run('python3',['scripts/near-balanced-even-obstruction.py',predecessor,'--balanced-bound','--runs',runs]));
    assert.equal(obstruction.radius,'11/16');
    assert.equal(obstruction.measurements.at(-1).tick,'66');
    assert.equal(obstruction.worlds.length,2);
    original.catalog.noiseBound='93/134';
    const next=certifyLargeNoiseMinimum(original);
    assert.equal(next.minimum,'68');assert.equal(next.predecessor.upper,'93/134');
    assert.equal(next.predecessor.method,'all-large-horizon-transfer');
    writeFileSync(predecessor,JSON.stringify(next.predecessor.source));
    assert.equal(JSON.parse(run('python3',['scripts/near-balanced-even-obstruction.py',predecessor])).radius,'93/134');
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('large rational input stays compact and a fixed source budget still governs planning',()=>{
  const src=source(),m=10n**200n;
  src.catalog.noiseBound=String(m);
  const p=certifyLargeNoiseMinimum(src);assert.equal(p.minimum,String(96n*m+1n));
  assert.equal(p.candidates.length,1);assert.equal(p.course.runs.length,7);assert.equal(p.predecessor.upper,String(m));
  assert.deepEqual(receiveLargeNoiseMinimum(src,p,['0']).nextRuns,p.course.runs.slice(0,1));
  src.catalog.limits.designWork=1;
  const refused=certifyLargeNoiseMinimum(src);assert.equal(refused.status,'design-budget-exhausted');
});
