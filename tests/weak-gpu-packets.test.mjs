import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

test('the physical receiver packets reproduce from the canonical nonlinear forward solver',()=>{
  const root=fileURLToPath(new URL('../',import.meta.url));
  const out=mkdtempSync(join(tmpdir(),'worldlaw-weak-fields-'));
  try {
    execFileSync(process.execPath,[join(root,'scripts/weak-gpu-acquisition.mjs'),out]);
    const folder=join(root,'experiments/weak-gpu-course');
    const protocol=JSON.parse(readFileSync(join(folder,'protocol.json')));
    assert.equal(protocol.cases.filter(x=>!x.ood).length,22);
    assert.equal(protocol.cases.filter(x=>x.ood).length,2);
    for(const {name,sha256} of protocol.cases) {
      const file=name+'.f32le.b64', frozen=readFileSync(join(folder,'packets',file));
      assert.deepEqual(readFileSync(join(out,file)),frozen,name);
      assert.equal(createHash('sha256').update(frozen).digest('hex'),sha256,name);
    }
  } finally {rmSync(out,{recursive:true,force:true});}
});
