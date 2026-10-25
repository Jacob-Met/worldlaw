import {evaluateHistory} from './paired-history.mjs';
import {fitProbeModels,validateProbeStudy} from './probe-response.mjs';
import {tanhPositive} from '../science/tanh-enclosure.mjs';
import {rational,add,sub,mul,div,neg,cmp,enclosure} from './chronos-exact-halfplanes.mjs';
const Q=rational,Z=Q(0),ONE=Q(1),TWO=Q(2),PRIOR=[Q(-100),Q(100)];
const low=(a,b)=>cmp(a,b)<=0?a:b,high=(a,b)=>cmp(a,b)>=0?a:b;
const text=q=>q[0]+'/'+q[1],mid=pair=>div(add(pair[0],pair[1]),TWO);
const publicInterval=pair=>({exact:pair.map(text),outer:[enclosure(pair[0]).lower,enclosure(pair[1]).upper]});
export function profileSettings(raw={}){
 const s={scaleMin:raw.scaleMin??.05,scaleMax:raw.scaleMax??1,scaleResolution:raw.scaleResolution??.001,maxBoxes:raw.maxBoxes??128,maxEvaluations:raw.maxEvaluations??512};
 if(![s.scaleMin,s.scaleMax].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=1e-6&&v<=1e6)||s.scaleMin>=s.scaleMax)throw Error('Declare increasing saturation rates in [1e-6,1e6] rad/s.');
 if(!Number.isFinite(s.scaleResolution)||s.scaleResolution<1e-6||s.scaleResolution>1e6||!Number.isSafeInteger(s.maxBoxes)||s.maxBoxes<1||s.maxBoxes>256||!Number.isSafeInteger(s.maxEvaluations)||s.maxEvaluations<1||s.maxEvaluations>1024)throw Error('Declare resolution >=1e-6, 1–256 boxes and 1–1024 feature evaluations.');
 return s;
}
class Budget extends Error {}
function context(limit){
 const cache=new Map();let count=0;
 return {get count(){return count;},feature(rate,scale){
  const key=text(rate)+'|'+text(scale);if(cache.has(key))return cache.get(key);
  if(count>=limit)throw new Budget();count++;
  const value=tanhPositive(div(rate,scale));cache.set(key,value);return value;
 }};
}
function rowsOf(fit){
 return fit.points.map(p=>{
  const r=p.probe.rate;
  if(r!==0&&Math.abs(r)<1e-8)throw Error('Exact profiling supports zero or rate magnitudes of at least 1e-8 rad/s.');
  const original=p.interval.map(Q),interval=r<0?[neg(original[1]),neg(original[0])]:original;
  return {id:p.id,rate:Q(Math.abs(r)),interval,original:p};
 });
}
function clipRows(rows,box,ctx){
 let outer=[...box.amplitude],inner=[...box.amplitude];
 for(const row of rows){
  if(!row.rate[0]){if(cmp(row.interval[0],Z)>0||cmp(row.interval[1],Z)<0)return null;continue;}
  const f=[ctx.feature(row.rate,box.scale[1])[0],ctx.feature(row.rate,box.scale[0])[1]];
  if(cmp(f[0],Z)<=0)throw Error('Feature enclosure cannot support positive division.');
  const lows=f.map(x=>div(row.interval[0],x)),highs=f.map(x=>div(row.interval[1],x));
  outer=[high(outer[0],low(...lows)),low(outer[1],high(...highs))];
  if(cmp(outer[0],outer[1])>0)return null;
  if(inner){inner=[high(inner[0],high(...lows)),low(inner[1],low(...highs))];if(cmp(inner[0],inner[1])>0)inner=null;}
 }
 return {scale:box.scale,amplitude:outer,inner};
}
function runProfile(rows,s,ctx){
 const initial={scale:[Q(s.scaleMin),Q(s.scaleMax)],amplitude:[...PRIOR]};
 if(rows.every(r=>cmp(r.interval[0],Z)<=0&&cmp(r.interval[1],Z)>=0)){
  let box=initial,budgetExhausted=false;
  try{box=clipRows(rows,initial,ctx)??initial;}catch(e){if(!(e instanceof Budget))throw e;budgetExhausted=true;}
  return {boxes:[{...box,covered:true,witness:{scale:mid(initial.scale),amplitude:Z}}],visited:1,excluded:0,budgetExhausted,zeroCompatible:true};
 }
 const queue=[initial],boxes=[];let visited=0,excluded=0,budgetExhausted=false;
 while(queue.length&&visited<s.maxBoxes){
  const item=queue.pop();visited++;
  try{
   const box=clipRows(rows,item,ctx);
   if(!box){excluded++;continue;}
   if(box.inner){boxes.push({...box,covered:true,witness:{scale:mid(box.scale),amplitude:mid(box.inner)}});continue;}
   if(cmp(sub(box.scale[1],box.scale[0]),Q(s.scaleResolution))<=0){
    const scale=mid(box.scale),point=clipRows(rows,{scale:[scale,scale],amplitude:box.amplitude},ctx);
    boxes.push({...box,covered:false,witness:point?.inner?{scale,amplitude:mid(point.inner)}:null});
   }else{
    const middle=mid(box.scale);
    queue.push({scale:[middle,box.scale[1]],amplitude:box.amplitude},{scale:[box.scale[0],middle],amplitude:box.amplitude});
   }
  }catch(e){if(!(e instanceof Budget))throw e;queue.push(item);budgetExhausted=true;break;}
 }
 if(queue.length)budgetExhausted=true;
 boxes.push(...queue.map(b=>({...b,covered:false,witness:null,unvisited:true})));
 boxes.sort((a,b)=>cmp(a.scale[0],b.scale[0]));
 return {boxes,visited,excluded,budgetExhausted,zeroCompatible:false};
}
function engine(training,input={}){
 const settings=profileSettings(input),baseline=fitProbeModels(training);
 const base={schema:'worldlaw.saturation-profile/v1',settings,finiteBaseline:baseline,amplitudeBounds:[-100,100]};
 if(baseline.status==='insufficient-training')return {public:{...base,status:'insufficient-training',boxes:[],evaluations:0},result:null,ctx:null};
 const ctx=context(settings.maxEvaluations),result=runProfile(rowsOf(baseline),settings,ctx);
 const boxes=result.boxes.map(b=>({scale:publicInterval(b.scale),amplitudeOuter:publicInterval(b.amplitude),covered:b.covered,unvisited:!!b.unvisited,
  witness:b.witness?{scale:text(b.witness.scale),amplitude:text(b.witness.amplitude),coversScaleInterval:b.covered}:null}));
 return {result,ctx,public:{...base,...result,boxes,evaluations:ctx.count,status:result.zeroCompatible?'zero-response-unidentified':!boxes.length?'excluded-in-domain':result.budgetExhausted?'budget-exhausted':boxes.some(b=>b.covered)?'covered-scale-intervals':boxes.some(b=>b.witness)?'point-witnesses':'outer-boxes-only'}};
}

