import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {analyzeReflectionCompatibility as analyze, reflectionSlices, reflectionDisplayBounds} from '../src/science/reflection-compatibility.mjs';

const oracle = fileURLToPath(new URL('../independent-review/reflection-oracle.py', import.meta.url));
const declaration = Object.freeze({command:0,rate:0,absoluteTorqueError:0,exactCoordinates:true});
const row = (position,jointTorque,extra={}) => ({command:0,rate:0,position,jointTorque,...extra});
const Q = (numerator,denominator=1n) => ({numerator:String(numerator),denominator:String(denominator)});
function replay(observations, decl, result, caseId='control') {
  return spawnSync(process.env.PYTHON || 'python3', [oracle], {input:JSON.stringify({caseId,input:{observations,declaration:decl},result}),encoding:'utf8',maxBuffer:2_000_000});
}
function receive(observations, decl=declaration, caseId='control') {
  const result=analyze(observations,decl), receipt=replay(observations,decl,result,caseId);
  assert.equal(receipt.status,0,receipt.stderr || String(receipt.error));
  assert.equal(JSON.parse(receipt.stdout).verified,true);
  return result;
}
function freeze(value) {
  if (value && typeof value==='object') {Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
}

test('exact half-subnormal offset survives serialization; another pair excludes it', () => {
  const rows=[row(-1,0),row(1,Number.MIN_VALUE)];
  const r=receive(rows,declaration,'half-subnormal');
  assert.equal(r.status,'compatible');
  assert.deepEqual(r.certificate.offset,Q(1n,1n<<1075n));
  assert.deepEqual(reflectionDisplayBounds(r.certificate.offset),{lower:0,upper:Number.MIN_VALUE});
  const excluded=receive([...rows,row(-2,0),row(2,0)],declaration,'rounded-averages-would-agree');
  assert.equal(excluded.status,'excluded');
  assert.deepEqual(excluded.certificate.gap,Q(1n,1n<<1075n));
});

test('closed touching intervals differ from the immediately smaller binary64 radius', () => {
  const rows=[row(-1,0),row(1,0),row(-2,2),row(2,2)];
  const touching=receive(rows,{...declaration,absoluteTorqueError:1},'touching');
  assert.equal(touching.status,'compatible');
  assert.deepEqual(touching.commonOffset,{lower:Q(1),upper:Q(1)});
  const smaller=receive(rows,{...declaration,absoluteTorqueError:1-2**-53},'next-below-radius');
  assert.equal(smaller.status,'excluded');
  assert.deepEqual(smaller.certificate.gap,Q(1n,1n<<52n));
});

test('odd-plus-offset control, quadratic disconfirmation, zero anchoring and repeat conflict', () => {
  const odd=receive([-2,-1,0,1,2].map(x=>row(x,3+2*x)));
  assert.equal(odd.status,'compatible');assert.deepEqual(odd.certificate.offset,Q(3));
  assert.equal(receive([-2,-1,1,2].map(x=>row(x,x*x))).status,'excluded');
  assert.equal(receive([row(-1,0),row(1,2),row(0,0)]).status,'excluded');
  const repeats=receive([row(-1,0),row(-1,3),row(1,0)],{...declaration,absoluteTorqueError:1});
  assert.equal(repeats.status,'repeat-conflict');assert.deepEqual(repeats.certificate.gap,Q(1));
  assert.equal(repeats.constraints.length,0);
});

test('coverage refuses zero-only and near-opposites without inventing counterparts', () => {
  for (const rows of [[],[row(0,2)],[row(1,0),row(-1-Number.EPSILON,0)]]) {
    assert.equal(receive(rows).status,'insufficient');
  }
  const rows=[row(-1,1),row(1,3),row(7,900),row(0,2),row(-1,1),row(-1,42,{command:1})];
  const r=receive(rows);
  assert.equal(r.status,'compatible');
  assert.deepEqual(r.coverage,{selectedRows:5,states:4,mirroredPairs:1,pairedRows:3,zeroRows:1,unmatchedRows:1});
  assert.deepEqual(r.selectedRowIndices,[0,1,2,3,4]);
  const slices=reflectionSlices(rows);
  assert.equal(slices.length,2);
  assert.deepEqual(slices[0],{command:0,rate:0,rowIndices:[0,1,2,3,4],positionCount:4,mirroredPairs:1,zeroRows:1,unmatchedRows:1});
  const boundary=[row(-1,1,{command:-0,rate:+0}),row(1,3,{command:+0,rate:-0}),
    row(-0,2,{command:-0,rate:-0}),row(+0,2),
    row(-1,99,{command:Number.MIN_VALUE}),row(1,99,{rate:Number.MIN_VALUE})];
  const exactSlice=receive(boundary,{...declaration,command:-0,rate:-0},'exact-slice-and-signed-zero');
  assert.equal(exactSlice.status,'compatible');
  assert.deepEqual(exactSlice.selectedRowIndices,[0,1,2,3]);
  assert.deepEqual(exactSlice.certificate.offset,Q(2));
  const boundarySlices=reflectionSlices(boundary);
  assert.deepEqual(boundarySlices.map(s=>[s.command,s.rate,s.rowIndices]),
    [[0,0,[0,1,2,3]],[0,Number.MIN_VALUE,[5]],[Number.MIN_VALUE,0,[4]]]);
  assert.equal(boundarySlices[0].zeroRows,2);
  assert.equal(boundarySlices[0].positionCount,3);
});

test('permutation, sign reversal and exact translation preserve the mathematical result and inputs', () => {
  const rows=freeze([row(-1,0),row(1,4),row(-2,-2),row(2,6),row(0,2)]);
  const decl=freeze({...declaration,absoluteTorqueError:.5});
  const before=JSON.stringify({rows,decl});
  const base=receive(rows,decl);
  const permuted=receive([rows[3],rows[0],rows[4],rows[1],rows[2]],decl);
  assert.deepEqual(permuted.commonOffset,base.commonOffset);
  const negative=receive(rows.map(r=>({...r,jointTorque:-r.jointTorque})),decl);
  assert.deepEqual(negative.commonOffset,{lower:Q(-5,2),upper:Q(-3,2)});
  const translated=receive(rows.map(r=>({...r,jointTorque:r.jointTorque+8})),decl);
  assert.deepEqual(translated.commonOffset,{lower:Q(19,2),upper:Q(21,2)});
  assert.equal(JSON.stringify({rows,decl}),before);
  const withRatios=rows.map(r=>({...r,torqueNoiseRatio:100}));
  assert.deepEqual(receive(withRatios,decl).commonOffset,base.commonOffset);
});

test('missing declarations have no conclusion; invalid declarations and original rows refuse', () => {
  const rows=[row(-1,0),row(1,0)];
  for (const key of ['command','rate','absoluteTorqueError','exactCoordinates']) {
    const decl={...declaration};delete decl[key];
    const r=receive(rows,decl);assert.equal(r.status,'declaration-required');
    assert.ok(r.missing.includes(key));
  }
  for (const value of [-1,NaN,Infinity,'0',null,1e6+1]) {
    assert.throws(()=>analyze(rows,{...declaration,absoluteTorqueError:value}));
  }
  for (const key of ['command','rate']) assert.throws(()=>analyze(rows,{...declaration,[key]:Infinity}));
  assert.throws(()=>analyze([row(-1,NaN)],declaration));
  assert.throws(()=>analyze([row(-1,0),row(1,0,{position:1e6+1})],declaration));
});

test('independent oracle rejects corrupted witnesses, source custody, and exclusion gaps', () => {
  const rows=[row(-1,0),row(1,2),row(0,1)];
  const valid=receive(rows);
  const witness=structuredClone(valid);witness.certificate.stateTorques[0].torque=Q(999);
  const custody=structuredClone(valid);custody.states[0].readingBounds[0].rowIndex=2;
  for (const corrupted of [witness,custody]) {
    const receipt=replay(rows,declaration,corrupted,'intentional-corruption');
    assert.equal(receipt.status,1,receipt.stderr);assert.equal(JSON.parse(receipt.stderr).verified,false);
  }
  const contradictory=[row(-1,0),row(1,0),row(-2,2),row(2,2)];
  const exclusion=receive(contradictory);exclusion.certificate.gap=Q(0);
  const receipt=replay(contradictory,declaration,exclusion,'false-gap');
  assert.equal(receipt.status,1,receipt.stderr);assert.equal(JSON.parse(receipt.stderr).verified,false);
});
