import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {ACTIVE_LINEAR_CALIBRATION_SCHEMA, designActiveLinearFamily} from '../../src/science/active-linear-family.mjs';

export const laws = ['relative', 'sum', 'first_only', 'second_only'];
const scale = 10000;
const rational = n => `${Math.round(scale*n)}/${scale}`;
export function responseBasis(p) {
  const [a,b] = p.map(v => v*Math.PI/180);
  return [a-b, a+b, a, b].map(x => Math.round(scale*Math.cos(x)**2));
}

export function course(angles, noise) {
  return {
    schema:ACTIVE_LINEAR_CALIBRATION_SCHEMA,
    source:'Offline physical Causal Chambers commands. Four deterministic cosine-squared templates are supplied as basis inputs to the maintained exact static readout.',
    hypotheses:laws.map((id,j) => ({id, A:[[0]], C:[1], B:[laws.map((_,i) => Number(i===j))]})),
    controls:angles.map(pair=>responseBasis(pair).map(v=>`${v}/${scale}`)),
    sensorGain:['4/5','6/5'], noiseBound:rational(noise),
    offeredTicks:angles.map((_,i)=>i+1), maxReadings:6, workLimit:50000
  };
}

export function plan(calibration, grid, blocks=20) {
  const result=[];
  for (let i=0; i<blocks; i++) {
    const start=i*50;
    const request=course(grid.slice(start,start+10),calibration.noise);
    const certificate=designActiveLinearFamily(request);
    result.push({block:i, sourceStart:start, status:certificate.status, used:certificate.numReadings,
      selected:certificate.selection?.map(row=>row.tick)??[], certificate});
  }
  return result;
}

if (process.argv[1] && import.meta.url===new URL('file:'+process.argv[1]).href) {
  const [source, destination] = process.argv.slice(2);
  const bytes=readFileSync(source);const data=JSON.parse(bytes);
  const panels={};
  for(const [key,grid] of Object.entries(data.target_commands)) {
    const [color]=key.split('_');
    panels[key]=plan(data.development[color],grid);
  }
  writeFileSync(destination, JSON.stringify({inputSha:createHash('sha256').update(bytes).digest('hex'),panels})+'\n',{flag:'wx'});
}
