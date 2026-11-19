/** Prospective sequential Gaussian information design over a finite, frozen law set.
 *
 * Unlike fixed maximin sensor schedules, this policy conditions its next
 * timestamp on the measurements ACTUALLY received. The candidate law
 * predictions, declared noise and costs are the only prospective inputs.
 * It does not estimate physical covariance, revise laws, or authorize actuation.
 *
 * For stationary exponential sensor covariance, the next observation is
 * conditionally Gaussian given the last reading. The Markov innovation is
 * exact on an irregular time grid; no dense inverse or synthetic unmeasured
 * positions are used. Mutual information is evaluated by independent,
 * deterministic Gauss-Hermite quadrature of the one-dimensional Gaussian
 * mixture, with two distinct quadrature orders to flag unresolved answers.
 */

export const ADAPTIVE_SENSOR_SCHEMA = 'worldlaw.adaptive-gaussian-sensor/v1';
const requireThat=(ok,why)=>{if(!ok)throw Error(why);};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const LIMIT=20_000_000;

/** Nodes and weights of standard-normal Gauss-Hermite by symmetric Jacobi.
 * Golub-Welsch: multiplication by x in the orthonormal probabilists'
 * Hermite basis has off-diagonal entries sqrt(1),sqrt(2),...,sqrt(n-1).
 * The normalized weights are the squared first components of eigenvectors.
 * Computed once, independently of all predictions or acquired evidence.
 */
function normalQuadrature(n){
  const a=Array.from({length:n},()=>Array(n).fill(0));
  const v=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>Number(i===j)));
  for(let i=0;i<n-1;i++)a[i][i+1]=a[i+1][i]=Math.sqrt(i+1);
  let complete=false;
  for(let iteration=0;iteration<20_000;iteration++){
    let p=0,q=1,maximum=0;
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
      const x=Math.abs(a[i][j]);
      if(x>maximum){maximum=x;p=i;q=j;}
    }
    if(maximum<1e-13){complete=true;break;}
    const app=a[p][p],aqq=a[q][q],apq=a[p][q];
    const ratio=(aqq-app)/(2*apq);
    const t=(ratio<0?-1:1)/(Math.abs(ratio)+Math.sqrt(1+ratio*ratio));
    const c=1/Math.sqrt(1+t*t),s=t*c;
    a[p][p]=app-t*apq;a[q][q]=aqq+t*apq;
    a[p][q]=a[q][p]=0;
    for(let k=0;k<n;k++)if(k!==p&&k!==q){
      const x=a[k][p],y=a[k][q];
      a[k][p]=a[p][k]=c*x-s*y;
      a[k][q]=a[q][k]=s*x+c*y;
    }
    for(let k=0;k<n;k++){
      const x=v[k][p],y=v[k][q];
      v[k][p]=c*x-s*y;v[k][q]=s*x+c*y;
    }
  }
  requireThat(complete,'Fixed Gauss-Hermite matrix did not converge; refuse information ranking.');
  const nodes=Array.from({length:n},(_,i)=>({z:a[i][i],weight:v[0][i]**2}))
    .sort((x,y)=>x.z-y.z);
  const sum=nodes.reduce((s,x)=>s+x.weight,0);
  requireThat(Math.abs(sum-1)<1e-10&&nodes.every(x=>finite(x.z)&&finite(x.weight)&&x.weight>0),
    'Normal quadrature normalization violated.');
  return Object.freeze(nodes.map(x=>Object.freeze(x)));
}
const Q24=normalQuadrature(24);
const Q48=normalQuadrature(48);

function entropy(weights){
  return weights.reduce((h,p)=>p>0?h-p*Math.log(p):h,0);
}
function normalizeLogs(logw){
  const high=Math.max(...logw);
  requireThat(finite(high),'The conditional evidence has no finite likelihood.');
  const unscaled=logw.map(x=>Math.exp(x-high));
  const total=unscaled.reduce((s,x)=>s+x,0);
  requireThat(finite(total)&&total>0,'Conditional law likelihood normalization failed.');
  return unscaled.map(x=>x/total);
}
function pairwiseInformation(weights,means,sd,nodes){
  const q=means.map(m=>(m-means[0])/sd);
  requireThat(q.every(finite),'Standardized forecast separation overflows numeric range.');
  const logw=weights.map(p=>p>0?Math.log(p):-Infinity);
  let info=0,terms=0;
  for(let h=0;h<weights.length;h++)if(weights[h]>0){
    for(const {z,weight}of nodes){
      let highest=-Infinity,partition=0;
      for(let j=0;j<weights.length;j++)if(weights[j]>0){
        const d=z+q[h]-q[j];
        const term=logw[j]-.5*d*d;
        if(term>highest){partition=partition*Math.exp(highest-term)+1;highest=term;}
        else partition+=Math.exp(term-highest);
        terms++;
      }
      requireThat(finite(highest)&&finite(partition)&&partition>0,
        'Gaussian-mixture evidence is numerically unresolved.');
      info+=weights[h]*weight*(-.5*z*z-highest-Math.log(partition));
    }
  }
  return {info,terms};
}