export function fitSaturationProfile(training,input={}){return engine(training,input).public;}
function prediction(amplitude,scale,rate,ctx){
 if(rate===0||(!amplitude[0][0]&&!amplitude[1][0]))return [Z,Z];
 if(Math.abs(rate)<1e-8)throw Error('Rate magnitude is below the supported 1e-8 rad/s limit.');
 const r=Q(Math.abs(rate)),feature=[ctx.feature(r,scale[1])[0],ctx.feature(r,scale[0])[1]];
 const ends=amplitude.flatMap(a=>feature.map(f=>mul(a,f))),band=[ends.reduce(low),ends.reduce(high)];
 return rate<0?[neg(band[1]),neg(band[0])]:band;
}
const disjoint=(a,b)=>cmp(a[0],b[1])>0||cmp(a[1],b[0])<0;
export const PROFILE_SCHEMA='worldlaw.saturation-investigation/v1';
export function analyzeSaturationProfile(raw,input={}){
 const study=validateProbeStudy(raw),work=engine({...study,runs:study.runs.filter(r=>r.role==='training')},input);
 const witness=work.result?.boxes.find(b=>b.witness)?.witness??null;
 const challenges=study.runs.filter(r=>r.role==='challenge').map(run=>{
  const obs=evaluateHistory(run.notebook),row={id:run.id,probe:run.probe,source:run.notebook.source,observed:obs.interval,qualified:obs.order.status==='counterbalanced'};
  if(!row.qualified)return {...row,status:'order-confounded'};
  if(!work.result)return {...row,status:'insufficient-training'};
  if(!work.result.boxes.length)return {...row,status:'training-family-empty'};
  if(run.probe.rate!==0&&Math.abs(run.probe.rate)<1e-8)return {...row,status:'unsupported-rate'};
  try{
   const observed=obs.interval.map(Q),bands=work.result.boxes.map(b=>prediction(b.amplitude,b.scale,run.probe.rate,work.ctx));
   const w=witness?prediction([witness.amplitude,witness.amplitude],[witness.scale,witness.scale],run.probe.rate,work.ctx):null;
   return {...row,status:bands.every(b=>disjoint(b,observed))?'family-excluded':'outer-overlap-only',
    outerBands:bands.map(publicInterval),witnessPrediction:w?publicInterval(w):null,
    witnessStatus:!w?'no-training-witness':disjoint(w,observed)?'contradicted':cmp(w[0],observed[0])>=0&&cmp(w[1],observed[1])<=0?'within-screen':'boundary-unresolved'};
  }catch(e){if(!(e instanceof Budget))throw e;return {...row,status:'budget-unresolved'};}
 });
 return {fit:work.public,challenges,source:study.runs[0]?.notebook.source??null,
 frozenWitness:witness?{scale:text(witness.scale),amplitude:text(witness.amplitude)}:null,
 evaluations:work.ctx?.count??0,
 interpretation:'Continuous velocity-scale family a*tanh(rate/scale), conditional on declared fixed preparation, original binary64 screening endpoints and amplitude bounds [-100,100]. Covered intervals have one common amplitude valid for every scale. Outer boxes may contain infeasible parameters. A frozen training witness is neither unique nor optimized against challenges. Challenge outer overlap does not establish joint compatibility. Screening intervals are not calibrated confidence intervals or proof of a physical mechanism.'};
}
export function exportSaturationInvestigation(study,settings={}){
 return JSON.stringify({schema:PROFILE_SCHEMA,study:validateProbeStudy(study),settings:profileSettings(settings)},null,2)+'\n';
}
export function importSaturationInvestigation(text){
 if(typeof text!=='string'||text.length>4000000)throw Error('Use investigation JSON below 4 MB.');
 let raw;try{raw=JSON.parse(text);}catch{throw Error('Invalid saturation investigation JSON.');}
 if(raw?.schema!==PROFILE_SCHEMA)throw Error('Expected a saturation investigation.');
 return {study:validateProbeStudy(raw.study),settings:profileSettings(raw.settings)};
}

