import test from 'node:test';
import assert from 'node:assert/strict';
import {openCaseEightSixPulseAdversary as open} from '../src/science/position-drift-terminal-feedback.mjs';

const expectedRows=[[-2,-2,5],[1,-2,6],[-1,-4,0],[6,7,-3]];
function ratio(value){const [n,d='1']=value.split('/');return [BigInt(n),BigInt(d)];}
function independentReplay(record){
  assert.ok(new Set(record.witnesses.map(w=>w.law)).size>=2);
  for(const {law,start} of record.witnesses){
    const rates=expectedRows[Number(law.slice(1))];
    const [p,d]=ratio(start[0]),[v,f]=ratio(start[1]);
    let forcing=0n;
    record.readings.forEach((reading,t)=>{
      if(t)forcing+=BigInt(rates[Number(record.commands[t-1].slice(1))]);
      const [y,g]=ratio(reading),denom=d*f*g;
      const residual=(p*f+BigInt(t)*v*d+forcing*d*f)*g-y*d*f;
      assert.ok(residual>=-denom && residual<=denom);
    });
  }
}

test('one nonanticipating strategy physically collides on all 729 words and every early stop',()=>{
  const byPrefix=new Map(),changed=[];
  for(let ordinal=0;ordinal<729;ordinal++){
    let digits=ordinal;
    const game=open();assert.equal(game.initialReading,'0');
    for(let t=0;t<=6;t++){
      const record=game.certificate(),key=record.commands.join(',');
      independentReplay(record);
      if(byPrefix.has(key))assert.deepEqual(record.readings,byPrefix.get(key));
      else byPrefix.set(key,record.readings);
      if(t<6){game.pulse('u'+digits%3);digits=Math.floor(digits/3);}
      else if(record.terminalRule==='terminal-collision'){
        assert.deepEqual(record.witnesses.map(w=>w.law),['L1','L2']);changed.push(key);
      }
    }
    assert.throws(()=>game.pulse('u0'),/six-pulse/);
  }
  assert.equal(byPrefix.size,1093);
  assert.deepEqual(changed.sort(),['u0,u0,u0,u1,u1,u1','u1,u1,u1,u0,u0,u0']);
});
