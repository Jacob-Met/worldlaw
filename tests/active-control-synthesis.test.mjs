import test from 'node:test';
import assert from 'node:assert/strict';
import {
  synthesizeSparseExcitation,replaySparseExcitation,ACTIVE_SPARSE_SYNTHESIS_SCHEMA
} from '../src/science/active-control-synthesis.mjs';
import {designActiveLinearFamily,ACTIVE_LINEAR_FAMILY_SCHEMA}
  from '../src/science/active-linear-family.mjs';

function threeLaw(){
  return {
    schema:ACTIVE_SPARSE_SYNTHESIS_SCHEMA,
    source:'Predeclared synthetic three-way actuator gain model; no real physics or outcomes are acquired',
    hypotheses:[
      {id:'none',A:[[0]],B:[[0,0]],C:[1]},
      {id:'red',A:[[0]],B:[[1,0]],C:[1]},
      {id:'blue',A:[[0]],B:[[0,1]],C:[1]},
    ],
    controlHorizon:2,inputChannels:2,
    amplitudes:['1','-1'],
    offeredTicks:[0,1,2],maxReadings:3,maxPulses:2,
    noiseBound:'1/100',pulseCost:2,
    maxCourses:500,maxCombinations:2000,maxWorkNodes:100000,
  };
}
function kinematics(){
  return {
    schema:ACTIVE_SPARSE_SYNTHESIS_SCHEMA,
    source:'Synthetic position velocity kinematics with different acceleration coupling, source-only',
    hypotheses:[
      {id:'gain_one',A:[[1,1],[0,1]],B:[[0],[1]],C:[1,0]},
      {id:'gain_two',A:[[1,2],[0,1]],B:[[0],[1]],C:[1,0]},
    ],
    controlHorizon:4,inputChannels:1,
    amplitudes:['1','-1'],
    offeredTicks:[0,1,2,3,4],maxReadings:5,maxPulses:2,
    noiseBound:'1/100',pulseCost:1,
    maxCourses:500,maxCombinations:2000,maxWorkNodes:100000,
  };
}
test('synthesizes two indispensable independent actuator pulses without a handcrafted course menu',()=>{
  const source=threeLaw();
  const result=synthesizeSparseExcitation(source);
  assert.equal(result.status,'optimal_certified_sparse_course');
  assert.equal(result.pulseCount,2);
  assert.equal(result.numReadings,1);
  assert.equal(result.totalDeclaredCost,5);
  assert.equal(result.pairProof.length,3);
  assert.ok(result.pairProof.every(p=>p.robustCertified));
  assert.equal(result.rankSpan.pairCount,3);
  assert.equal(result.rankSpan.impossiblePairs.length,0);
  assert.ok(result.combinationsPruned>0);
  assert.equal(result.physicalActionsPerformed,false);
  assert.equal(result.measuredOutcomesUsed,false);
  assert.equal(replaySparseExcitation(source,result).valid,true);
  const actual=source.hypotheses.map(h=>{
    const controls=result.chosenControls;
    let x=17;
    const y=[];
    for(let t=0;t<=controls.length;t++){
      y.push(x);
      if(t<controls.length)
        x=h.B[0].reduce((sum,v,j)=>sum+v*Number(controls[t][j]),0);
    }
    return result.chosenReadings.map(({tick})=>y[tick]).join(',');
  });
  assert.equal(new Set(actual).size,3,'observations independently classify each of the three known source models');
});
test('compiles a 2D hidden-position and hidden-velocity physical-input witness without menu enumeration',()=>{
  const r=synthesizeSparseExcitation(kinematics());
  assert.equal(r.status,'optimal_certified_sparse_course');
  assert.equal(r.pulseCount,1);
  assert.equal(r.numReadings,3);
  assert.equal(r.totalDeclaredCost,4);
  assert.equal(r.rankSpan.pairCount,1);
  const p=r.chosenPulses[0],tick=p.tick,u=Number(p.amplitude);
  for(const x of [-9,-3,0,7,28])for(const v of [-10,0,2,5,13]){
    function projection(k){
      let state=[x,v],trace=[];
      for(let t=0;t<=4;t++){
        trace.push(state[0]);
        if(t<4){
          const pulse=t===tick?u:0;
          state=[state[0]+k*state[1],state[1]+pulse];
        }
      }
      const rows=r.chosenReadings.map(row=>trace[row.tick]);
      const w=r.pairProof[0].witness.weights.map(q=>{
        const [n,d]=q.split('/');return Number(n)/Number(d??1);
      });
      return rows.reduce((s,y,i)=>s+w[i]*y,0);
    }
    const k1=projection(1),k2=projection(2);
    const gap=Number(r.pairProof[0].witness.signedGap.split('/')[0])/
      Number(r.pairProof[0].witness.signedGap.split('/')[1]??1);
    assert.ok(Math.abs(Math.abs(k2-k1)-Math.abs(gap))<1e-8,
      'unknown 2D source latent state leaked into the exact dual projection');
  }
});
test('independently verify all source-declared 1-pulse controls cannot separate 3 law pairs',()=>{
  const source=threeLaw();
  const report=synthesizeSparseExcitation(source);
  assert.equal(report.pulseCount,2);
  for(let j=0;j<source.controlHorizon*source.inputChannels;j++){
    for(const amp of source.amplitudes){
      const controls=Array.from({length:source.controlHorizon},
        ()=>Array(source.inputChannels).fill(0));
      controls[Math.floor(j/source.inputChannels)][j%source.inputChannels]=amp;
      const result=designActiveLinearFamily({
        schema:ACTIVE_LINEAR_FAMILY_SCHEMA,
        source:source.source,hypotheses:source.hypotheses,controls,
        offeredTicks:source.offeredTicks,
        maxReadings:source.maxReadings,noiseBound:source.noiseBound
      });
      assert.ok(result.potential.some(p=>!p.structural),
        'independent one-action exhaustive oracle detected unaccounted feasible control');
    }
  }
});
test('proves any real-valued control impossible for an exact pair whose forced response is absorbed by unknown state',()=>{
  const x=kinematics();
  x.hypotheses[1].A=[[1,1],[0,1]];
  const result=synthesizeSparseExcitation(x);
  assert.equal(result.status,'structurally_indistinguishable_for_every_input_on_offered_course');
  assert.equal(result.rankSpan.impossiblePairs.length,1);
  assert.equal(result.rankSpan.perPair[0].identifyingUnitPulsePositions.length,0);
  assert.equal(result.coursesEvaluated,0);
  assert.equal(result.chosenControls,null);
});
test('a bounded search does not transform one successful guess into false global optimality',()=>{
  const x=threeLaw();
  x.maxCourses=1;
  const r=synthesizeSparseExcitation(x);
  assert.equal(r.status,'candidate_uncertified');
  assert.equal(r.exhausted,true);
  assert.equal(r.coursesEvaluated,1);
  assert.ok(r.chosenControls);
  const y=threeLaw();y.maxCombinations=1;
  const stopped=synthesizeSparseExcitation(y);
  assert.equal(stopped.status,'search_inconclusive');
  assert.equal(stopped.exhausted,true);
});
test('wrong source bytes, changed alphabet and forged certificate fail exact replay',()=>{
  const x=threeLaw(),r=synthesizeSparseExcitation(x);
  const changed=structuredClone(x);changed.hypotheses[1].B[0][0]=2;
  assert.throws(()=>replaySparseExcitation(changed,r),/source or exact sparse control certificate changed/);
  const forged=structuredClone(r);forged.pairProof[0].witness.signedGap='9999';
  assert.throws(()=>replaySparseExcitation(x,forged),/source or exact sparse control certificate changed/);
  const irrelevant=structuredClone(x);
  irrelevant.futureOutcomes=[1,2,3];irrelevant.revealedTrueLaw='red';
  assert.deepEqual(synthesizeSparseExcitation(irrelevant),r,
    'prospective control design must not read outcomes or actual labels');
});
test('source parser rejects irrational approximations, duplicated amplitude and exploding search knobs',()=>{
  for(const mutate of [
    x=>x.amplitudes=['1','1/1'],
    x=>x.amplitudes=['0'],
    x=>x.amplitudes=['0.1'],
    x=>x.amplitudes=['1/0'],
    x=>x.controlHorizon=100,
    x=>x.inputChannels=5,
    x=>x.maxPulses=9,
    x=>x.maxCourses=1000000,
    x=>x.maxCombinations=0,
    x=>x.maxWorkNodes=1,
    x=>x.hypotheses[0].B=[[0]],
  ]){
    const x=threeLaw();mutate(x);
    assert.throws(()=>synthesizeSparseExcitation(x),/(Sparse excitation synthesis|Active linear family):/);
  }
});