/** Post-training consistency only. Never used to choose the frozen training witness. */
export function screenSaturationChallenges(raw,input={}){
 const study=validateProbeStudy(raw),settings=profileSettings(input);
 const training=fitProbeModels({...study,runs:study.runs.filter(r=>r.role==='training')});
 const originalChallenges=study.runs.filter(r=>r.role==='challenge');
 const base={schema:'worldlaw.saturation-joint-screen/v1',settings,trainingRunIds:study.runs.filter(r=>r.role==='training').map(r=>r.id),challengeRunIds:originalChallenges.map(r=>r.id),
  interpretation:'Post-training consistency of one common amplitude and velocity scale across all original training and separate challenge screens. It does not revise the frozen training fit or select a training hypothesis from challenges. A joint witness demonstrates conditional screen compatibility, not uniqueness or a physical mechanism.'};
 if(training.status==='insufficient-training')return {...base,status:'insufficient-training',boxes:[],evaluations:0};
 if(!originalChallenges.length)return {...base,status:'untested',boxes:[],evaluations:0};
 const points=originalChallenges.map(r=>({...r,...evaluateHistory(r.notebook)}));
 const unqualified=points.filter(p=>p.order.status!=='counterbalanced').map(p=>p.id);
 if(unqualified.length)return {...base,status:'unqualified-challenges',unqualified,boxes:[],evaluations:0};
 const unsupported=points.filter(p=>p.probe.rate!==0&&Math.abs(p.probe.rate)<1e-8).map(p=>p.id);
 if(unsupported.length)return {...base,status:'unsupported-challenges',unsupported,boxes:[],evaluations:0};
 const rows=rowsOf({points:[...training.points,...points]}),ctx=context(settings.maxEvaluations),result=runProfile(rows,settings,ctx);
 const boxes=result.boxes.map(b=>({scale:publicInterval(b.scale),amplitudeOuter:publicInterval(b.amplitude),covered:b.covered,unvisited:!!b.unvisited,
  consistencyWitness:b.witness?{scale:text(b.witness.scale),amplitude:text(b.witness.amplitude),coversScaleInterval:b.covered}:null}));
 return {...base,...result,boxes,evaluations:ctx.count,
  status:!boxes.length?'jointly-excluded':boxes.some(b=>b.consistencyWitness)?'joint-witness':result.budgetExhausted?'budget-unresolved':'outer-boxes-only'};
}

