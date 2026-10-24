// Bounded numerical parameter-set screening; outer boxes are NOT feasible models.
import {fitDurationModels,validateDurationStudy} from './duration-response.mjs';
import {evaluateHistory} from './paired-history.mjs';
export const CONTINUOUS_METHOD='worldlaw.continuous-duration/v1';
const amplitudeBounds=Object.freeze([-100,100]);
const fail=m=>{throw Error(m);};
const finite=(x,a,b)=>typeof x==='number'&&Number.isFinite(x)&&x>=a&&x<=b;
const response=(t,tau)=>-Math.expm1(-t/tau);
export function continuousSettings(input={}){
 const s={tauMin:input.tauMin??.1,tauMax:input.tauMax??8,tauResolution:input.tauResolution??.01,maxBoxes:input.maxBoxes??2048};
 if(!finite(s.tauMin,.0001,1000)||!finite(s.tauMax,.0001,1000)||s.tauMin>=s.tauMax)fail('Relaxation bounds must satisfy 0.0001 ≤ min < max ≤ 1000 seconds.');
 if(!finite(s.tauResolution,.00001,1000)||!Number.isInteger(s.maxBoxes)||s.maxBoxes<1||s.maxBoxes>16384)fail('Declare resolution from 0.00001 to 1000 seconds and work budget of 1–16384 boxes.');
 return s;
}
function pointsOf(runs){return runs.map(r=>{const e=evaluateHistory(r.notebook);return {id:r.id,duration:r.duration,interval:e.interval,order:e.order.status,observed:e.decisionDifference};});}
function pointInterval(points,tau){
 let low=amplitudeBounds[0],high=amplitudeBounds[1];
 for(const p of points){
  if(p.duration===0){if(p.interval[0]>0||p.interval[1]<0)return null;continue;}
  const f=response(p.duration,tau);low=Math.max(low,p.interval[0]/f);high=Math.min(high,p.interval[1]/f);
 }
 if(low>high)return null;
 const amplitude=low+(high-low)/2;
 const predictions=points.map(p=>amplitude*response(p.duration,tau));
 if(!predictions.every((y,i)=>y>=points[i].interval[0]&&y<=points[i].interval[1]))return null;
 return {tau,amplitude,amplitudeInterval:[low,high],predictions};
}
function enclose(points,box){
 let [low,high]=box.amplitude;
 for(const p of points){
  if(p.duration===0){if(p.interval[0]>0||p.interval[1]<0)return null;continue;}
  const shapes=box.tau.map(tau=>response(p.duration,tau));
  const quotients=p.interval.flatMap(y=>shapes.map(f=>y/f));
  // Inflate numerical bounds, never use this relaxation to assert feasibility.
  const lo=Math.min(...quotients),hi=Math.max(...quotients);
  const padding=1e-12*Math.max(1,Math.abs(lo),Math.abs(hi));
  low=Math.max(low,lo-padding);high=Math.min(high,hi+padding);
 }
 return low<=high?{tau:[...box.tau],amplitude:[low,high]}:null;
}
function search(points,settings,initial=[{tau:[settings.tauMin,settings.tauMax],amplitude:[...amplitudeBounds]}]){
 if(points.some(p=>p.duration>0&&p.duration<1e-8))fail('Continuous screening supports zero or conditioning durations of at least 1e-8 seconds.');
 const zeroCompatible=points.every(p=>p.interval[0]<=0&&p.interval[1]>=0);
 // Zero is a coherent witness for every tau. Refining that unidentifiable axis
 // adds work without information; retain the full outer domain explicitly.
 if(zeroCompatible){
  const outer=initial.map(box=>enclose(points,box)).filter(Boolean);
  return {status:'zero-compatible-unidentified',boxes:outer,witnesses:[{tau:(settings.tauMin+settings.tauMax)/2,amplitude:0,amplitudeInterval:[0,0],predictions:points.map(()=>0)}],
   evaluatedBoxes:outer.length,budgetExhausted:false,resolutionComplete:false,zeroCompatible:true};
 }
 const queue=initial.map(b=>({tau:[...b.tau],amplitude:[...b.amplitude]})),boxes=[],witnesses=[];
 let evaluatedBoxes=0;
 while(queue.length&&evaluatedBoxes<settings.maxBoxes){
  const item=queue.pop();evaluatedBoxes++;
  const box=enclose(points,item);if(!box)continue;
  const [lo,hi]=box.tau,mid=lo+(hi-lo)/2;
  if(hi-lo<=settings.tauResolution){
   boxes.push({...box,resolutionMet:true});
   const witness=pointInterval(points,mid);if(witness&&witness.amplitude>=box.amplitude[0]&&witness.amplitude<=box.amplitude[1])witnesses.push(witness);
  }else{
   queue.push({tau:[mid,hi],amplitude:[...box.amplitude]},{tau:[lo,mid],amplitude:[...box.amplitude]});
  }
 }
 const budgetExhausted=queue.length>0;
 // Unvisited children retain their parent's conservative amplitude enclosure.
 boxes.push(...queue.map(box=>({...box,resolutionMet:false})));
 boxes.sort((a,b)=>a.tau[0]-b.tau[0]);
 return {status:!boxes.length?'excluded-in-bounds':budgetExhausted?'budget-exhausted':witnesses.length?'feasible-witnesses':'outer-boxes-only',
  boxes,witnesses,evaluatedBoxes,budgetExhausted,resolutionComplete:!budgetExhausted,zeroCompatible:false};
}
export function fitContinuousDuration(training,input={}){
 const settings=continuousSettings(input),finiteBaseline=fitDurationModels(training);
 const points=pointsOf(training);
 if(finiteBaseline.status==='insufficient-training')return {method:CONTINUOUS_METHOD,settings,amplitudeBounds:[...amplitudeBounds],finiteBaseline,points,
  status:'insufficient-training',boxes:[],witnesses:[],evaluatedBoxes:0,budgetExhausted:false,resolutionComplete:false,zeroCompatible:false};
 return {method:CONTINUOUS_METHOD,settings,amplitudeBounds:[...amplitudeBounds],finiteBaseline,points,...search(points,settings)};
}
export function continuousPredictionIntervals(fit,duration){
 if(!finite(duration,0,30))fail('Prediction duration must be between 0 and 30 seconds.');
 return fit.boxes.map(box=>{
  const products=box.amplitude.flatMap(a=>box.tau.map(tau=>a*response(duration,tau)));
  const padding=1e-12*Math.max(1,...products.map(Math.abs));
  return {tau:[...box.tau],interval:[Math.min(...products)-padding,Math.max(...products)+padding]};
 });
}
export function analyzeContinuousDurationStudy(raw,input={}){
 const study=validateDurationStudy(raw),training=study.runs.filter(r=>r.role==='training');
 const fit=fitContinuousDuration(training,input);
 const challengeRuns=study.runs.filter(r=>r.role==='challenge'),points=pointsOf(challengeRuns);
 const challenges=points.map(p=>{
  const predictions=continuousPredictionIntervals(fit,p.duration),qualified=p.order==='counterbalanced';
  const overlap=predictions.some(q=>q.interval[1]>=p.interval[0]&&q.interval[0]<=p.interval[1]);
  return {...p,predictions,qualified,status:!predictions.length?'no-training-envelope':!qualified?'order-confounded':overlap?'outer-envelope-overlap':'outside-outer-envelope'};
 });
 let joint={status:'untested',witnesses:[],boxes:[],unqualifiedCount:challenges.filter(c=>!c.qualified).length};
 if(challenges.length&&fit.boxes.length){
  const qualified=challenges.filter(c=>c.qualified);
  const searched=search([...fit.points,...qualified],fit.settings,fit.boxes);
  joint={...searched,unqualifiedCount:joint.unqualifiedCount,
   status:!searched.boxes.length?'contradicted':joint.unqualifiedCount?'incomplete':searched.witnesses.length?'coherent-witness':'unresolved-outer-boxes'};
 }
 return {fit,challenges,joint,source:study.runs[0]?.notebook.source??null,
  limitation:'Bounded numerical screening of an additive single-exponential response. Outer boxes may contain no feasible parameter. Witnesses satisfy all supplied screen intervals but do not establish calibrated confidence, unique physics or causal memory.'};
}

export function exportContinuousInvestigation(study,settings){
 return JSON.stringify({schema:'worldlaw.continuous-duration-investigation/v1',study:validateDurationStudy(study),settings:continuousSettings(settings)},null,2)+'\n';
}
export function importContinuousInvestigation(text){
 if(typeof text!=='string'||text.length>4000000)fail('Use continuous investigation JSON below 4 MB.');
 let raw;try{raw=JSON.parse(text);}catch{fail('Invalid continuous investigation JSON.');}
 if(raw?.schema!=='worldlaw.continuous-duration-investigation/v1')fail('Unsupported continuous investigation schema.');
 const keys=['tauMin','tauMax','tauResolution','maxBoxes'];
 if(!raw.settings||typeof raw.settings!=='object'||Array.isArray(raw.settings)||
  keys.some(key=>!Object.hasOwn(raw.settings,key)||typeof raw.settings[key]!=='number'||!Number.isFinite(raw.settings[key])))
  fail('Saved comparisons must retain all four explicit finite numerical search settings.');
 const study=validateDurationStudy(raw.study),settings=continuousSettings(raw.settings);
 analyzeContinuousDurationStudy(study,settings);
 return {study,settings};
}
