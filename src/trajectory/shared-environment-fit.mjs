/** Complete same-row comparison of declared angular environments. No challenge inputs. */
import {fitLinearColumns, linearColumnRank, RANK_TOLERANCE} from '../science/linear-fit.mjs';
export const ENVIRONMENT_TERMS = Object.freeze(['rate','coulomb','spring','gravity','quadratic','bias']);
export const ENVIRONMENT_MODES = Object.freeze(['pooled','shared-restoring','independent']);
const RESTORING = new Set(['spring','gravity','bias']);
const UNITS = {rate:'1/s',coulomb:'rad/s²',spring:'1/s²',gravity:'rad/s²',quadratic:'1/rad',bias:'rad/s²'};
export class EnvironmentFitError extends Error {
  constructor(message, code='invalid_environment_rows') {super(message);this.name='EnvironmentFitError';this.code=code;}
}
const insist=(ok,message,code)=>{if(!ok)throw new EnvironmentFitError(message,code);};
const identifier=x=>typeof x==='string'&&x.trim().length>0&&x.length<=120;
const validNumber=x=>typeof x==='number'&&Number.isFinite(x);

/** Reserve every candidate before matrix allocation or QR. Also used before preparation QR. */
export function reserveEnvironmentComparison(environmentCount, observationCount, maxReservedWork=100000000) {
  insist(Number.isInteger(environmentCount)&&environmentCount>=2&&environmentCount<=4,'Require 2–4 declared environments.');
  insist(Number.isInteger(observationCount)&&observationCount>0&&observationCount<=2048,'At most 2048 complete weak windows are supported.','resource_limit');
  insist(Number.isSafeInteger(maxReservedWork)&&maxReservedWork>=1&&maxReservedWork<=100000000,'Matrix-work budget must be 1–100000000.','resource_limit');
  const plans=[];
  for(let mask=0;mask<64;mask++){
    const selected=ENVIRONMENT_TERMS.filter((_,j)=>mask&(1<<j));
    if(selected.length>4)continue;
    for(const mode of ENVIRONMENT_MODES){
      const parameters=[];
      for(const term of selected){
        const common=mode==='pooled'||(mode==='shared-restoring'&&RESTORING.has(term));
        if(common)parameters.push({term,environmentIndex:null});
        else for(let environmentIndex=0;environmentIndex<environmentCount;environmentIndex++)parameters.push({term,environmentIndex});
      }
      const k=parameters.length;
      plans.push({mask,selected,mode,parameters,k,declarationIndex:plans.length,reservedWork:observationCount*(1+2*k+2*k*k)});
    }
  }
  const reservedWork=plans.reduce((s,p)=>s+p.reservedWork,0);
  insist(Number.isSafeInteger(reservedWork)&&reservedWork<=maxReservedWork,
    'Complete comparison needs '+reservedWork+' reserved work units; budget is '+maxReservedWork+'. No candidates fitted.','resource_limit');
  return {plans,reservedWork};
}

