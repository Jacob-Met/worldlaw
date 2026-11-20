/** Locked ABBA entry point. Both algorithms receive identical full requests. */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
const [modulePath,mode,casePath,cohort,repetitionsText]=process.argv.slice(2);
if(!['before','after'].includes(mode)||!['anchor','cohort'].includes(cohort))throw Error('explicit mode and cohort required');
const repetitions=Number(repetitionsText);
if(repetitions!==3)throw Error('locked three repetitions');
const api=await import(pathToFileURL(modulePath));
const all=JSON.parse(readFileSync(casePath,'utf8'));
const names=['interior_three_laws','closed_contact','incompatible_pairwise_maxima','positive_half',
  'negative_half','fixed_collapse','integrator_cost_schedule','coupled_minimum_union',
  'coupled_insufficient_budget','different_latent_dynamics','heldout_00','heldout_01'];
const rows=cohort==='anchor'?all.filter(r=>r.name==='coupled_minimum_union'):all.filter(r=>names.includes(r.name));
const digest=[];let work=0;
const started=performance.now();
for(let repeat=0;repeat<repetitions;repeat++)for(const row of rows){
  if(mode==='before'){
    const result=api.exhaustiveJointReference(row.request);work+=result.counters.vertices;
    digest.push([row.name,result.potential,result.selection,result.cost,result.margin]);
  }else{
    const plan=api.designActiveLinearJointControl(row.request);if(plan.exhausted)throw Error('benchmark candidate exhausted');
    work+=plan.nodes;
    digest.push([row.name,plan.jointPotential.margin,plan.selection?.map(r=>r.tick)??null,plan.totalCost,
      plan.jointProof?.margin??null]);
  }
}
const elapsed=performance.now()-started;
process.stdout.write(JSON.stringify({mode,cohort,repetitions,cases:rows.length,elapsedMs:elapsed,
  perRepetitionMs:elapsed/repetitions,maxRSSKiB:process.resourceUsage().maxRSS,
  workPerRepetition:work/repetitions,node:process.version,flags:process.execArgv,digest})+'\n');