function validate(predictions,options,observations){
  requireThat(Array.isArray(predictions)&&predictions.length>=2&&predictions.length<=16,
    'Sequential Gaussian design requires two to sixteen fixed prospective laws.');
  const first=predictions[0]?.rows;
  requireThat(Array.isArray(first)&&first.length>=2&&first.length<=257,
    'Offer 2 to 257 finite common-grid predictions.');
  const ids=new Set();
  for(const model of predictions){
    requireThat(typeof model.modelId==='string'&&model.modelId.length>0&&!ids.has(model.modelId)&&
      Array.isArray(model.rows)&&model.rows.length===first.length,
      'Prospective laws need unique IDs and identical sample counts.');
    ids.add(model.modelId);
    for(let i=0;i<first.length;i++){
      const row=model.rows[i];
      requireThat(row&&finite(row.time)&&finite(row.position)&&
        row.time===first[i].time&&(i===0||row.time>first[i-1].time),
        'Predictions need finite positions on a strictly increasing shared clock.');
    }
  }
  requireThat(options&&typeof options==='object'&&finite(options.sigma)&&
    options.sigma>=1e-12&&options.sigma<=1e6,
    'Declare a finite positive position-noise sigma.');
  const tau=options.correlationTime??0;
  requireThat(finite(tau)&&tau>=0&&tau<=1e8,
    'Declare nonnegative fixed stationary exponential correlation time.');
  const budget=options.maxReadings??8,decisionThreshold=options.decisionThreshold??.98;
  const timeCost=options.timeCostPerSecond??0;
  const minimumInformation=options.minimumInformationNats??1e-7;
  const workLimit=options.workLimit??LIMIT;
  requireThat(Number.isSafeInteger(budget)&&budget>=1&&budget<=Math.min(32,first.length-1),
    'Sequential reading budget must be between one and 32 and fit the clock.');
  requireThat(finite(decisionThreshold)&&decisionThreshold>.5&&decisionThreshold<1,
    'Conditional stopping threshold must lie strictly between .5 and 1.');
  requireThat(finite(timeCost)&&timeCost>=0&&timeCost<=1e6&&
    finite(minimumInformation)&&minimumInformation>=0&&minimumInformation<=1,
    'Declare finite nonnegative time cost and minimum useful information.');
  requireThat(Number.isSafeInteger(workLimit)&&workLimit>=1&&workLimit<=LIMIT,
    'Sequential quadrature work budget must be a positive integer at most 20 million.');
  const priors=options.priors??predictions.map(()=>1/predictions.length);
  requireThat(Array.isArray(priors)&&priors.length===predictions.length&&
    priors.every(p=>finite(p)&&p>0),'All offered laws need strictly positive finite prior mass.');
  const total=priors.reduce((a,b)=>a+b,0);
  requireThat(finite(total)&&total>0,'The prior law mass is not representable.');
  const normalized=priors.map(p=>p/total);
  requireThat(normalized.every(p=>p>0),'The prior collapsed numerically; use representable weights.');
  requireThat(Array.isArray(observations)&&observations.length<=budget,
    'Retain every earlier acquired observation in original chronological order.');
  let last=0;
  for(const observed of observations){
    requireThat(observed&&Number.isSafeInteger(observed.sampleIndex)&&
      observed.sampleIndex>last&&observed.sampleIndex<first.length&&
      observed.time===first[observed.sampleIndex].time&&finite(observed.position),
      'Acquired positions must be finite, strictly increasing, exact-index sensor records.');
    if(tau>0){
      const gap=(observed.time-(last?first[last].time:observed.time))/tau;
      if(last)requireThat(-Math.expm1(-2*gap)>=1e-12,
        'OU innovation covariance numerically unresolved for acquired spacing.');
    }
    last=observed.sampleIndex;
  }
  return {tau,budget,decisionThreshold,timeCost,minimumInformation,workLimit,normalized};
}

function covarianceStep(tau,previousTime,now,sigma){
  if(previousTime===null||tau===0)return {rho:0,variance:sigma*sigma};
  const gap=(now-previousTime)/tau;
  const rho=Math.exp(-gap),variance=sigma*sigma*(-Math.expm1(-2*gap));
  requireThat(finite(variance)&&variance>0&&
    -Math.expm1(-2*gap)>=1e-12,'OU covariance is numerically unresolved at candidate gap.');
  return {rho,variance};
}

/** Frozen prospective law predictions plus *actual* observed selected readings.
 * The result proposes exactly one not-yet-measured future timestamp. The caller
 * must request it from an independent instrument, append the returned sensor
 * value, and call this function again before another measurement.
 */
