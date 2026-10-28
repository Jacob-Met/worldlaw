import assert from 'node:assert/strict';
import {confineDampedSine} from '../src/trajectory/initial-energy.mjs';
const good={numerator:'0',denominator:'1'},law={rate:0,gravity:-4};
let touched=0;const poison={get numerator(){touched++;throw Error('decoded too early');}};
const huge=Array(100001).fill(poison);
for(const [position,rate] of [[huge,[good,good]],[[poison,poison],huge]]){
 const r=confineDampedSine({law,box:{position:{covered:position},rate:{covered:rate}}});assert.equal(r.reason,'box_shape');assert.equal(r.operations,0);assert.equal(touched,0);
}
let coerced=0;const malformed=[{numerator:{toString(){coerced++;return '0';}},denominator:'1'},{numerator:'0'.repeat(1236),denominator:'1'},{numerator:'0',denominator:'1'.repeat(1236)}];
for(const value of malformed){const r=confineDampedSine({law,box:{position:{covered:[value,good]},rate:{covered:[good,good]}}});assert.equal(r.reason,'rational_input');assert.equal(r.operations,0);}
assert.equal(coerced,0);console.log('Malformed input group passed: both shapes checked before any decode; nonstrings never coerced; overlong strings refused.');