export function saturationRateSettings(input){
 if(!input||typeof input!=='object')throw Error('Declare a prospective saturation comparison.');
 const settings=profileSettings(input.settings??{}),windows=input.windows,probes=input.probes,radius=input.contrastRadius,budget=input.budget;
 if(!Array.isArray(windows)||windows.length!==2||windows.some(w=>!Array.isArray(w)||w.length!==2||w.some(v=>typeof v!=='number'||!Number.isFinite(v))||w[0]<settings.scaleMin||w[1]>settings.scaleMax||w[0]>w[1])||windows[0][1]>=windows[1][0])throw Error('Declare two separated increasing scale windows inside the original domain.');
 if(!Array.isArray(probes)||probes.length<1||probes.length>8||probes.some(r=>typeof r?.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(r.id)||typeof r.position!=='number'||!Number.isFinite(r.position)||Math.abs(r.position)>1e6||typeof r.rate!=='number'||!Number.isFinite(r.rate)||Math.abs(r.rate)>1e6||(r.rate!==0&&Math.abs(r.rate)<1e-8)||!Number.isFinite(r.cost)||r.cost<=0||r.cost>1e6)||new Set(probes.map(r=>r.id)).size!==probes.length||new Set(probes.map(r=>JSON.stringify([r.position,r.rate]))).size!==probes.length)throw Error('Offer one to eight distinct full angle/rate states with safe names and positive costs.');
 if(typeof radius!=='number'||!Number.isFinite(radius)||radius<0||radius>100||typeof budget!=='number'||!Number.isFinite(budget)||budget<0||budget>1e6)throw Error('Declare finite nonnegative future response radius and cost budget.');
 return {settings,windows:windows.map(w=>[...w]),probes:probes.map(({id,position,rate,cost})=>({id,position,rate,cost})),contrastRadius:radius,budget};
}
export function compareSaturationRates(raw,input){
 const study=validateProbeStudy(raw),config=saturationRateSettings(input),{settings,windows,probes:rates,contrastRadius:radius,budget}=config;
 const work=engine({...study,runs:study.runs.filter(r=>r.role==='training')},settings);
 const base={schema:'worldlaw.saturation-rate-comparison/v1',settings:config,preparation:{...study.preparation},source:study.runs[0]?.notebook.source??null,objective:'Largest certified separation margin among affordable offered rates; no global rate optimum claimed.',training:work.public,windows:windows.map(w=>[...w]),radius,budget,offered:rates.map(({id,position,rate,cost})=>({id,position,rate,cost})),selected:null,
  uncomparedScaleRanges:[...(settings.scaleMin<windows[0][0]?[{lower:settings.scaleMin,upper:windows[0][0],lowerClosed:true,upperClosed:false}]:[]),{lower:windows[0][1],upper:windows[1][0],lowerClosed:false,upperClosed:false},...(windows[1][1]<settings.scaleMax?[{lower:windows[1][1],upper:settings.scaleMax,lowerClosed:false,upperClosed:true}]:[])],
  qualification:'Conditional discrimination of two declared separated scale windows only; scales outside those windows remain untested. Forecasts retain each training box amplitude-scale association and over-enclose any remaining correlation. Disjoint expanded unions certify separation; overlap is unresolved. The candidate law depends on rate only; angular and mixed effects are not included. Offered states are not certified physically feasible. No future response is fabricated or acquired; declared response radius is not calibrated uncertainty.'};
 if(!work.result)return {...base,status:'insufficient-training',courses:[]};
 const groups=windows.map(w=>work.result.boxes.map(b=>{
  const scale=[high(b.scale[0],Q(w[0])),low(b.scale[1],Q(w[1]))];if(cmp(scale[0],scale[1])>0)return null;
  let witness=null;if(b.covered)witness={scale:mid(scale),amplitude:b.witness.amplitude};
  else if(b.witness&&cmp(b.witness.scale,scale[0])>=0&&cmp(b.witness.scale,scale[1])<=0)witness=b.witness;
  return {scale,amplitude:b.amplitude,witness};
 }).filter(Boolean));
 if(groups.some(g=>!g.length))return {...base,status:'training-excluded-window',courses:[]};
 if(groups.some(g=>!g.some(b=>b.witness)))return {...base,status:'window-witness-unresolved',courses:[]};
 const publicGroups=groups.map(g=>({boxes:g.map(b=>({scale:publicInterval(b.scale),amplitudeOuter:publicInterval(b.amplitude)})),witness:(()=>{const w=g.find(b=>b.witness).witness;return{scale:text(w.scale),amplitude:text(w.amplitude)};})()}));
 const trainingRuns=study.runs.filter(r=>r.role==='training');
 const range=field=>[Math.min(...trainingRuns.map(r=>r.probe[field])),Math.max(...trainingRuns.map(r=>r.probe[field]))];
 const angleRange=range('position'),rateRange=range('rate');
 const courses=[];
 const comparisonWork=groups[0].length*groups[1].length*rates.length;
 if(comparisonWork>150000)return {...base,status:'budget-unresolved',groups:publicGroups,courses:[],evaluations:work.ctx.count};
 try{
  for(const offered of rates){
   const forecasts=groups.map(g=>g.map(b=>prediction(b.amplitude,b.scale,offered.rate,work.ctx)));
   let margin=null;
   for(const a of forecasts[0])for(const b of forecasts[1]){
    const gap=cmp(a[1],b[0])<0?sub(b[0],a[1]):cmp(b[1],a[0])<0?sub(a[0],b[1]):Z;
    const cleared=high(Z,sub(gap,mul(TWO,Q(radius))));margin=margin===null?cleared:low(margin,cleared);
   }
   courses.push({id:offered.id,probe:{command:study.runs.find(r=>r.role==='training').probe.command,position:offered.position,rate:offered.rate},cost:offered.cost,extrapolation:{position:offered.position<angleRange[0]||offered.position>angleRange[1],rate:offered.rate<rateRange[0]||offered.rate>rateRange[1]},affordable:offered.cost<=budget,forecasts:forecasts.map(g=>g.map(publicInterval)),margin:publicInterval([margin,margin]),separates:cmp(margin,Z)>0});
  }
 }catch(e){if(!(e instanceof Budget))throw e;return {...base,status:'budget-unresolved',groups:publicGroups,courses:[],evaluations:work.ctx.count};}
 const eligible=courses.filter(c=>c.affordable&&c.separates);
 eligible.sort((a,b)=>{const aq=a.margin.exact[0].split('/').map(BigInt),bq=b.margin.exact[0].split('/').map(BigInt);return -cmp(aq,bq)||a.cost-b.cost||(a.id<b.id?-1:a.id>b.id?1:0);});
 return {...base,status:eligible.length?'separated-offered-windows':'no-certified-discriminator',groups:publicGroups,courses,selected:eligible[0]?.id??null,evaluations:work.ctx.count,comparisonWork};
}
