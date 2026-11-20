import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ACTIVE_LINEAR_READINGS_SCHEMA,evaluateActiveLinearReadings} from '../../src/science/active-linear-family.mjs';
import {course} from './plan.mjs';

const [source,plans,scored] = process.argv.slice(2).map(p=>JSON.parse(readFileSync(p)));
let checked=0, absent=0;
for(const [key,blocks] of Object.entries(plans.panels)) {
  const [color]=key.split('_');
  for(const item of blocks) {
    const row=scored.recordings[key][item.block];
    if(!row.certified) {assert.equal(row.active_compatible,null);absent++;continue;}
    const start=item.sourceStart;
    const request=course(source.target_commands[key].slice(start,start+10),source.development[color].noise);
    const reading={schema:ACTIVE_LINEAR_READINGS_SCHEMA,source:'CC BY 4.0 Causal Chambers published lt_malus_v1 physical ir_3 photometer readings.',
      acquisition:'supplied',readings:item.selected.map((tick,j)=>({tick,value:`${row.active_readings[j]}/10000`}))};
    const result=evaluateActiveLinearReadings(request,item.certificate,reading);
    const survivors=result.checks.filter(c=>c.status==='consistent').map(c=>c.hypothesis);
    assert.deepEqual(survivors,row.active_compatible);
    assert.equal(result.physicalActionsPerformed,false);
    checked++;
  }
}
console.log(JSON.stringify({nativeCertifiedReadouts:checked,withoutCertificate:absent,total:checked+absent}));
