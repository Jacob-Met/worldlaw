import {normalizeCycle,evaluateCycle,CycleWorkError} from './core.mjs';
import {fitLinearColumns} from '../science/linear-fit.mjs';
export const BRANCH_RESPONSE_SCHEMA='worldlaw.cycle-branch-response/v1';
export const BRANCH_RECEIVING_ASSUMPTION='separately-acquired-cycle-not-used-for-fitting';
export const BRANCH_FAMILIES=Object.freeze(['position-affine','branch-offset','branch-affine']);
const fail=(ok,message)=>{if(!ok)throw new CycleWorkError(message);};
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const label=x=>typeof x==='string'&&x.trim().length>0&&x.length<=2000;
const fingerprint=r=>JSON.stringify(r.cycle.samples.map((p,i)=>[p.position,p.jointTorque,r.branches[i]]));
const feature=(kind,position,branch)=>kind==='position-affine'?[1,position]:kind==='branch-offset'?[1,position,branch]:[1,position,branch,position*branch];
function record(raw){
 fail(raw&&typeof raw.id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(raw.id),'Every cycle needs a stable acquisition ID.');
 const cycle=normalizeCycle(raw.cycle),branches=raw.branches;
 fail(Array.isArray(branches)&&branches.length===cycle.samples.length&&branches.every(s=>s===1||s===-1),'Declare +1 increasing or -1 decreasing branch for every original row.');
 const switches=[];for(let i=1;i<branches.length;i++)if(branches[i]!==branches[i-1])switches.push(i);
 fail(switches.length===1,'Declare exactly two contiguous monotone legs with one branch transition.');
 const turn=switches[0];fail(turn>=2&&turn<=branches.length-2,'Both branches need at least two original rows.');
 fail(cycle.samples[turn].position===cycle.samples[turn-1].position,'Retain separate endpoint readings at the same angle when the branch switches.');
 for(const [start,end] of [[0,turn],[turn,branches.length]]){
  let moved=false;
  for(let i=start+1;i<end;i++){const delta=cycle.samples[i].position-cycle.samples[i-1].position;fail(delta*branches[i]>=0,'An angular reversal cannot be hidden inside a declared branch.');moved ||= delta!==0;}
  fail(moved,'Every branch must span distinct angles.');
 }
 return {id:raw.id,cycle,branches:[...branches]};
}
function records(raw,labelText){
 fail(Array.isArray(raw)&&raw.length>=1&&raw.length<=8,labelText+' must contain 1–8 complete cycles.');
 const rows=raw.map(record),ids=new Set(),fingerprints=new Set();
 for(const r of rows){fail(!ids.has(r.id),'Cycle IDs must be distinct.');ids.add(r.id);const key=fingerprint(r);fail(!fingerprints.has(key),'Numerically identical cycle observations cannot supply separate replication in this receiver.');fingerprints.add(key);}
 fail(rows.reduce((n,r)=>n+r.cycle.samples.length,0)<=8192,labelText+' must contain at most 8192 original rows.');
 return rows;
}
export function normalizeBranchRequest(raw){
 const training=records(raw?.training,'Training'),settings=raw?.settings;
 fail(settings&&finite(settings.trainingRmsTolerance)&&settings.trainingRmsTolerance>=0&&settings.trainingRmsTolerance<=1e12&&finite(settings.receivingRmsTolerance)&&settings.receivingRmsTolerance>=0&&settings.receivingRmsTolerance<=1e12,'Declare finite nonnegative training and receiving RMS discrepancy tolerances in N·m, at most 1e12.');
 fail(label(settings.basis),'Declare the basis of both discrepancy tolerances.');
 return {training,settings:{trainingRmsTolerance:settings.trainingRmsTolerance,receivingRmsTolerance:settings.receivingRmsTolerance,basis:settings.basis.trim()}};
}
export function predictBranchResponse(model,position,branch){
 fail(BRANCH_FAMILIES.includes(model?.family)&&Array.isArray(model.coefficients),'An executable fitted branch response is required.');
 fail(finite(position)&&(branch===1||branch===-1),'A finite angle and declared branch are required.');
 const terms=feature(model.family,position,branch);
 fail(model.coefficients.length===terms.length&&model.coefficients.every(finite),'Invalid response coefficients.');
 const contributions=terms.map((v,i)=>v*model.coefficients[i]),prediction=contributions.reduce((a,b)=>a+b,0);
 fail(Number.isFinite(prediction),'Response prediction overflowed.');
 const guard=128*Number.EPSILON*Math.max(1,...contributions.map(Math.abs),Math.abs(prediction));
 return {prediction,guard};
}
function score(model,rec,tolerance,ranges){
 if(!model.coefficients)return {id:rec.id,status:'rank-deficient',rows:[],count:rec.cycle.samples.length,work:{observed:evaluateCycle(rec.cycle),predicted:null},reason:'Training columns do not identify this declared family.'};
 const rows=rec.cycle.samples.map((p,i)=>{
  const {prediction,guard:predictionGuard}=predictBranchResponse(model,p.position,rec.branches[i]);
  const residual=prediction-p.jointTorque,guard=predictionGuard+128*Number.EPSILON*Math.max(1,Math.abs(prediction),Math.abs(p.jointTorque),p.torqueRadius);
  const magnitude=Math.abs(residual),range=ranges[String(rec.branches[i])];
  return {row:i,branch:rec.branches[i],position:p.position,observed:p.jointTorque,torqueRadius:p.torqueRadius,prediction,residual,guard,
   lowerError:Math.max(0,magnitude-p.torqueRadius-guard),upperError:magnitude+p.torqueRadius+guard,
   outsideTrainingRange:p.position<range[0]||p.position>range[1]};
 });
 const rms=key=>Math.hypot(...rows.map(r=>r[key]))/Math.sqrt(rows.length);
 const rmse=rms('residual'),lower=rms('lowerError'),upper=rms('upperError');
 const outside=rows.filter(r=>r.outsideTrainingRange).length;
 let predicted=null,workFailure=null;
 try{predicted=evaluateCycle({...rec.cycle,source:'Frozen '+model.family+' predictions at supplied angles/branches; not acquired readings',samples:rows.map(r=>({position:r.position,jointTorque:r.prediction,torqueRadius:0}))});}catch(e){workFailure=e.message;}
 return {id:rec.id,status:outside?'outside-training-range':lower>tolerance?'incompatible':upper<=tolerance?'compatible':'unresolved',rows,count:rows.length,rmse,errorInterval:[lower,upper],tolerance,outsideTrainingRows:outside,
  work:{observed:evaluateCycle(rec.cycle),predicted,failure:workFailure}};
}
export function freezeBranchResponses(raw){
 const request=normalizeBranchRequest(raw),flat=request.training.flatMap(r=>r.cycle.samples.map((p,i)=>({...p,branch:r.branches[i]})));
 const ranges=Object.fromEntries([1,-1].map(s=>{const positions=flat.filter(p=>p.branch===s).map(p=>p.position);return [String(s),[Math.min(...positions),Math.max(...positions)]];}));
 const models=BRANCH_FAMILIES.map(family=>{
  const design=flat.map(p=>feature(family,p.position,p.branch));
  const fitted=fitLinearColumns(design[0].map((_,i)=>design.map(row=>row[i])),flat.map(p=>p.jointTorque));
  const model={family,coefficients:fitted?.coefficients??null,conditionEstimate:fitted?.conditionEstimate??null};
  const training=request.training.map(r=>score(model,r,request.settings.trainingRmsTolerance,ranges));
  return {...model,training,status:!fitted?'rank-deficient':training.some(r=>r.status==='incompatible')?'incompatible':training.every(r=>r.status==='compatible')?'compatible':'unresolved'};
 });
 return {request,ranges,models,scope:'Nominal QR fits in an explicit three-family library. Training reading boxes qualify residuals around each frozen nominal fit, not coefficient uncertainty. Branch labels do not identify friction, physical hysteresis or a time-dependent law.'};
}
export function reopenBranchResponses(raw){
 fail(raw?.schema===BRANCH_RESPONSE_SCHEMA,'Expected '+BRANCH_RESPONSE_SCHEMA+'.');
 const frozen=freezeBranchResponses(raw.request);let acquisition=null,receiving=[];
 if(raw.acquisition){
  fail(raw.acquisition.assumption===BRANCH_RECEIVING_ASSUMPTION,'Receiving must declare separately acquired cycles not used for fitting.');
  fail(JSON.stringify(raw.acquisition.request)===JSON.stringify(frozen.request),'Receiving belongs to a stale or modified frozen training request.');
  const acquired=records(raw.acquisition.records,'Receiving'),ids=new Set(frozen.request.training.map(r=>r.id)),seen=new Set(frozen.request.training.map(fingerprint));
  for(const r of acquired){fail(!ids.has(r.id),'A receiving acquisition ID duplicates training.');fail(!seen.has(fingerprint(r)),'Receiving observations are numerically identical to training; separate evidence is not established by this receiver.');}
  acquisition={request:frozen.request,assumption:BRANCH_RECEIVING_ASSUMPTION,records:acquired};
  receiving=frozen.models.map(model=>({family:model.family,trainingStatus:model.status,cycles:acquired.map(r=>score(model,r,frozen.request.settings.receivingRmsTolerance,frozen.ranges))}));
 }
 const bundle={schema:BRANCH_RESPONSE_SCHEMA,request:frozen.request,acquisition};
 fail(new TextEncoder().encode(JSON.stringify(bundle)).byteLength<=2000000,'Complete normalized branch-response notebook exceeds the 2 MB receiver limit. No evidence was removed.');
 return {bundle,frozen,receiving,
  scope:'All declared candidates and all per-cycle outcomes are retained. Receiving only scores unchanged models at supplied exact angles and branches; it never refits or selects a winner. Both source identity and independence are declarations, not authenticated acquisition.'};
}
export function importBranchResponses(text){
 fail(typeof text==='string'&&new TextEncoder().encode(text).byteLength<=2000000,'Branch-response JSON must be at most 2 MB UTF-8.');
 return reopenBranchResponses(JSON.parse(text));
}
export function exportBranchResponses(raw){
 const text=JSON.stringify(reopenBranchResponses(raw).bundle);fail(new TextEncoder().encode(text).byteLength<=2000000,'Branch-response export exceeds the 2 MB receiver limit. No evidence was removed.');return text;
}
