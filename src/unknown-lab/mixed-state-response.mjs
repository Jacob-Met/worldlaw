import {validateNotebook, evaluateHistory, exportNotebook} from './paired-history.mjs';
import {fitLinearColumns} from '../science/linear-fit.mjs';

export const MIXED_SCHEMA='worldlaw.mixed-state-response/v1';
export const RESPONSE_TERMS=Object.freeze([
 {id:'offset',label:'constant',units:'N·m',value:()=>1},
 {id:'command',label:'command',units:'N·m / command unit',value:p=>p.command},
 {id:'restoring',label:'sin(position)',units:'N·m',value:p=>Math.sin(p.position)},
 {id:'rate',label:'rate',units:'N·m·s/rad',value:p=>p.rate},
]);
const require=(ok,message)=>{if(!ok)throw Error(message);};
function admit(raw){
 const n=validateNotebook(raw);
 require(n.pairs.every(p=>['command','position','rate'].every(k=>p.reference[k]===p.conditioned[k])), 'Conditional fitting requires exactly matched original coordinates within every pair; a tolerance is not response calibration.');
 require(n.pairs.every(p=>p.reference.sampleIndex!==undefined),'Conditional fitting requires original acquisition order.');
 const plus=n.pairs.filter(p=>p.conditioned.sampleIndex>p.reference.sampleIndex).length;
 require(plus>=4&&n.pairs.length-plus>=4,'Retain at least four original pairs in each acquisition order.');
 return n;
}
const evidenceKey=n=>new Set(n.trials.map(t=>JSON.stringify([t.history,t.command,t.position,t.rate,t.jointTorque])));
export function validateMixedStudy(raw){
 require(raw?.schema===MIXED_SCHEMA,'Expected a mixed-state preparation response study.');
 require(typeof raw.protocol==='string'&&raw.protocol.trim().length>=8&&raw.protocol.length<=1000,'Describe the shared fixed preparation and readout protocol (8–1000 characters).');
 const training=admit(raw.training),challenge=raw.challenge==null?null:admit(raw.challenge);
 if(challenge){
  require(training.source===challenge.source,'Keep measured and synthetic sources separate.');
  const keys=evidenceKey(training);
  require(![...evidenceKey(challenge)].some(k=>keys.has(k)),'Challenge contains exact original training reading evidence; renamed pairs are not new acquisitions.');
 }
 return {schema:MIXED_SCHEMA,protocol:raw.protocol,training:JSON.parse(exportNotebook(training)),challenge:challenge?JSON.parse(exportNotebook(challenge)):null};
}
function rows(raw){return admit(raw).pairs.map(p=>({id:p.id,state:{command:p.reference.command,position:p.reference.position,rate:p.reference.rate},difference:p.difference,order:p.conditioned.sampleIndex-p.reference.sampleIndex}));}
export function predictMixedResponse(model,state){
 require(model?.status==='fitted','A ranked, finite conditional model is required.');
 require(['command','position','rate'].every(k=>typeof state?.[k]==='number'&&Number.isFinite(state[k])&&Math.abs(state[k])<=1e6),'Use bounded finite declared query coordinates.');
 return model.terms.reduce((s,id,i)=>s+model.coefficients[i]*RESPONSE_TERMS.find(t=>t.id===id).value(state),0);
}
export function fitMixedResponse(training){
 // Training-only callable contract: no challenge object is accepted or read.
 const n=admit(training),data=rows(n),count=data.length,target=data.map(p=>p.difference),order=data.map(p=>p.order),noiseFloor=2*n.noiseSigma**2;
 const candidates=[];
 for(let mask=0;mask<16;mask++){
  const terms=RESPONSE_TERMS.filter((_,i)=>mask&(1<<i)),columns=terms.map(t=>data.map(p=>t.value(p.state)));
  const fit=fitLinearColumns([...columns,order],target),id=terms.map(t=>t.id).join('+')||'no-response';
  if(!fit){candidates.push({id,terms:terms.map(t=>t.id),status:'rank-unresolved',score:null});continue;}
  const coefficients=fit.coefficients.slice(0,-1),drift=fit.coefficients.at(-1),model={id,terms:terms.map(t=>t.id),status:'fitted',coefficients,drift,conditionEstimate:fit.conditionEstimate};
  const residuals=data.map(p=>({id:p.id,observed:p.difference,response:predictMixedResponse(model,p.state),order:p.order})).map(p=>({...p,prediction:p.response+drift*p.order})).map(p=>({...p,residual:p.observed-p.prediction}));
  const sse=residuals.reduce((s,p)=>s+p.residual**2,0),score=count*Math.log(Math.max(sse/count,noiseFloor))+(terms.length+1)*Math.log(count);
  if(!Number.isFinite(score)||!Number.isFinite(sse)){candidates.push({id,terms:model.terms,status:'arithmetic-unresolved',score:null});continue;}
  candidates.push({...model,score,rmse:Math.sqrt(sse/count),residuals});
 }
 const ranked=candidates.filter(c=>c.status==='fitted').sort((a,b)=>a.score-b.score||a.terms.length-b.terms.length||candidates.indexOf(a)-candidates.indexOf(b));
 const selected=ranked[0]??null,screen=3*Math.SQRT2*n.noiseSigma;
 return {candidates,selected,constant:candidates.find(c=>c.id==='offset'),original:evaluateHistory(n),count,
  trainingScreen:{threshold:screen,status:!selected?'unresolved':selected.rmse>screen?'library-mismatch':'within-declared-screen',meaning:'Training RMS compared to three times the declared paired reading-noise scale. This is a diagnostic, not a calibrated test or proof of an adequate law.'},
  selection:'Complete 16-subset finite comparison, with a shared linear-per-reading drift nuisance term. Training score is n·log(max(MSE,2·declared sigma²)) + parameter count·log(n); it is a heuristic ranking, not calibrated confidence or proof of physical structure.'};
}
export function analyzeMixedStudy(raw){
 const source=validateMixedStudy(raw),fit=fitMixedResponse(source.training),challenge=source.challenge?rows(source.challenge):null;
 const tests=challenge?fit.candidates.map(model=>{
  if(model.status!=='fitted')return {id:model.id,status:'not-admitted'};
  const points=challenge.map(p=>{const response=predictMixedResponse(model,p.state),prediction=response+model.drift*p.order;return {id:p.id,state:p.state,observed:p.difference,response,prediction,residual:p.difference-prediction};});
  const rmse=Math.sqrt(points.reduce((s,p)=>s+p.residual**2,0)/points.length);
  return {id:model.id,status:Number.isFinite(rmse)?'scored':'arithmetic-unresolved',rmse:Number.isFinite(rmse)?rmse:null,points};
 }):[];
 return {source,fit,tests,qualification:'Exactly matched paired coordinates; fixed declared preparation/readout; additive conditional response and constant per-reading drift. Challenge scores freeze both response and drift coefficients. Changed drift, nonlinear preparation effects, order interactions, carryover and confounding may invalidate these hypotheses. User-declared provenance is not independent acquisition authentication.'};
}
export function exportMixedStudy(raw){return JSON.stringify(validateMixedStudy(raw),null,2)+'\n';}
export function importMixedStudy(text){require(typeof text==='string'&&new TextEncoder().encode(text).length<=1000000,'Use original mixed-state JSON at most 1 MB.');return validateMixedStudy(JSON.parse(text));}
