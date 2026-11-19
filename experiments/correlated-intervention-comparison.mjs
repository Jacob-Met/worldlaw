import {designCorrelatedReadings} from '../src/trajectory/correlated-gaussian-discriminator.mjs';
import {designGaussianReadings} from '../src/trajectory/gaussian-discriminator.mjs';

// Frozen before the first receiving run. Development analytic/unit controls
// use different trajectories and seeds. No outcome-dependent threshold tuning.
export const FROZEN_SEED=0x8d12c54e;
const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return(seed+.5)/4294967296;};
const gaussian=r=>Math.sqrt(-2*Math.log(r()))*Math.cos(2*Math.PI*r());
// Independent dense solve: held-out receiver does not reuse the product's
// innovation likelihood, score accumulation or subset-search implementation.
function correlatedEnergy(d,t,indices,tau){
  const a=indices.map(i=>[...indices.map(j=>Math.exp(-Math.abs(t[i]-t[j])/tau)),d[i]]);
  for(let col=0;col<a.length;col++){
    let pivot=col;for(let row=col+1;row<a.length;row++)if(Math.abs(a[row][col])>Math.abs(a[pivot][col]))pivot=row;
    [a[col],a[pivot]]=[a[pivot],a[col]];
    const scale=a[col][col];if(!(Math.abs(scale)>1e-12))throw Error('Held-out covariance unresolved');
    for(let k=col;k<=a.length;k++)a[col][k]/=scale;
    for(let row=0;row<a.length;row++)if(row!==col){const f=a[row][col];for(let k=col;k<=a.length;k++)a[row][k]-=f*a[col][k];}
  }
  return indices.reduce((sum,i,row)=>sum+d[i]*a[row][a.length],0);
}
export function compareCorrelatedInterventions(){
  const rows=[];
  for(let cohort=0;cohort<4;cohort++)for(let trial=0;trial<32;trial++){
    const r=random((FROZEN_SEED+cohort*104729+trial*7919)>>>0);
    const phase=r()*.6,decay=.05+r()*.2,frequency=1.4+r(),sigma=.025+r()*.025,tau=.15+r()*1.8;
    const times=Array.from({length:13},(_,i)=>i*.12);
    const predictions=Array.from({length:3},(_,m)=>({modelId:`law-${m}`,rows:times.map(time=>({time,
      position:Math.exp(-decay*time)*Math.cos((frequency+.055*m)*time+phase)+
        (cohort===0?.025*m:cohort===1?.025*m*Math.sin(5*time):cohort===2?.025*m*Math.cos(7*time):.015*m*time*time)}))}));
    const options={sigma,targetZ:3.29,maxReadings:4,correlationTime:tau};
    const aware=designCorrelatedReadings(predictions,options),diagonal=designGaussianReadings(predictions,options);
    const selections={aware:aware.readings.map(x=>x.sampleIndex-1),diagonal:diagonal.readings.map(x=>x.sampleIndex-1),
      chronological:[0,1,2,3],spread:[0,3,7,11]};
    const scores={};
    for(const [policy,indices]of Object.entries(selections)){
      let worst=Infinity;
      for(let a=0;a<3;a++)for(let b=a+1;b<3;b++){
        const d=times.slice(1).map((_,i)=>(predictions[a].rows[i+1].position-predictions[b].rows[i+1].position)/sigma);
        worst=Math.min(worst,correlatedEnergy(d,times.slice(1),indices,tau));
      }
      scores[policy]={readings:indices.length,trueCovarianceZ:Math.sqrt(worst),correct:0,total:0};
    }
    // Paired common random realizations at all scheduled times. Policies
    // receive only their selected coordinates; all use the same correct
    // covariance receiver to isolate experimental-design quality.
    for(let realization=0;realization<32;realization++){
      const truth=Math.floor(r()*3),noise=[];
      for(let i=0;i<12;i++){
        const fresh=gaussian(r);
        noise.push(i?Math.exp(-.12/tau)*noise[i-1]+Math.sqrt(-Math.expm1(-.24/tau))*fresh:fresh);
      }
      for(const [policy,indices]of Object.entries(selections)){
        if(!indices.length)continue;
        const ranked=predictions.map((p,m)=>({m,score:correlatedEnergy(times.slice(1).map((_,i)=>
          (predictions[truth].rows[i+1].position+sigma*noise[i]-p.rows[i+1].position)/sigma),times.slice(1),indices,tau)}));
        ranked.sort((a,b)=>a.score-b.score||a.m-b.m);
        scores[policy].correct+=Number(ranked[0].m===truth);scores[policy].total++;
      }
    }
    rows.push({cohort,trial,sigma,tau,status:aware.status,minimum:aware.certifiedMinimumReadings,
      awareWork:aware.work,diagonalClaim:diagonal.status,scores});
  }
  for(const row of rows){
    if(row.status==='distinguishable'&&row.scores.aware.trueCovarianceZ<3.29-1e-9)
      throw Error('Correlated certificate failed the independent held-out dense oracle');
    if(Object.values(row.scores).some(x=>x.readings>4))throw Error('Held-out reading budget exceeded');
  }
  const grouped=Object.fromEntries(['aware','diagonal','chronological','spread'].map(policy=>{
    const scores=rows.map(row=>row.scores[policy]),total=scores.reduce((s,x)=>s+x.total,0),correct=scores.reduce((s,x)=>s+x.correct,0);
    return [policy,{ensembles:rows.length,measuredEnsembles:scores.filter(x=>x.total>0).length,
      correct,total,conditionalAccuracy:total?correct/total:null,
      meanReadingCount:scores.reduce((s,x)=>s+x.readings,0)/rows.length,
      claimedSeparations:policy==='aware'?rows.filter(x=>x.status==='distinguishable').length:
        policy==='diagonal'?rows.filter(x=>x.diagonalClaim==='distinguishable').length:null,
      failedDeclaredSeparations:policy==='aware'?rows.filter(x=>x.status==='distinguishable'&&x.scores.aware.trueCovarianceZ<3.29-1e-9).length:
        policy==='diagonal'?rows.filter(x=>x.diagonalClaim==='distinguishable'&&x.scores.diagonal.trueCovarianceZ<3.29-1e-9).length:null}];
  }));
  return {schema:'worldlaw.correlated-intervention-comparison/v1',seed:FROZEN_SEED,
    scope:'128 authored held-out trajectory ensembles;4096 paired Gaussian realizations. Known covariance and finite offered laws; not measured mechanisms or covariance calibration.',
    targetZ:3.29,maxReadings:4,grouped,rows};
}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href)
  console.log(JSON.stringify(compareCorrelatedInterventions()));
