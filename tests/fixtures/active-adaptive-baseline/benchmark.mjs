/** Locked cold ABBA stage: identical source catalogue, different policy classes.
 * A static comparator and an adaptive planner need not have equal answers.
 * Report the extra computation together with the guaranteed acquisition budget.
 */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
const [modulePath,mode,casePath,cohort,repetitionsText]=process.argv.slice(2);
if(!['before','after'].includes(mode)||!['anchor','cohort'].includes(cohort))throw Error('explicit mode and cohort required');
const repetitions=Number(repetitionsText);
if(repetitions!==3)throw Error('locked three repetitions');
const api=await import(pathToFileURL(modulePath));
const all=JSON.parse(readFileSync(casePath,'utf8')).cases;
const names=['four_laws_point','four_laws_integrator','four_laws_coupled','five_laws_budget_slack',
  'closed_contact','zero_input','non_helly_pair_graph','one_bundle_suffices',
  'prospective_point_00','prospective_integrator_00','prospective_coupled_00','prospective_different_decay_00'];
const rows=cohort==='anchor'?all.filter(r=>r.id==='four_laws_coupled'):all.filter(r=>names.includes(r.id));
const outcomes=[];
const started=performance.now();
for(let repetition=0;repetition<repetitions;repetition++)for(const row of rows){
  if(mode==='before'){
    const result=api.designStaticExperimentCatalogue(row.request);
    outcomes.push([row.id,result.selection?.readings??null,result.selection?.cost??null]);
  }else{
    const result=api.designActiveLinearAdaptive(row.request);
    if(result.exhausted)throw Error('benchmark adaptive work budget exhausted');
    outcomes.push([row.id,result.worstReadings??null,result.worstCost??null]);
  }
}
const elapsed=performance.now()-started;
process.stdout.write(JSON.stringify({mode,cohort,repetitions,cases:rows.length,elapsedMs:elapsed,
  perRepetitionMs:elapsed/repetitions,maxRSSKiB:process.resourceUsage().maxRSS,
  node:process.version,flags:process.execArgv,outcomes})+'\n');
