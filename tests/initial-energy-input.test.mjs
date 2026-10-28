import assert from 'node:assert/strict';
import {prepareInvariantInput,declaredBox,createRetirementGate} from '../src/trajectory/initial-energy-input.mjs';
import {rational,cmp} from '../src/unknown-lab/chronos-exact-halfplanes.mjs';
const model={id:'frozen',schema:'worldlaw.angular-model/v1',scaleMeaning:'angular_acceleration_only_absolute_torque_unknown',physicalInertia:null,absoluteTorqueIdentified:false,units:{position:'rad',rate:'rad/s',angularAcceleration:'rad/s²'},terms:[{id:'rate',coefficient:-.02,coefficientUnit:'1/s'},{id:'gravity',coefficient:-4,coefficientUnit:'rad/s²'}]};
const initial={kind:'supplied-point-state',position:.1,rate:0,runId:'r'};const settings={positionHalfWidth:.2,rateHalfWidth:.05};
const before=JSON.stringify({model,initial,settings}),a=prepareInvariantInput(model,initial,settings);
assert.equal(JSON.stringify({model,initial,settings}),before);
assert.deepEqual(prepareInvariantInput(model,{...initial,laterObservations:[NaN],horizon:Infinity},{...settings,maxStep:NaN}),a);
const box=declaredBox(.1,.2),q=x=>[BigInt(x.numerator),BigInt(x.denominator)];
assert(cmp(q(box.covered[1]),q(box.declared[1]))>0);
for(const n of box.sampled){assert(cmp(q(box.covered[0]),rational(n))<=0);assert(cmp(q(box.covered[1]),rational(n))>=0);}
for(const [center,width] of [[0,0],[1.4,.6],[-.1,.2],[Number.MIN_VALUE,Number.MIN_VALUE]]){const b=declaredBox(center,width);assert(cmp(rational(b.outward[0]),q(b.covered[0]))<=0);assert(cmp(rational(b.outward[1]),q(b.covered[1]))>=0);}
for(const terms of [[...model.terms,{id:'bias',coefficient:0,coefficientUnit:'rad/s²'}],[model.terms[0],model.terms[0]],[{...model.terms[0],coefficient:.02},model.terms[1]]])assert.throws(()=>prepareInvariantInput({...model,terms},initial,settings));
assert.throws(()=>prepareInvariantInput(model,{...initial,kind:'prelude-estimate'},settings));
const gate=createRetirementGate(),old=gate.begin();gate.retire();assert.equal(gate.commit(old,a),false);assert.equal(gate.value,null);const now=gate.begin();assert(gate.commit(now,a));gate.retire();assert.equal(gate.value,null);
console.log(JSON.stringify({groups:5,status:'passed',scope:'native admission, endpoint hull, noninterference, refusal, retirement only; no invariant or browser claim'}));
