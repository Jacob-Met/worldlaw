import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {certifyPhysicalFeedbackTree,receivePhysicalFeedbackTree} from '../src/science/position-drift-physical-feedback.mjs';

const receiver='scripts/verify-factored-feedback.py';
const five='examples/active-position-drift-five-pulse-minimum.json';
const six='examples/active-position-drift-six-pulse-tree.json';
const best='examples/factored-feedback-ref-ref.jsonl';
const exhibit='examples/factored-feedback-six.jsonl';
const complete=['--complete','--prefix','["ref","ref"]','--horizon','5'];
function run(source,proof,...args){
  return spawnSync('python3',[receiver,source,proof,...args],{encoding:'utf8'});
}
test('streamed physical and lower certificates export executable sparse feedback policies',()=>{
  const dir=mkdtempSync(join(tmpdir(),'factored-feedback-'));
  try{
    for(const [source,proof,args,radius,blocks,pairs,readings] of [
      [five,best,complete,'1/29',64,512,[17,20,23,27,30,34]],
      [six,exhibit,[],'3/76',2,4,[17,20,23,26,30,33,37]],
    ]){
      const path=join(dir,'policy-'+pairs+'.json');
      const r=run(source,proof,...args,'--export-policy',path);assert.equal(r.status,0,r.stderr);
      const summary=JSON.parse(r.stdout);
      assert.deepEqual([summary.lower,summary.upper,summary.blocks,summary.terminalPairs,summary.retainedWords],
                       [radius,radius,blocks,pairs,4]);
      const policy=JSON.parse(readFileSync(path,'utf8')),cert=certifyPhysicalFeedbackTree(policy);
      assert.equal(cert.tree.radius,radius);
      assert.deepEqual(receivePhysicalFeedbackTree(policy,cert,readings).surviving.map(s=>s.law),['A']);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('source, ancestral observations, leaf coverage and original dual weights all bind',()=>{
  const dir=mkdtempSync(join(tmpdir(),'factored-incorrect-'));
  try{
    const path=join(dir,'bad.jsonl');
    const lines=()=>readFileSync(exhibit,'utf8').trim().split('\n').map(s=>JSON.parse(s));
    const refuse=(change)=>{const records=lines();change(records);writeFileSync(path,records.map(x=>JSON.stringify(x)).join('\n')+'\n');
      assert.notEqual(run(six,path).status,0);};
    refuse(r=>{r[0].lawIds.reverse();});
    refuse(r=>{r[0].shared[0][1]='777';});
    refuse(r=>{r[1].worlds[0][0][0]='77';});
    refuse(r=>{r.pop();});
    refuse(r=>{r[1].lower[0][1]='1/999';});
    refuse(r=>{r[0].lower='0';r[0].status='bounded';});
  }finally{rmSync(dir,{recursive:true,force:true});}
});
