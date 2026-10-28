import {validateReferenceStudy,analyzeReferenceStudy} from './reference-channel.mjs';
export const MODEL_SCHEMA='worldlaw.reference-models/v1';
const NUMERICAL_PAD=1e-10;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const fail=m=>{throw new Error(m);};
function bounds(x,name,limit){if(!Array.isArray(x)||x.length!==2||!x.every(finite)||x[0]>x[1]||x.some(v=>Math.abs(v)>limit))fail(name+' requires ordered finite bounds within ±'+limit);return [...x];}
export function validateReferenceModels(raw){
 if(!raw||raw.schema!==MODEL_SCHEMA)fail('Expected reference model comparison.');
 const study=validateReferenceStudy(raw.study);
 const amplitudeBounds=bounds(raw.amplitudeBounds,'Additional amplitude',100);
 if(!Array.isArray(raw.taus)||raw.taus.length<1||raw.taus.length>12||raw.taus.some(t=>!finite(t)||t<.001||t>1000)||new Set(raw.taus).size!==raw.taus.length)fail('Offer 1–12 distinct finite tau values between .001 and 1000 seconds.');
 return {schema:MODEL_SCHEMA,study,amplitudeBounds,taus:[...raw.taus]};
}
function clip(p,c,d,b){
 const out=[];
 for(let i=0;i<p.length;i++){
  const a=p[i],z=p[(i+1)%p.length],u=c*a[0]+d*a[1]-b,v=c*z[0]+d*z[1]-b;
  if(u<=0)out.push(a);
  if((u<0&&v>0)||(u>0&&v<0)){const t=u/(u-v);out.push([a[0]+t*(z[0]-a[0]),a[1]+t*(z[1]-a[1])]);}
 }
 return out;
}
const basis=(t,tau)=>tau===null?0:-Math.expm1(-t/tau);
function start(g,a){
 return [-1,1].flatMap(sign=>{
  const lo=Math.max(g[0],sign<0?-Infinity:0),hi=Math.min(g[1],sign<0?0:Infinity);
  return lo>hi?[]:[{sign,vertices:[[lo,a[0]],[hi,a[0]],[hi,a[1]],[lo,a[1]]]}];
 });
}
function restrict(polygons,point,tau){
 const m=point.main.interval,r=point.reference.interval,f=basis(point.duration,tau);
 if([...m,...r].some(x=>!finite(x)||Math.abs(x)>1e6))fail('Channel interval exceeds supported numerical range ±1e6.');
 return polygons.flatMap(p=>{
  const low=p.sign<0?r[1]:r[0],high=p.sign<0?r[0]:r[1];
  const pad=NUMERICAL_PAD*(1+Math.max(...m.map(Math.abs))+10*Math.max(...r.map(Math.abs))+100*Math.abs(f));
  let v=clip(p.vertices,low,f,m[1]+pad);v=clip(v,-high,-f,-m[0]+pad);
  return v.length?[{sign:p.sign,vertices:v}]:[];
 });
}
export function analyzeReferenceModels(raw){
 const source=validateReferenceModels(raw),base=analyzeReferenceStudy(source.study);
 const training=base.points.filter(p=>p.role==='training'),challenges=base.points.filter(p=>p.role==='challenge');
 const ready=base.fit.status!=='insufficient-training';
 const specs=[{id:'artifact-only',tau:null,amplitudeBounds:[0,0]},...source.taus.map((tau,i)=>({id:'additional-'+i,tau,amplitudeBounds:source.amplitudeBounds}))];
 const models=specs.map(spec=>{
  let polygons=ready?start(source.study.gainBounds,spec.amplitudeBounds):[];
  if(ready)for(const p of training)polygons=restrict(polygons,p,spec.tau);
  const frozen=polygons;
  let joint=polygons;
  const individual=challenges.map(p=>({id:p.id,status:!ready?'insufficient-training':!frozen.length?'training-contradicted':!p.qualified?'unqualified':restrict(frozen,p,spec.tau).length?'compatible':'contradicted'}));
  for(const p of challenges.filter(p=>p.qualified))joint=restrict(joint,p,spec.tau);
  const missing=challenges.filter(p=>!p.qualified).length;
  return {...spec,training:{status:!ready?'insufficient-training':frozen.length?'compatible':'contradicted',polygons:frozen},
   challenges:individual,joint:{status:!ready?'insufficient-training':!frozen.length?'training-contradicted':!challenges.length?'untested':!joint.length?'contradicted':missing?'incomplete':'compatible',polygons:joint,qualifiedCount:challenges.length-missing,unqualifiedCount:missing}};
 });
 return {source,models,numericalContract:{basis:'JavaScript binary64 -expm1(-duration/tau)',inequalityPadding:NUMERICAL_PAD,interpretation:'Computed conservative screening slack, not interval-certified arithmetic. Near-boundary distinctions below this guard are unresolved; no calibrated probability or physical causal identification.'}};
}
export function predictReferenceModel(model,offer){
 if(!finite(offer.duration)||offer.duration<=0||offer.duration>1000)fail('Offered duration must be positive and at most 1000 seconds.');
 const r=bounds(offer.referenceInterval,'Anticipated reference contrast',1e6);
 const ranges=model.training.polygons.map(p=>{
  const v=p.vertices.flatMap(([g,a])=>r.map(x=>g*x+a*basis(offer.duration,model.tau)));
  const pad=NUMERICAL_PAD*(1+Math.max(...v.map(Math.abs)));
  return [Math.min(...v)-pad,Math.max(...v)+pad];
 }).sort((a,b)=>a[0]-b[0]);
 const union=[];
 for(const v of ranges){const last=union.at(-1);if(last&&v[0]<=last[1])last[1]=Math.max(last[1],v[1]);else union.push([...v]);}
 return union;
}
export function compareReferenceExperiments(raw,offers){
 const analysis=analyzeReferenceModels(raw);
 if(!Array.isArray(offers)||!offers.length||offers.length>32)fail('Offer 1–32 acquisition conditions.');
 const models=analysis.models.filter(m=>m.training.status==='compatible'),ids=new Set();
 const comparisons=offers.map(o=>{
  if(typeof o.id!=='string'||!o.id||ids.has(o.id))fail('Use distinct offered condition identifiers.');ids.add(o.id);
  if(!finite(o.radius)||o.radius<0||o.radius>1e6)fail('Future main-contrast radius must be finite, nonnegative and at most 1e6.');
  predictReferenceModel({training:{polygons:[]},tau:null},o); // Validate offered coordinates even with no surviving models.
  const predictions=models.map(m=>({id:m.id,intervals:predictReferenceModel(m,o)}));
  const pairs=[];
  for(let i=0;i<predictions.length;i++)for(let j=i+1;j<predictions.length;j++){
   const a=predictions[i],b=predictions[j];
   const gaps=a.intervals.flatMap(x=>b.intervals.map(y=>Math.max(y[0]-x[1],x[0]-y[1])-2*o.radius));
   pairs.push({left:a.id,right:b.id,separated:gaps.every(g=>g>0),minimumGap:Math.min(...gaps)});
  }
  return {id:o.id,duration:o.duration,referenceInterval:[...o.referenceInterval],radius:o.radius,predictions,pairs,separatedPairs:pairs.filter(p=>p.separated).length,totalPairs:pairs.length};
 });
 const ranked=[...comparisons].sort((a,b)=>b.separatedPairs-a.separatedPairs||a.duration-b.duration||a.id.localeCompare(b.id));
 return {analysis,comparisons,recommendation:models.length<2?null:ranked[0].separatedPairs?ranked[0].id:null,scope:'Training only; complete offered finite tau list and full computed feasible unions. Anticipated reference response and future precision are assumptions, not physically guaranteed interventions. Nested A=0 alternatives can remain indistinguishable.'};
}
export const exportReferenceModels=raw=>JSON.stringify(validateReferenceModels(raw),null,2)+'\n';
