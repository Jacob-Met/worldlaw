/** Execute the fixed comparison from source bundles, retaining every candidate and forecast. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {compareSharedEnvironments,evaluateSharedEnvironments} from '../src/trajectory/shared-environments.mjs';
const [trainingPath,outputPath,challengePath]=process.argv.slice(2);
if(!trainingPath||!outputPath)throw Error('Usage: node scripts/receive-shared-environments.mjs TRAINING.json OUTPUT_DIRECTORY [CHALLENGE.json]');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const output=resolve(outputPath);mkdirSync(output,{recursive:true});
const trainingBytes=readFileSync(trainingPath),comparison=compareSharedEnvironments(JSON.parse(trainingBytes));
const trainingCourse=evaluateSharedEnvironments(comparison);
const challengeBytes=challengePath?readFileSync(challengePath):null;
const challengeCourse=challengeBytes?evaluateSharedEnvironments(comparison,JSON.parse(challengeBytes)):null;
function write(name,value){const raw=JSON.stringify(value,null,2)+'\n';writeFileSync(resolve(output,name),raw);return hash(raw);}
const artifacts={comparison:write('comparison.json',comparison),trainingCourse:write('training-course.json',trainingCourse),
  ...(challengeCourse?{challengeCourse:write('challenge-course.json',challengeCourse)}:{})};
const summary={schema:'worldlaw.environment-receiving/v1',runtime:process.version,
  trainingSourceSHA256:hash(trainingBytes),challengeSourceSHA256:challengeBytes?hash(challengeBytes):null,
  protocol:comparison.implementationProtocol,trainingWindows:comparison.observationCount,candidateCount:comparison.candidateCount,
  fittedCount:comparison.candidates.filter(c=>c.status==='fitted').length,selectedCandidateId:comparison.selectedCandidateId,
  competitiveCandidateIds:comparison.competitiveCandidateIds,
  best:Object.entries(comparison.bestByMode).map(([mode,id])=>{
    const c=comparison.candidates.find(c=>c.id===id);
    return {mode,id,status:c.status,terms:c.selectedTerms,freeParameterCount:c.freeParameterCount,
      score:c.score,weakRMSE:c.weakRMSE,conditionEstimate:c.conditionEstimate,parameters:c.parameterValues};
  }),
  courses:[trainingCourse,...(challengeCourse?[challengeCourse]:[])].map(course=>({role:course.role,reservedIntegrationSteps:course.reservedSteps,
    runs:course.runs.map(entry=>({environmentId:entry.environmentId,runId:entry.run.id,forecasts:entry.forecasts.map(f=>({
      mode:f.mode,candidateId:f.candidateId,status:f.status,metrics:f.rollout?.metrics,failureReason:f.failureReason,refinement:f.refinement
    }))}))})),artifacts};
write('receiving.json',summary);
console.log(JSON.stringify(summary,null,2));
