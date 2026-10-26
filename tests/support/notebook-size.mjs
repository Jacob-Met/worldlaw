// Authored persistence controls; these are not physical measurements.
import {createLab} from '../../src/science/virtual-lab.mjs';
import {WEIGHTED_OBSERVATION_SCHEMA} from '../../src/data.mjs';

export function metadataInput() {
  const lab=createLab({seed:173});
  return JSON.stringify({
    source:{label:'Authored notebook formatting control',
      metadata:{capture:{diagnostics:{qualityFlags:Array(120000).fill(0)}}}},
    observations:lab.initialSamples.slice(0,8),heldOut:lab.evaluationSamples.slice(0,8),
  });
}

export function unicodeInput() {
  const lab=createLab({seed:173});
  const small=0.0000010000000000000002;
  const row={command:-small,position:-small,rate:-small,jointTorque:-small,torqueNoiseRatio:small};
  const input={
    schema:WEIGHTED_OBSERVATION_SCHEMA,
    source:{label:'Authored Unicode notebook control; not physical evidence',
      metadata:{notes:'\u0800'.repeat(170000)}},
    observations:[...lab.initialSamples.slice(0,8).map(value=>({...value,torqueNoiseRatio:small})),
      ...Array.from({length:4087},()=>({...row}))],
    heldOut:Array.from({length:4096},()=>({...row})),
  };
  // Equivalent, shorter decimal lexemes keep this source below the existing
  // raw-file byte limit. JSON.parse normalizes their identical numeric values.
  return JSON.stringify(input)
    .replaceAll('-0.0000010000000000000002','-1.0000000000000002e-6')
    .replaceAll('0.0000010000000000000002','1.0000000000000002e-6');
}
