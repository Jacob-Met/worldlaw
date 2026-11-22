import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_VANDERMONDE_NONLINEAR_SCHEMA,
  ACTIVE_VANDERMONDE_READINGS_SCHEMA,
  designActiveVandermondeNonlinear,
  evaluateActiveVandermondeReadings,
} from '../src/science/active-vandermonde-nonlinear.mjs';

function repeatedCourse(values, {noiseBound='1', hypotheses=true, maxDegree=3}={}) {
  const request={schema:ACTIVE_VANDERMONDE_NONLINEAR_SCHEMA,stateDimension:1,
    horizon:values.length,maxDegree,noiseBound,
    plant:{A:[['0']],bUnit:['1'],C:['1']},
    ...(hypotheses?{hypotheses:[{id:'zero',coefficients:Array(maxDegree+1).fill('0')}]}:{})};
  const plan=designActiveVandermondeNonlinear(request);
  const supplied={schema:ACTIVE_VANDERMONDE_READINGS_SCHEMA,
    source:'Independent exact repeated-response interval control',acquisition:'synthetic',
    episodes:plan.amplitudes.map((amplitude,episode)=>({episode,amplitude,
      readings:values.map((value,tick)=>({tick,value:String(value)}))}))};
  return {request,plan,supplied};
}
const receive=c=>evaluateActiveVandermondeReadings(c.request,c.plan,c.supplied);

test('a nullspace basis cannot certify mutually incompatible episode error vectors',()=>{
  const c=repeatedCourse([0,0,-2,2]);
  const out=receive(c);
  assert.equal(out.status,'abstained_out_of_family_nonlinearity');
  assert.deepEqual(out.consistentHypothesisIds,[]);
  assert.equal(out.dynamicalViolations.length,5);
  for(const witness of out.dynamicalViolations){
    // After A=0, every forced reading has the SAME response g. Readings
    // -2 and +2 with error <=1 require g<=-1 and g>=1 simultaneously.
    assert.deepEqual(witness.weights,['0','0','1','-1']);
    assert.equal(witness.residual,'4');
    assert.equal(witness.threshold,'2');
  }
});

test('closed noise-bound contact stays feasible and a selected invariant is insufficient to accept a fixed law',()=>{
  const valid=receive(repeatedCourse([0,0,-1,1]));
  assert.equal(valid.status,'one_nonlinear_law_certified');
  assert.deepEqual(valid.consistentHypothesisIds,['zero']);
  assert.deepEqual(valid.dynamicalViolations,[]);
  const wrongLaw=receive(repeatedCourse([0,1,3,3]));
  // The full episode forces g=2. Its first invariant alone accepts g=0.
  assert.equal(wrongLaw.status,'all_hypotheses_falsified');
  assert.equal(wrongLaw.abstainedOutOfFamily,false);
  assert.deepEqual(wrongLaw.falsifiedHypothesisIds,['zero']);
  assert.equal(receive(repeatedCourse([0,1,3,3],{hypotheses:false})).status,
    'nonlinear_polynomial_law_recovered');
});

test('all amplitudes must admit one polynomial, rather than separate errors for each basis residual',()=>{
  const c=repeatedCourse([0,0],{hypotheses:false,maxDegree:2});
  const responses=[0,0,0,8,-18];
  c.supplied.episodes.forEach((ep,k)=>{ep.readings[1].value=String(responses[k]);});
  const out=receive(c);
  assert.equal(out.status,'abstained_out_of_family_nonlinearity');
  assert.deepEqual(out.dynamicalViolations,[]);
  assert.ok(out.polynomialViolations.length>0);
  const witness=out.polynomialViolations.find(v=>v.certificate==='complete_polynomial_response_box');
  assert.ok(witness,'complete polynomial box must explain the new refusal');
  assert.equal(witness.responseIntervals.length,5);
});

test('every small repeated-response integer course agrees with direct interval intersection',()=>{
  for(let a=-3;a<=3;a++)for(let b=-3;b<=3;b++)for(let c=-3;c<=3;c++){
    const out=receive(repeatedCourse([7,a,b,c]));
    const lo=Math.max(a,b,c)-1,hi=Math.min(a,b,c)+1;
    const expected=lo>hi?'abstained_out_of_family_nonlinearity':
      lo<=0&&hi>=0?'one_nonlinear_law_certified':'all_hypotheses_falsified';
    assert.equal(out.status,expected,JSON.stringify({a,b,c,lo,hi}));
  }
});

test('an unobserved initial coordinate and all-zero observation rows preserve exact response bounds',()=>{
  const c=repeatedCourse([0,0,-1,1]);
  c.request.plant.observationTicks=[1,2,3];
  c.plan=designActiveVandermondeNonlinear(c.request);
  for(const ep of c.supplied.episodes)ep.readings=ep.readings.slice(1);
  const out=receive(c);
  assert.equal(out.status,'one_nonlinear_law_certified');
  assert.deepEqual(out.consistentHypothesisIds,['zero']);
});

test('fractional closed boundaries are exact and a changed observation cannot inherit an earlier acceptance',()=>{
  const c=repeatedCourse(['0','0','-1/7','1/7'],{noiseBound:'1/7'});
  assert.equal(receive(c).status,'one_nonlinear_law_certified');
  c.supplied.episodes[2].readings[3].value='1000001/7000000';
  assert.equal(receive(c).status,'abstained_out_of_family_nonlinearity');
});