export function compareAngularEnvironments(environments,{makeAngularModel,maxReservedWork=100000000}={}){
  insist(typeof makeAngularModel==='function','An executable angular-model factory is required.');
  insist(Array.isArray(environments)&&environments.length>=2&&environments.length<=4,'Require 2–4 declared environments.');
  const environmentIds=new Set(),runIds=new Set(),records=[],rowCounts=[];
  for(const [environmentIndex,environment] of environments.entries()){
    insist(environment&&typeof environment==='object','Each environment must be an object.');
    const {id,trainingRunIds,rows}=environment;
    insist(identifier(id)&&!environmentIds.has(id),'Environment IDs must be nonempty and unique.');
    environmentIds.add(id);
    insist(Array.isArray(trainingRunIds)&&trainingRunIds.length>=2,'Each environment needs at least two training runs.');
    insist(runIds.size+trainingRunIds.length<=16,'At most 16 training runs are supported.','resource_limit');
    insist(Array.isArray(rows)&&rows.length>0,'Every environment needs complete weak rows.');
    insist(records.length+rows.length<=2048,'At most 2048 complete weak windows are supported.','resource_limit');
    const localRuns=new Set();
    for(const runId of trainingRunIds){
      insist(identifier(runId)&&!runIds.has(runId),'Training run IDs must be globally unique.');
      runIds.add(runId);localRuns.add(runId);
    }
    const covered=new Set();
    for(const row of rows){
      insist(row&&localRuns.has(row.runId),'Weak row has an undeclared training run.');
      insist(validNumber(row.target)&&Array.isArray(row.columns)&&row.columns.length===6&&
        ENVIRONMENT_TERMS.every((_,j)=>validNumber(row.columns[j])),'Weak rows need finite complete six-term columns.');
      covered.add(row.runId);records.push({environmentIndex,row});
    }
    insist(covered.size===localRuns.size,'Every declared training run must contribute rows.');
    rowCounts.push(rows.length);
  }
  const n=records.length,{plans,reservedWork}=reserveEnvironmentComparison(environments.length,n,maxReservedWork);
  const target=records.map(({row})=>row.target),candidates=[];
  for(const plan of plans){
    const {mask,selected,mode,parameters,k,declarationIndex}=plan;
    const base={id:mode+':'+mask,mode,selectedTerms:selected,observationCount:n,freeParameterCount:k,declarationIndex,reservedWork:plan.reservedWork};
    const columns=parameters.map(p=>{
      const index=ENVIRONMENT_TERMS.indexOf(p.term);
      return records.map(({environmentIndex,row})=>p.environmentIndex===null||p.environmentIndex===environmentIndex?row.columns[index]:0);
    });
    const rank=k===0?0:linearColumnRank(columns);
    if(rank!==k){candidates.push({...base,status:'rank-failure',failureReason:'column-rank-deficient',rank});continue;}
    const fit=k===0?{coefficients:[],conditionEstimate:1}:fitLinearColumns(columns,target);
    if(!fit){candidates.push({...base,status:'rank-failure',failureReason:'fit-returned-null',rank});continue;}
    const coefficients=Array.from(fit.coefficients);
    if(coefficients.length!==k||!coefficients.every(validNumber)){
      candidates.push({...base,status:'nonfinite-fit',failureReason:'nonfinite-coefficients',rank});continue;
    }
    if(coefficients.some(c=>Math.abs(c)>1e18)){
      candidates.push({...base,status:'coefficient-range',failureReason:'coefficient-exceeds-executable-range',rank});continue;
    }
    const environmentSSE=environments.map(()=>0);let sse=0;
    for(let i=0;i<n;i++){
      let prediction=0;for(let j=0;j<k;j++)prediction+=columns[j][i]*coefficients[j];
      const squared=(target[i]-prediction)**2;sse+=squared;environmentSSE[records[i].environmentIndex]+=squared;
    }
    if(!Number.isFinite(sse)){candidates.push({...base,status:'nonfinite-residual',failureReason:'residual-overflow',rank});continue;}
    const weakRMSE=Math.sqrt(sse/n),score=n*Math.log(Math.max(sse/n,0.01**2))+k*Math.log(n);
    const parameterValues=parameters.map((p,j)=>({term:p.term,environmentId:p.environmentIndex===null?null:environments[p.environmentIndex].id,
      coefficient:coefficients[j],coefficientUnit:UNITS[p.term]}));
    const environmentModels=environments.map((environment,index)=>({
      environmentId:environment.id,weakRMSE:Math.sqrt(environmentSSE[index]/rowCounts[index]),
      model:makeAngularModel({candidateId:base.id,environmentId:environment.id,
        terms:parameterValues.filter(p=>p.environmentId===null||p.environmentId===environment.id).map(p=>({id:p.term,coefficient:p.coefficient,coefficientUnit:p.coefficientUnit}))})
    }));
    candidates.push({...base,status:'fitted',rank,conditionEstimate:fit.conditionEstimate,weakRMSE,sse,score,parameterValues,environmentModels});
  }
  const ranked=candidates.filter(c=>c.status==='fitted').sort((a,b)=>a.score-b.score||a.declarationIndex-b.declarationIndex);
  const bestByMode=Object.fromEntries(ENVIRONMENT_MODES.map(mode=>[mode,ranked.find(c=>c.mode===mode)?.id??null]));
  return {
    schema:'worldlaw.environment-comparison/v1',
    protocol:{terms:[...ENVIRONMENT_TERMS],modes:[...ENVIRONMENT_MODES],noiseFloor:0.01,noiseFloorUnits:'rad',
      score:'n*log(max(weakRMSE^2,noiseFloor^2))+k*log(n)',scoreMeaning:'overlapping-window heuristic, not calibrated model probability',
      weighting:'each complete weak row contributes once',rankTolerance:RANK_TOLERANCE,challengeUsed:false,absoluteTorqueIdentified:false},
    observationCount:n,trainingRunCount:runIds.size,reservedWork,candidateCount:candidates.length,
    rankedCandidateIds:ranked.map(c=>c.id),selectedCandidateId:ranked[0]?.id??null,bestByMode,
    tiedMinimumCandidateIds:ranked.filter(c=>c.score===ranked[0]?.score).map(c=>c.id),
    competitiveCandidateIds:ranked.filter(c=>c.score-ranked[0].score<=6).map(c=>c.id),
    candidates
  };
}
