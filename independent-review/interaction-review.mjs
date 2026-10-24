import assert from 'node:assert/strict';import fs from 'node:fs';
import * as next from '../src/session.mjs';import {pathToFileURL} from 'node:url';
if(!process.env.BASELINE_SESSION_MODULE)throw Error('Set BASELINE_SESSION_MODULE to the frozen pre-interaction src/session.mjs');
const old=await import(pathToFileURL(process.env.BASELINE_SESSION_MODULE));import {inspectInputEnclosures} from '../src/science/input-enclosure.mjs';
for(let seed=3;seed<15;seed++){const a=old.newVirtualSession(seed),b=next.newVirtualSession(seed);assert.deepEqual(b,a);assert.equal(next.exportSession(b),old.exportSession(a));const revised=next.refitSession(b,{includeCommandPosition:true});assert.throws(()=>old.restoreSession(next.exportSession(revised)));assert.deepEqual(next.restoreSession(next.exportSession(revised)),revised);assert.deepEqual(next.undoSession(revised),b);}
let seed=124578;const rand=()=>((seed=(1664525*seed+1013904223)>>>0)/2**32);const cases=[];
for(let i=0;i<500;i++){
 const row={command:(rand()-.5)*20,position:(rand()-.5)*20,rate:0,jointTorque:0},r={command:i%7?rand()*12:0,position:i%5?rand()*12:0,rate:0,jointTorque:0};
 const terms=[{id:'command_position',coefficient:(rand()-.5)*10},{id:'spring',coefficient:(rand()-.5)*6},{id:'cubic',coefficient:(rand()-.5)*.1}];
 const results=[0,1,4,16,64].map(refinementSegments=>inspectInputEnclosures({schema:'worldlaw.torque-model/v1',terms},[row],r,{refinementSegments}).rows[0].prediction);
 cases.push({row,r,terms,results});
}
fs.writeFileSync(new URL('./interaction-oracle-cases.json',import.meta.url),JSON.stringify(cases));console.log('12 full default-session parity, legacy refusal, v2 replay and undo controls passed;500 interval cases generated');
