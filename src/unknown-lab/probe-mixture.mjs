// Exploratory representatives, not feasible-set certificates or confidence bounds.
import {validateProbeStudy} from './probe-response.mjs';
import {evaluateHistory} from './paired-history.mjs';
import {fitLinearColumns,linearColumnRank} from '../science/linear-fit.mjs';

export const PROBE_MIXTURE_FAMILIES=[
 {id:'offset-rate',labels:['offset N·m','rate N·m·s/rad'],features:p=>[1,p.rate]},
 {id:'offset-sine',labels:['offset N·m','sine N·m'],features:p=>[1,Math.sin(p.position)]},
 {id:'rate-sine',labels:['rate N·m·s/rad','sine N·m'],features:p=>[p.rate,Math.sin(p.position)]},
 {id:'offset-rate-sine',labels:['offset N·m','rate N·m·s/rad','sine N·m'],features:p=>[1,p.rate,Math.sin(p.position)]}
];
export function analyzeProbeMixtures(raw){
 const study=validateProbeStudy(raw);
 const points=study.runs.map(run=>({...run,observed:evaluateHistory(run.notebook)}));
 const training=points.filter(p=>p.role==='training');
 const challenges=points.filter(p=>p.role==='challenge');
 return {source:points[0]?.notebook.source??null,candidates:PROBE_MIXTURE_FAMILIES.map(family=>{
  const base={id:family.id,labels:family.labels};
  if(training.length<=family.labels.length)return {...base,status:'insufficient-training',reason:'Require more training runs than coefficients; an exactly interpolated course cannot screen residuals.'};
  if(training.some(p=>p.observed.order.status!=='counterbalanced'))return {...base,status:'order-confounded'};
  // Equal-weight least squares: inherited screens test residuals, not fit weights.
  const columns=family.labels.map((_,j)=>training.map(p=>family.features(p.probe)[j]));
  const rank=linearColumnRank(columns),fit=fitLinearColumns(columns,training.map(p=>p.observed.decisionDifference));
  if(!fit)return {...base,status:'rank-deficient',rank};
  if(fit.coefficients.some(c=>Math.abs(c)>100))return {...base,rank,coefficients:fit.coefficients,conditionEstimate:fit.conditionEstimate,status:'outside-coefficient-domain',reason:'No forecast: a coefficient exceeds the declared absolute 100 domain.',training:[],challenges:[]};
  const predict=probe=>family.features(probe).reduce((sum,x,j)=>sum+x*fit.coefficients[j],0);
  const score=p=>{
   const prediction=predict(p.probe),residual=p.observed.decisionDifference-prediction;
   return {id:p.id,probe:p.probe,prediction,observed:p.observed.decisionDifference,interval:p.observed.interval,residual,
    status:p.observed.order.status!=='counterbalanced'?'order-confounded':prediction<p.observed.interval[0]||prediction>p.observed.interval[1]?'outside-screen':'within-screen'};
  };
  const trainingScores=training.map(score),challengeScores=challenges.map(score);
  return {...base,rank,coefficients:fit.coefficients,conditionEstimate:fit.conditionEstimate,
   status:trainingScores.some(p=>p.status==='outside-screen')?'training-mismatch':'training-screen-passed',
   training:trainingScores,challenges:challengeScores};
 }),interpretation:'Exploratory equal-weight linear fits of preparation contrasts. Only training chooses coefficients. A failed representative does not prove that every coefficient vector is incompatible. Screens are inherited heuristics, not confidence bounds. Rank is numerical and compatibility does not identify a physical cause.'};
}