export function planAdaptiveGaussianReading(predictions,options,observations=[]){
  const settings=validate(predictions,options,observations),first=predictions[0].rows;
  let weights=settings.normalized;
  let last=null,logw=weights.map(Math.log),used=0;
  const sigma=options.sigma;
  for(const observation of observations){
    const state=covarianceStep(settings.tau,last?.time??null,observation.time,sigma);
    for(let h=0;h<predictions.length;h++){
      const mean=predictions[h].rows[observation.sampleIndex].position+
        (last?state.rho*(last.position-predictions[h].rows[last.sampleIndex].position):0);
      const standardized=(observation.position-mean)/Math.sqrt(state.variance);
      requireThat(finite(standardized)&&finite(standardized*standardized),
        'Acquired residual exceeds representable Gaussian likelihood range.');
      logw[h]-=.5*standardized*standardized;
    }
    weights=normalizeLogs(logw);
    // Log normalization after each measurement prevents underflow during
    // a long sequence; the common omitted Gaussian constant cancels.
    logw=weights.map(p=>p>0?Math.log(p):-Infinity);
    last=observation;
  }
  const currentEntropy=entropy(weights);
  const winning=Math.max(...weights),winner=weights.indexOf(winning);
  const base={schema:ADAPTIVE_SENSOR_SCHEMA,method:'sequential_conditional_ou_expected_information_gain',
    decisionBasis:'only_retained_acquired_readings_and_frozen_prospective_laws',
    covarianceModel:settings.tau>0?'stationary_exponential':'independent_gaussian',
    sigmaRad:sigma,correlationTimeSeconds:settings.tau,
    models:predictions.map((m,i)=>({modelId:m.modelId,conditionalWeight:weights[i]})),
    selectedModelId:predictions[winner].modelId,maximumConditionalWeight:winning,
    posteriorEntropyNats:currentEntropy,priorEntropyNats:entropy(settings.normalized),
    actualReadingCount:observations.length,maximumReadingCount:settings.budget,
    consumedSampleIndices:observations.map(r=>r.sampleIndex),
    unobservedSensorValuesConsumed:0,proposed:null,
    limitations:'Posterior mass is conditional on a finite offered law family, fixed means and declared Gaussian covariance. No physical calibration, model completeness, causal identification or actuator authorization.'};
  if(winning>=settings.decisionThreshold)
    return {...base,status:'conditional_decision_ready',ranking:[],work:{quadratureTerms:0,limit:settings.workLimit}};
  if(observations.length>=settings.budget)
    return {...base,status:'reading_budget_exhausted',ranking:[],work:{quadratureTerms:0,limit:settings.workLimit}};
  const firstFuture=(last?.sampleIndex??0)+1;
  if(firstFuture>=first.length)
    return {...base,status:'future_schedule_exhausted',ranking:[],work:{quadratureTerms:0,limit:settings.workLimit}};
  const ranked=[];
  for(let index=firstFuture;index<first.length;index++){
    const time=first[index].time;
    const state=covarianceStep(settings.tau,last?.time??null,time,sigma);
    const predicted=predictions.map(m=>m.rows[index].position+
      (last?state.rho*(last.position-m.rows[last.sampleIndex].position):0));
    const candidateCost=predictions.length**2*(Q24.length+Q48.length);
    if(used+candidateCost>settings.workLimit)
      return {...base,status:'search_inconclusive_work_limit',ranking:ranked,
        work:{quadratureTerms:used,limit:settings.workLimit,exhausted:true}};
    const low=pairwiseInformation(weights,predicted,Math.sqrt(state.variance),Q24);
    const high=pairwiseInformation(weights,predicted,Math.sqrt(state.variance),Q48);
    used+=low.terms+high.terms;
    const difference=Math.abs(high.info-low.info);
    requireThat(finite(high.info)&&high.info>=-1e-8&&
      high.info<=currentEntropy+1e-8,'Quadrature information violates entropy bounds.');
    ranked.push({sampleIndex:index,time,
      expectedInformationNats:Math.max(0,Math.min(currentEntropy,high.info)),
      quadratureDifferenceNats:difference,
      conditionalStdRad:Math.sqrt(state.variance),
      elapsedSecondsFromLast:time-(last?.time??first[0].time),
      score:Math.max(0,high.info)/(1+settings.timeCost*
        (time-(last?.time??first[0].time)))});
  }
  ranked.sort((a,b)=>b.score-a.score||a.time-b.time||a.sampleIndex-b.sampleIndex);
  const selected=ranked[0];
  const tolerance=options.quadratureToleranceNats??3e-5;
  requireThat(finite(tolerance)&&tolerance>0&&tolerance<=.05,
    'Declared numerical quadrature disagreement tolerance is invalid.');
  if(selected.quadratureDifferenceNats>tolerance)
    return {...base,status:'search_inconclusive_quadrature',ranking:ranked,
      work:{quadratureTerms:used,limit:settings.workLimit,exhausted:false}};
  if(selected.expectedInformationNats<settings.minimumInformation)
    return {...base,status:'no_useful_future_information',ranking:ranked,
      work:{quadratureTerms:used,limit:settings.workLimit,exhausted:false}};
  return {...base,status:'next_reading_proposed',
    proposed:{sampleIndex:selected.sampleIndex,time:selected.time,
      expectedInformationNats:selected.expectedInformationNats,
      selectionScore:selected.score,
      quadratureDifferenceNats:selected.quadratureDifferenceNats,
      conditionalSensorStdRad:selected.conditionalStdRad},
    ranking:ranked,work:{quadratureTerms:used,limit:settings.workLimit,exhausted:false}};
}
