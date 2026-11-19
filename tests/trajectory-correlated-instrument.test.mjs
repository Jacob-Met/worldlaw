import test from 'node:test';
import assert from 'node:assert/strict';
import {acquireVirtualPendulumReadings} from '../src/trajectory/virtual-experiment.mjs';

test('stationary correlated sparse instrument records actual selected draws and replays exactly',()=>{
  const request={initialPosition:1.1,initialRate:0,duration:.8,sampleInterval:.04,noiseSigma:.01,seed:23891,sampleIndices:[1,4,12,20],noiseCorrelationTime:.4};
  const a=acquireVirtualPendulumReadings(request,{existingRuns:[]});
  assert.deepEqual(a,acquireVirtualPendulumReadings(request,{existingRuns:[]}));
  assert.equal(a.source.positionNoiseCorrelationTime,.4);
  assert.equal(a.source.noise.measurementDrawCount,4);
  assert.equal(a.source.noise.distribution,'seeded_stationary_exponential_gaussian_angle_perturbations');
  assert.deepEqual(a.readings.map(r=>r.sampleIndex),request.sampleIndices);
  const b=acquireVirtualPendulumReadings({...request,noiseCorrelationTime:0},{existingRuns:[]});
  assert.notEqual(a.source.recordingId,b.source.recordingId);
  assert.notDeepEqual(a.readings,b.readings);
  assert.throws(()=>acquireVirtualPendulumReadings({...request,noiseCorrelationTime:-1},{existingRuns:[]}));
});

test('zero-memory request preserves the original independent instrument bytes',()=>{
  const request={initialPosition:1.1,initialRate:0,duration:.8,sampleInterval:.04,noiseSigma:.01,seed:12815,sampleIndices:[1,4,12,20]};
  assert.deepEqual(acquireVirtualPendulumReadings(request,{existingRuns:[]}),acquireVirtualPendulumReadings({...request,noiseCorrelationTime:0},{existingRuns:[]}));
});
