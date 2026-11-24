// An independent assay of an already chosen model. Only prefix states and the
// supplied input schedule enter integration; the later observations enter tests.
import {prepareStateTrajectory,forecastStateTrajectory,validateStateTrajectory} from './state-trajectory.mjs';

function randomizer(seed){
  let s=seed>>>0;
  return ()=>{s ^= s<<13; s ^= s>>>17; s ^= s<<5; return (s>>>0)/4294967296;};
}
function shuffle(order,random){
  for(let i=order.length-1;i>0;i--){
    const j=Math.floor(random()*(i+1));
    [order[i],order[j]]=[order[j],order[i]];
  }
}
function centered(rows){
  const d=rows[0].length,mean=new Float64Array(d);
  for(const row of rows)for(let j=0;j<d;j++)mean[j]+=row[j]/rows.length;
  return rows.map(row=>Float64Array.from(row,(v,j)=>v-mean[j]));
}
function alignment(observed,prediction){
  const y=centered(observed), p=centered(prediction),n=y.length,d=y[0].length;
  let original=0,exceed=0;
  for(let lag=0;lag<n;lag++){
    let dot=0;
    for(let t=0;t<n;t++){const a=p[t],b=y[(t+lag)%n];for(let j=0;j<d;j++)dot+=a[j]*b[j];}
    if(lag===0)original=dot;
    if(dot>=original)exceed++;
  }
  return {p:exceed/n,exceed,total:n};
}
function blockStructure(observed,prediction){
  const size=Math.floor(observed.length/8),n=size*8,d=observed[0].length;
  const residual=centered(observed.slice(0,n).map((row,i)=>row.map((v,j)=>v-prediction[i][j])));
  function statistic(order){
    let result=0;
    for(let block=0;block<8;block++){
      const sums=new Float64Array(d);
      for(let k=0;k<size;k++){const row=residual[order[block*size+k]];for(let j=0;j<d;j++)sums[j]+=row[j];}
      for(let j=0;j<d;j++)result+=sums[j]*sums[j];
    }
    return result;
  }
  const order=Array.from({length:n},(_,i)=>i), observedScore=statistic(order),random=randomizer(17890357);
  let exceed=1;
  for(let i=0;i<255;i++){shuffle(order,random);if(statistic(order)>=observedScore)exceed++;}
  return {p:exceed/256,exceed,total:256,used:n};
}
export function shrinkPeriodicPrefix(initial,rows) {
  const n=initial.length;
  if(n<6||n>128||rows.length!==11)throw RangeError('Require eleven periodic prefix observations');
  const differences=[];
  for(let t=1;t<10;t++)for(let j=0;j<n;j++){
    differences.push(Math.abs(rows[t-1].state[j]-2*rows[t].state[j]+rows[t+1].state[j]));
  }
  differences.sort((a,b)=>a-b);
  const sigma=differences[Math.floor(differences.length/2)]/(.6744897501960817*Math.sqrt(6));
  const variance=sigma*sigma*113/143;
  const mean=initial.reduce((a,b)=>a+b,0)/n, result=Array(n).fill(mean);
  for(let k=1;k<=Math.floor(n/2);k++){
    const singleton=2*k===n, factor=singleton?1/n:2/n;
    const cos=Array.from({length:n},(_,j)=>Math.cos(2*Math.PI*k*j/n));
    const sin=singleton?Array(n).fill(0):Array.from({length:n},(_,j)=>Math.sin(2*Math.PI*k*j/n));
    let re=0,im=0;
    for(let j=0;j<n;j++){re+=initial[j]*cos[j]*factor;im+=initial[j]*sin[j]*factor;}
    const power=re*re+im*im,noise=(singleton?1:4)*variance/n;
    const weight=power>noise?1-noise/power:0;
    for(let j=0;j<n;j++)result[j]+=weight*(re*cos[j]+im*sin[j]);
  }
  return result;
}

export function prefixForecast(model,observation,shrink=false) {
  const {length}=validateStateTrajectory(observation), points=11;
  if(length<points+1)throw RangeError('Short prefix');
  if(shrink&&observation.kind!=='periodic')throw RangeError('Shrinkage requires a periodic field');
  const sanitized={...observation,samples:observation.samples.map((row,i)=>i<points?row:
    {...row,state:observation.samples[points-1].state})};
  const prepared=prepareStateTrajectory(sanitized,points);
  if(shrink) prepared.initial=shrinkPeriodicPrefix(prepared.initial,sanitized.samples.slice(0,points));
  const {status,states,startIndex,reason}=forecastStateTrajectory(model,sanitized,{prepared,smoothingPoints:points});
  return {status,states,startIndex,reason};
}

export function independentTemporalEvidence(model,observation){
  const {n,length}=validateStateTrajectory(observation),points=11;
  if(length<211||length>1025||n*(length-points)**2>5500000)throw RangeError('Independent evidence work bound exceeded or insufficient temporal resolution');
  const result=prefixForecast(model,observation);
  if(!result.states)return {status:'abstained',reason:'forecast_diverged'};
  const prediction=result.states.slice(1),observed=observation.samples.slice(points).map(row=>row.state);
  const order=alignment(observed,prediction),structure=blockStructure(observed,prediction);
  const information=order.p<=.005, exchangeable=structure.p>.01;
  return {status:information&&exchangeable?'predictive_candidate':'abstained',
    alignment:order,structuredResidual:structure,information,residualScreen:exchangeable,
    startIndex:points, prediction,
    scope:'Extra independent recording; exchangeability tests temporal ordering and blockwise residual shape. No structural identification.'};
}
