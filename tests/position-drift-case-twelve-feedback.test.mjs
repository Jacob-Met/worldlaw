import test from 'node:test';
import assert from 'node:assert/strict';
import {planCaseTwelveOneFeedback as plan,openCaseTwelveOneFeedback as open} from '../src/science/position-drift-case-twelve-feedback.mjs';

const rows=[[-1,6,4],[-4,2,8],[-8,2,-2]];
const law=id=>Number(id.slice(1));
test('all 54 joint-prefix assignments yield exact integer contradictions with three private final readings',()=>{
  for(const first of ['u0','u1']){
    const p=plan(first),seen=new Set(),used=[0,0,0];
    for(const {pairs,certificate} of p.assignments){
      assert.equal(pairs.length,3);seen.add(JSON.stringify(pairs));used[certificate]++;
      const proof=p.certificates[certificate],u=proof.last===null?null:Number(proof.last.slice(1));
      // Columns are y0..y5 shared; y6(u0), y6(u1), y6(u2) are distinct.
      const sum=Array(9).fill(0);
      let rhs=0;
      for(const [j,id] of proof.laws.entries()){
        assert.ok(u===null?pairs.some(pair=>pair.includes(id)):pairs[u].includes(id));
        const commands=u===null?p.prefix:[...p.prefix,proof.last];
        let f=0;
        const forcing=[0,...commands.map(c=>f+=rows[law(id)][Number(c.slice(1))])];
        const [a,b,c]=proof.ticks,weights=[c-b,a-c,b-a];
        const realCenter=proof.ticks.reduce((v,t,i)=>v+weights[i]*forcing[t],0);
        assert.equal(realCenter,Number(proof.centers[j]));
        const sign=(j===0?1:-1)*Math.sign(Number(proof.centers[1])-Number(proof.centers[0]));
        proof.ticks.forEach((t,i)=>{
          if(t===6)assert.notEqual(u,null);
          sum[t===6?6+u:t]+=sign*weights[i];
        });
        rhs+=2*(c-a)+sign*realCenter;
      }
      assert.deepEqual(sum,Array(9).fill(0));assert.equal(rhs,-Number(proof.margin));assert.ok(rhs<0);
    }
    assert.equal(seen.size,27);assert.deepEqual(used,[25,1,1]);
    assert.deepEqual(p.certificates.map(c=>c.margin),first==='u0'?['4','13','3']:['4','14','3']);
  }
});

test('the measured-state receiver determines the sixth action before seeing its reading',()=>{
  const den=13n,origin=10n**53n+2n,drift=-11n;
  for(const first of ['u0','u1']){
    const p=plan(first),exp=open(first,p),commandsSeen=new Set();
    for(let k=0;k<rows.length;k++)for(let mask=0;mask<128;mask++){
      let pos=origin;
      const reading=t=>String(pos+((mask>>t)&1?den:-den))+'/'+den;
      const values=[reading(0)];
      for(let t=0;t<5;t++){
        const command=p.prefix[t];
        pos+=drift+den*BigInt(rows[k][Number(command.slice(1))]);values.push(reading(t+1));
      }
      const before=exp.receive(values);assert.ok(before.witnesses.some(w=>law(w.law)===k));
      commandsSeen.add(before.nextCommand);
      pos+=drift+den*BigInt(rows[k][Number(before.nextCommand.slice(1))]);values.push(reading(6));
      const actual=exp.receive(values);
      assert.equal(actual.commands.at(-1),before.nextCommand);
      assert.deepEqual(actual.witnesses.map(w=>law(w.law)),[k]);
    }
    assert.deepEqual([...commandsSeen].sort(),[p.prefix.at(-1),'u2'].sort());
    assert.throws(()=>open(first,{...p,assignments:[]}),/saved plan/);
    assert.deepEqual(exp.receive(['0','0','999999','0','0','0']).witnesses,[]);
    assert.throws(()=>exp.receive(['0','0','999999','0','0','0','0']),/inconsistent/);
  }
});
