import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';

const receiver='scripts/verify-five-pulse-global.py';
const source='examples/active-position-drift-five-pulse-minimum.json';
const certificate='examples/active-position-drift-five-pulse-global-certificate.json';
const history=['ref','ref','group','x1','y1'];
function run(src,packet,word){
  return spawnSync('python3',[receiver,src,packet,'--history',JSON.stringify(word)],{encoding:'utf8'});
}
test('all five-pulse ancestral trees have matching exact upper and lower certificates',()=>{
  const result=run(source,certificate,history);
  assert.equal(result.status,0,result.stderr);
  const proof=JSON.parse(result.stdout);
  assert.equal(proof.unrestrictedFiveRadius,'1/29');
  assert.deepEqual(proof.bestPrefixes,[['ref','ref']]);
  assert.equal(proof.physicalWorlds,65536);
  assert.equal(proof.prefixRadii.length,64);
  assert.equal(proof.prefixRadii.filter(p=>p.radius==='0').length,3);
  assert.equal(proof.prefixRadii.find(p=>p.prefix.join(',')==='group,ref').radius,'1/31');
  assert.deepEqual(proof.boundaryHistory.readings,['0','0','0','14/29','21/29','24/29']);
  assert.deepEqual(proof.boundaryHistory.worlds.map(x=>x.law),['A','B']);
});

function changedFixture(){
  const catalog={commands:['a','b'],laws:[{id:'zero',vertices:[[0,0]]},{id:'shift',vertices:[['1/7','1/7']]}]};
  const records=[];
  for(let a=0;a<2;a++)for(let b=0;b<2;b++){
    const seen=new Set(),worlds=[];
    for(let i=0;i<8;i++){
      const word=[a,b,(i>>2)&1,(i>>1)&1,i&1];
      for(let t=2;t<=5;t++){
        const key=word.slice(0,t).join(',');
        if(!seen.has(key)){seen.add(key);worlds.push('0');}
      }
      worlds.push('0','0','0','-1/7');
    }
    records.push({p:[a,b],r:'0',worlds,lower:[[1,'1/2'],[2,'1/2']]});
  }
  return {catalog,records};
}

test('a changed constant-offset catalog retains closed zero-noise contact and rejects altered proofs',()=>{
  const dir=mkdtempSync(join(tmpdir(),'five-complete-'));
  try{
    const src=join(dir,'source.json'),file=join(dir,'packet.json'),word=['a','b','b','a','b'];
    const {catalog,records}=changedFixture();
    const {schema,encoding}=JSON.parse(readFileSync(certificate,'utf8'));
    const save=()=>writeFileSync(file,JSON.stringify({schema,encoding,catalog,prefixes:records.map(
      r=>gzipSync(JSON.stringify(r)).toString('base64'))}));
    writeFileSync(src,JSON.stringify({catalog}));save();
    const good=run(src,file,word);
    assert.equal(good.status,0,good.stderr);
    const proof=JSON.parse(good.stdout);
    assert.equal(proof.unrestrictedFiveRadius,'0');
    assert.deepEqual(proof.boundaryHistory.worlds.map(w=>w.drift),['0','-1/7']);
    records[0].worlds[0]='1';save();assert.notEqual(run(src,file,word).status,0);
    records[0].worlds[0]='0';records[0].lower[0][1]='1/3';save();
    assert.match(run(src,file,word).stderr,/lower combination/);
    records.pop();save();assert.match(run(src,file,word).stderr,/incomplete prospective prefix cover/);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
