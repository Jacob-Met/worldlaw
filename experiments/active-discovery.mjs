/** Reproducible experimental comparison. Truth is independent of inference code. */
import {discover, planExperiment, revise, evaluate} from '../src/science/torque-discovery.mjs';

function randomSource(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}
const options = {noiseSigma:0.008, maxTerms:4, ambiguityDelta:6};
const pool = Array.from({length:49},(_,i)=>({command:0,position:-2.4+i*0.1,rate:0}));
const cases = [];
for (const family of ['linear_spring','sinusoidal_gravity']) {
  for (let seed=1; seed<=20; seed++) {
    const random = randomSource(7919*seed);
    const coefficients = {drive:.8+random()*1.5,drag:.1+random()*.3,restoring:1.2+random()*1.8,bias:(random()-.5)*.2};
    const torque = row => coefficients.drive*row.command-coefficients.drag*row.rate-
      coefficients.restoring*(family==='linear_spring'?row.position:Math.sin(row.position))+coefficients.bias;
    const measure = row => ({...row,jointTorque:torque(row)+(random()-.5)*.004});
    const fitRows = Array.from({length:64},()=>measure({command:(random()-.5)*1.2,position:(random()-.5)*.24,rate:(random()-.5)*1.4}));
    const before = discover(fitRows,options);
    const plan = planExperiment(before,pool);
    const active = revise(before,[measure(plan.selected.input)]);
    const passive = revise(before,[measure({command:0,position:.05,rate:0})]);
    // Evaluation uses new deterministic conditions and noise-free oracle targets.
    // Neither fitting nor acquisition has access to this array.
    const evaluationRandom = randomSource(104729*seed);
    const heldOut = Array.from({length:100},()=>{
      const row={command:(evaluationRandom()-.5)*1.4,position:(evaluationRandom()-.5)*4.7,rate:(evaluationRandom()-.5)*1.8};
      return {...row,jointTorque:torque(row)};
    });
    const expectedRestoringTerm = family==='linear_spring'?'spring':'gravity';
    const hasCorrectStructure = discovery => {
      const actual=discovery.selected.terms.map(term=>term.id);
      return actual.length===4 && ['command','rate',expectedRestoringTerm,'bias'].every(term=>actual.includes(term));
    };
    cases.push({family,seed,coefficients,initialModel:before.selected.id,activeModel:active.selected.id,passiveModel:passive.selected.id,
      initialAmbiguous:before.diagnostics.selectionAmbiguous,planStatus:plan.status,chosenInput:plan.selected.input,
      predictionSpread:plan.selected.disagreement,initialHeldOutRmse:evaluate(before.selected,heldOut).rmse,
      activeHeldOutRmse:evaluate(active.selected,heldOut).rmse,passiveHeldOutRmse:evaluate(passive.selected,heldOut).rmse,
      activeCorrectStructure:hasCorrectStructure(active),passiveCorrectStructure:hasCorrectStructure(passive)});
  }
}
const median = values => {
  const sorted=[...values].sort((a,b)=>a-b), middle=Math.floor(sorted.length/2);
  return sorted.length%2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
};
const summaries=['linear_spring','sinusoidal_gravity'].map(family=>{
  const subset=cases.filter(row=>row.family===family);
  return {family,count:subset.length,activeCorrect:subset.filter(row=>row.activeCorrectStructure).length,
    passiveCorrect:subset.filter(row=>row.passiveCorrectStructure).length,
    activeBeatsPassive:subset.filter(row=>row.activeHeldOutRmse<row.passiveHeldOutRmse).length,
    medianInitialRmse:median(subset.map(row=>row.initialHeldOutRmse)),
    medianActiveRmse:median(subset.map(row=>row.activeHeldOutRmse)),
    medianPassiveRmse:median(subset.map(row=>row.passiveHeldOutRmse))};
});
console.log(JSON.stringify({schema:'worldlaw.active-discovery-experiment/v1',evidence:'controlled_synthetic',
  runtime:process.version,options,method:'One maximum-disagreement observation versus one fixed narrow-angle observation; independent held-out conditions; 20 varied coefficients/noise seeds per family.',
  limitations:['Two in-library families, not arbitrary mechanisms.','Noise is additive and inputs are exact.','No calibration or real apparatus evidence.','Acquisition only varies position in a permitted finite grid.'],
  summaries,cases},null,2));
