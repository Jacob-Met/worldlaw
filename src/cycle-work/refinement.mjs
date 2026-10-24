import {inspectCurvatureWitnesses} from './curvature-witness.mjs';
import {normalizeCycle,evaluateCycle,CycleWorkError} from './core.mjs';
export const REFINEMENT_SCHEMA='worldlaw.cycle-refinement/v1';
export const BRANCH_ASSUMPTION='monotone-angle-no-gaps-twice-differentiable-on-this-directed-segment';
const fail=(ok,message)=>{if(!ok)throw new CycleWorkError(message);};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const label=x=>typeof x==='string'&&x.trim().length>0&&x.length<=2000;
function grid(a,b,n){
 const points=Array.from({length:n+1},(_,j)=>j===0?a:j===n?b:a+(b-a)*j/n);
 for(let j=1;j<points.length;j++)fail(b>a?points[j]>points[j-1]:points[j]<points[j-1],'Requested subdivision has no distinct representable ordered angle; reduce the budget.');
 return points;
}
function bound(a,b,n,m){
 if(a===b)return 0;
 const points=grid(a,b,n);let sum=0;
 for(let j=1;j<points.length;j++){
  const left=points[j-1],right=points[j];
  const h=Math.abs(right-left)+Number.EPSILON*(Math.abs(right)+Math.abs(left))+Number.MIN_VALUE;
  sum+=m>0?m*h*h*h/12+Number.MIN_VALUE:0;
 }
 return sum===0?(m>0?Number.MIN_VALUE:0):sum*(1+64*Number.EPSILON*(n+1))+Number.MIN_VALUE;
}
export function planRefinement(cycle,curvature,budget){
 const original=normalizeCycle(cycle);
 fail(Number.isInteger(budget)&&budget>=0&&budget<=128,'Declare an additional-reading budget from 0 to 128.');
 fail(original.samples.length+budget<=4096,'Original plus requested new readings must not exceed 4096.');
 fail(Array.isArray(curvature)&&curvature.length===original.samples.length-1,'Declare curvature or a zero-angle jump for every original segment.');
 const declarations=curvature.map((c,i)=>{
  fail(c?.segment===i,'Curvature declarations must retain every original segment index in order.');
  const zero=original.samples[i].position===original.samples[i+1].position;
  if(zero){fail(c.kind==='zero-angle-jump','A zero-angle transition must be declared as a jump, not a smooth branch.');return {segment:i,kind:c.kind};}
  fail(c.kind==='bounded-curvature'&&c.assumption===BRANCH_ASSUMPTION,'Explicit monotone, gap-free segment smoothness is required.');
  fail(finite(c.maxSecondDerivative)&&c.maxSecondDerivative>=0&&c.maxSecondDerivative<=1e12,'Curvature must be finite, nonnegative and at most 1e12 N·m/rad².');
  fail(label(c.source),'Each curvature bound needs its own declared basis.');
  return {segment:i,kind:c.kind,assumption:c.assumption,maxSecondDerivative:c.maxSecondDerivative,source:c.source.trim()};
 });
 const segments=declarations.map((c,i)=>{const a=original.samples[i].position,b=original.samples[i+1].position,m=c.maxSecondDerivative??0;return {segment:i,a,b,m,subdivisions:1,bound:bound(a,b,1,m)};});
 const coarseBound=segments.reduce((s,x)=>s+x.bound,0)*(1+64*Number.EPSILON*segments.length);
 const allocations=[];
 for(let k=0;k<budget;k++){
  let best=null;
  for(const segment of segments){if(segment.a===segment.b||segment.m===0)continue;const next=bound(segment.a,segment.b,segment.subdivisions+1,segment.m),reduction=segment.bound-next;
   if(reduction>0&&(!best||reduction>best.reduction))best={segment,reduction,next};
  }
  if(!best)break;
  best.segment.subdivisions++;best.segment.bound=best.next;allocations.push({segment:best.segment.segment,reduction:best.reduction});
 }
 const requests=[];
 for(const s of segments){if(s.a===s.b)continue;const points=grid(s.a,s.b,s.subdivisions);for(let j=1;j<s.subdivisions;j++)requests.push({segment:s.segment,index:j,position:points[j]});}
 const refinedBound=segments.reduce((s,x)=>s+x.bound,0)*(1+64*Number.EPSILON*segments.length);
 fail(Number.isFinite(coarseBound)&&Number.isFinite(refinedBound),'Curvature bound overflowed.');
 return {request:{cycle:original,curvature:declarations,budget},usedBudget:requests.length,unusedBudget:budget-requests.length,coarseBound,refinedBound,segments,requests,allocations,
  rule:'Greedy largest decrease of the conservative segment bound; exact ties use the earliest original segment. Allocation steps are not acquisition instructions: freeze the final grid before acquiring any new readings. No global optimization guarantee is claimed.'};
}
export function reopenRefinement(raw){
 fail(raw?.schema===REFINEMENT_SCHEMA,'Expected worldlaw.cycle-refinement/v1.');
 const plan=planRefinement(raw.request?.cycle,raw.request?.curvature,raw.request?.budget),original=plan.request.cycle;
 const acquisition=raw.acquisition??null;
 if(acquisition){
  fail(acquisition.branchAssumption==='same-directed-response-branch-as-original-endpoints','New readings must explicitly declare the same directed response branch; arbitrary later cycles cannot reconstruct the original path.');
  fail(JSON.stringify(acquisition.request)===JSON.stringify(plan.request),'Acquisition belongs to a stale or modified frozen request. Copy the exact exported request.');
  fail(Array.isArray(acquisition.readings)&&acquisition.readings.length<=plan.requests.length,'Too many or invalid new readings.');
 }
 const seen=new Set(),ids=new Set();
 const readings=(acquisition?.readings??[]).map(r=>{
  const request=plan.requests.find(p=>p.segment===r?.segment&&p.index===r?.index);
  fail(request&&r.position===request.position,'A reading must match its original segment, subdivision index and exact requested angle.');
  const key=r.segment+':'+r.index;fail(!seen.has(key),'Duplicate requested reading.');seen.add(key);
  fail(typeof r.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(r.id)&&!ids.has(r.id),'Every new reading needs a distinct acquisition ID.');ids.add(r.id);
  fail(label(r.source),'Every new reading needs explicit source provenance.');
  fail(finite(r.jointTorque)&&Math.abs(r.jointTorque)<=1e12&&finite(r.torqueRadius)&&r.torqueRadius>=0&&r.torqueRadius<=1e12,'New torque and error radius must be finite within limits.');
  return {...request,id:r.id,source:r.source.trim(),jointTorque:r.jointTorque,torqueRadius:r.torqueRadius};
 });
 const allowance=extra=>{const sum=original.integrationAllowance+extra;fail(sum<=1e12,'Combined retained allowance and curvature bound exceeds the supported 1e12 J allowance.');return sum;};
 const curvatureAudit=inspectCurvatureWitnesses(plan,readings);
 const withheld=curvatureAudit.status==='contradicted';
 const polygon={original:evaluateCycle(original),refined:null};
 const coarse=withheld?null:evaluateCycle({...original,integrationAllowance:allowance(plan.coarseBound)});
 let refined=null;
 if(acquisition&&readings.length===plan.requests.length){
  const samples=[];
  for(let i=0;i<original.samples.length-1;i++){
   samples.push(original.samples[i]);
   for(const p of plan.requests.filter(p=>p.segment===i)){const r=readings.find(r=>r.segment===p.segment&&r.index===p.index);samples.push({position:r.position,jointTorque:r.jointTorque,torqueRadius:r.torqueRadius});}
  }
  samples.push(original.samples.at(-1));
  polygon.refined=evaluateCycle({...original,samples});
  refined=withheld?null:evaluateCycle({...original,samples,integrationAllowance:allowance(plan.refinedBound)});
 }
 return {bundle:{schema:REFINEMENT_SCHEMA,request:plan.request,acquisition:acquisition?{request:plan.request,branchAssumption:acquisition.branchAssumption,readings}:null},plan,coarse,refined,polygon,curvatureAudit,continuousPath:withheld?null:{coarse,refined},conditionalStatus:withheld?'withheld-curvature-contradiction':'conditional-on-unvalidated-assumptions',pending:plan.requests.length-readings.length};
}
