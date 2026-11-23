import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {certifyFixedTapeOptimum as plan,receiveFixedTapeOptimum as receive} from '../src/science/position-drift-fixed-tape-optimum.mjs';
const source='examples/active-position-drift-fixed-tape-optimum.json';
const packet='examples/ten-pulse-terminal-adversary.json';
const script='scripts/verify-ten-pulse-terminal-adversary.py';
test('balanced midpoint and fixed-tape radii meet at adjacent multiples of twelve',()=>{
  const req=JSON.parse(readFileSync(source,'utf8'));
  for(const h of [11n,12n,13n,23n,24n,25n,119n,120n,121n,12n*10n**80n+1n]){
    const p=plan({...req,pulseBudget:String(h)}),[num,den='1']=p.radius.split('/');
    const q=h/2n;
    assert.equal(BigInt(num)*24n*h,BigInt(den)*q*(h-q));
  }
});

const read=(...args)=>spawnSync('python3',[script,source,packet,...args],{encoding:'utf8'});

test('all ten-pulse category patterns and every exceptional literal action word have a causal physical collision',()=>{
  const check=read();assert.equal(check.status,0,check.stderr);
  assert.deepEqual(JSON.parse(check.stdout),{noiseBound:'1/10',binaryPatterns:1024,ordinaryBinaryPatterns:1022,
    criticalWords:497664,physicalWorldTicks:10948608,multisetRoots:7056,distinctWorldPairs:6210,coveredTenPulseWords:1073741824});
  const s=JSON.parse(readFileSync(source,'utf8')),p=plan(s);
  assert.equal(p.radius,'5/44');assert.equal(p.atRequestedNoise,'policy-separates');
  assert.deepEqual(receive(s,p,['0','0','0']).surviving,['B']);
  assert.deepEqual(receive(s,p,['0','0','1']).surviving,['A']);
});

test('terminal adjustments preserve past readings on both category orders and each world stays persistent',()=>{
  const tapes=[[...Array(5).fill('ref'),'x1','y0','z0','y1','x0'],['x1','y1','x0','y0','z0',...Array(5).fill('ref')]];
  for(const [i,word] of tapes.entries()){
    const prefix=read('--commands',...word.slice(0,9)),full=read('--commands',...word);
    assert.equal(prefix.status,0,prefix.stderr);assert.equal(full.status,0,full.stderr);
    const past=JSON.parse(prefix.stdout),now=JSON.parse(full.stdout);
    assert.equal(past.branch,'balanced-midpoint');assert.equal(now.branch,'terminal-adjustment');
    assert.deepEqual(now.readings.slice(0,-1),past.readings);assert.deepEqual(now.worlds.map(w=>w.law),['A','B']);
    assert.equal(now.readings.at(-1),i?'67/120':'3/5');
  }
  const changed=read('--commands','ref','group','x1','y1','ref','group','x1','z0','ref','z1');
  assert.equal(changed.status,0,changed.stderr);assert.equal(JSON.parse(changed.stdout).branch,'balanced-midpoint');
  const bad=read('--commands','ref','other');assert.notEqual(bad.status,0);
});

test('missing multiset roots and negative physical masses are rejected',()=>{
  const code=`import json,sys,runpy
reader=runpy.run_path(sys.argv[1])['Receiver']
source=json.load(open(sys.argv[2]));p=json.load(open(sys.argv[3]))
for kind in ('row','root'):
 q=dict(p)
 if kind=='row':
  q['worldPairs']=[['-1']+p['worldPairs'][0][1:]]+p['worldPairs'][1:]
 else:
  q['roots']=p['roots'][:-1]
 try: reader(source,q)
 except ValueError: pass
 else: raise AssertionError('forged certificate accepted')`;
  const result=spawnSync('python3',['-c',code,script,source,packet],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
});
