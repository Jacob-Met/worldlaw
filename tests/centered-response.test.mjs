import test from 'node:test';import assert from 'node:assert/strict';
import {fitCenteredTorque,evaluate,predict,prepareTorquePredictor} from '../src/science/torque-discovery.mjs';
const course=origin=>Array.from({length:64},(_,i)=>({rate:(i-31.5)/32,position:0,command:0,jointTorque:origin+2*(i-31.5)/32+(i%9===0?100:0)}));
test('existing evaluator retains stable residual, explicitly reports rounded discrepancy and never refits challenge',()=>{
 let expected;for(const origin of [0,1e4,1e8,1e11]){const m=fitCenteredTorque(course(origin),['rate','bias'],.01);assert.equal(m.status,'converged');const before=JSON.stringify(m),row={rate:.125,position:0,command:0,jointTorque:origin+.25};const e=evaluate(m,[row]);expected??=e.rmse;assert.equal(e.rmse,expected);evaluate(m,[{...row,jointTorque:origin+100}]);assert.equal(JSON.stringify(m),before);if(origin===1e8)assert.notEqual(e.rmse,e.roundedRmse);}
});
test('prepared actual solver predictor owns a snapshot and returns explicitly rounded output',()=>{const m=fitCenteredTorque(course(1e8),['rate','bias'],.01),point={command:0,position:0,rate:.125},expected=predict(m,point),f=prepareTorquePredictor(m);m.origin=0;m.delta.terms[0].coefficient=0;assert.equal(f(0,0,.125),expected);});
test('original v1 prediction and evaluation semantics retained',()=>{const m={schema:'worldlaw.torque-model/v1',terms:[{id:'rate',coefficient:2},{id:'bias',coefficient:3}]},row={command:0,position:0,rate:2,jointTorque:8};assert.equal(predict(m,row),7);assert.equal(evaluate(m,[row]).rmse,1);});
test('missing constant refuses and aliased complete fit cannot claim convergence',()=>{assert.throws(()=>fitCenteredTorque(course(0),['rate'],.01));assert.equal(fitCenteredTorque(course(0),['rate','command','bias'],.01).status,'rank-unavailable');});
