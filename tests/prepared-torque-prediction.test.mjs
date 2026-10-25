import test from 'node:test';
import assert from 'node:assert/strict';
import {TERMS, predict, prepareTorquePredictor} from '../src/science/torque-discovery.mjs';

const model = terms => ({schema:'worldlaw.torque-model/v1', terms});
const point = (command, position, rate) => ({command, position, rate});

test('prepared predictions retain exact public arithmetic across every term and ordering', () => {
  let seed = 0x4a1ede0c;
  const random = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0) + .5) / 4294967296;
  for (let caseIndex=0; caseIndex<240; caseIndex++) {
    const terms = TERMS.filter(() => random()>.4).map(t => ({id:t.id, coefficient:(random()-.5)*30}));
    if (caseIndex%2) terms.reverse();
    const original = model(terms), prepared = prepareTorquePredictor(original);
    for (let row=0; row<24; row++) {
      const values = point((random()-.5)*20, (random()-.5)*6, row===0?-0:(random()-.5)*10);
      assert.equal(prepared(values.command,values.position,values.rate), predict(original,values));
    }
  }
  for (const value of [-1e6,-0,0,1e6]) {
    const original=model([{id:'command',coefficient:1},{id:'spring',coefficient:-1},{id:'rate',coefficient:1}]);
    assert.equal(prepareTorquePredictor(original)(value,value,value),predict(original,point(value,value,value)));
  }
});

test('a prepared equation is isolated from later source and array mutations', () => {
  const original = model([{id:'spring',coefficient:-2},{id:'rate',coefficient:-.3}]);
  const expected=predict(original,point(0,.7,-.2)), prepared=prepareTorquePredictor(original);
  original.terms[0].coefficient=100;
  original.terms[1].id='unknown';
  original.terms.push({id:'bias',coefficient:9});
  original.terms=[];
  original.schema='changed';
  assert.equal(prepared(0,.7,-.2),expected);
  assert.throws(()=>predict(original,point(0,.7,-.2)));
});

test('prepared points retain public coordinate refusal and cannot hide invalid unused coordinates', () => {
  const original=model([]), prepared=prepareTorquePredictor(original);
  for (const invalid of [NaN,Infinity,-Infinity,1e6+1,-1e6-1,'1',null,undefined]) {
    for (const key of ['command','position','rate']) {
      const values={command:0,position:0,rate:0,[key]:invalid};
      let before,after;
      try {predict(original,values);} catch(error) {before={name:error.name,code:error.code,message:error.message};}
      try {prepared(values.command,values.position,values.rate);} catch(error) {after={name:error.name,code:error.code,message:error.message};}
      assert.ok(before);
      assert.deepEqual(after,before);
    }
  }
});

test('preparation rejects invalid models and rechecks captured accessor values', () => {
  for (const invalid of [null,{},model([{id:'bad',coefficient:1}]),model([{id:'rate',coefficient:NaN}]),model([{id:'rate',coefficient:1e18+256}]),model([{id:'bias',coefficient:1},{id:'bias',coefficient:2}])]) {
    assert.throws(()=>prepareTorquePredictor(invalid));
  }
  let reads=0;
  const changing=model([{id:'rate',get coefficient(){return ++reads===1?1:Infinity;}}]);
  assert.throws(()=>prepareTorquePredictor(changing),/coefficient/);
});
