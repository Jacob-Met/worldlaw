import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeClockTicks,inspectClockTickEvidence} from '../src/science/clock-ticks.mjs';
test('retained actual host clock export preserves128 instants where premature Number conversion keeps69',()=>{
 const o=JSON.parse(readFileSync(new URL('../evidence/clock-tick-host-export.json',import.meta.url),'utf8'));
 const source={schema:'worldlaw.clock-tick-input/v1',source:o.source,units:{time:'ticks'},clocks:{state:{origin:o.origin,ticksPerSecond:o.ticksPerSecond},torque:{origin:o.origin,ticksPerSecond:o.ticksPerSecond}},maximumRoundingErrorSeconds:1e-12,hypotheses:[{id:'clock-only',scale:1,offset:0}],maxGap:1,tieTolerance:1e-9,states:o.timestamps.map((timestampTicks,i)=>({timestampTicks,role:i<64?'training':'challenge'})),torques:o.timestamps.slice(0,2).map(timestampTicks=>({timestampTicks}))};
 const c=normalizeClockTicks(source);assert.equal(new Set(o.timestamps).size,128);assert.equal(new Set(o.timestamps.map(Number)).size,69);assert.equal(new Set(c.input.states.map(r=>r.time)).size,128);
 assert.deepEqual(c.conversion.clocks.state.rows.map(r=>r.originalTicks),o.timestamps);
 // These are actual host clock reads, not state/torque sensor values. Missing
 // physics must refuse rather than silently turn timestamp intake into a law.
 assert.throws(()=>inspectClockTickEvidence({schema:'worldlaw.torque-model/v1',terms:[]},source),/position must be finite/);
});
