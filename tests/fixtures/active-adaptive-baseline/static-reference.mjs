/** Frozen best-static catalogue comparator, using shipped 1b53125 pair geometry.
 * Each offered experiment is a complete prescribed readout bundle. The
 * comparator enumerates every nonempty subset of the identical catalogue.
 * Fresh independent nuisance states mean a pair survives a static sequence iff
 * it can survive every selected experiment separately. No repeated action can
 * improve that worst case. It does not claim to search adaptive decision trees.
 */
import {designActiveLinearFamily} from './prior-active-linear-family.mjs';
export function designStaticExperimentCatalogue(request){
  const actions=request.experiments.map(experiment=>{
    const result=designActiveLinearFamily({schema:'worldlaw.active-linear-family/v1',
      source:request.source,hypotheses:request.hypotheses,controls:experiment.controls,
      offeredTicks:experiment.readings.map(r=>r.tick),
      costByTick:Object.fromEntries(experiment.readings.map(r=>[r.tick,r.cost])),
      maxReadings:experiment.readings.length,noiseBound:request.noiseBound,workLimit:50000});
    if(result.exhausted||result.potential.some(pair=>!pair.noiseMarginExact))
      throw Error('Frozen static comparator geometry exhausted');
    return {id:experiment.id,readings:experiment.readings.length,
      cost:experiment.actuationCost+experiment.readings.reduce((sum,row)=>sum+row.cost,0),
      pairs:result.potential,nodes:result.nodes};
  });
  const allPairs=actions[0].pairs.map(p=>p.pair);
  let winner=null,subsets=0;
  for(let mask=1;mask<2**actions.length;mask++){
    subsets++;
    const chosen=actions.filter((_,i)=>mask&(1<<i));
    if(!allPairs.every(id=>chosen.some(a=>a.pairs.some(p=>p.pair===id&&p.robustCertified))))continue;
    const readings=chosen.reduce((sum,a)=>sum+a.readings,0),cost=chosen.reduce((sum,a)=>sum+a.cost,0);
    if(!winner||readings<winner.readings||(readings===winner.readings&&cost<winner.cost))
      winner={readings,cost,experiments:chosen.map(a=>a.id),mask};
  }
  return {schema:'worldlaw.static-experiment-reference/v1',possible:winner!==null,
    selection:winner,pairGeometry:actions.map(a=>({id:a.id,pairs:a.pairs})),
    counters:{subsets,priorCircuitAndScheduleNodes:actions.reduce((sum,a)=>sum+a.nodes,0)}};
}
