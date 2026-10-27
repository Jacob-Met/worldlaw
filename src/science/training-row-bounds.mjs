import {challengeCourseContext} from './challenge-course.mjs';
import {prepareSharedTraining,checkLinearEnvelopeOffsets,checkLinearEnvelopeSeparator} from './shared-training-check.mjs';
import {searchPreparedLinearEnvelope} from './shared-training-search.mjs';
import {fitLinearColumns} from './linear-fit.mjs';
import {evaluate} from './torque-discovery.mjs';
const SCHEMA='worldlaw.training-row-bounds/v1',CERT='worldlaw.training-row-bounds-certificate/v1',LIMIT=2000000;
const radius=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1e6;
function prepare(source){
 if(!source||source.schema!==SCHEMA||!radius(source.trainingRadius)||!Array.isArray(source.receiving)||source.receiving.length<1||source.receiving.length>128||!Array.isArray(source.rowSources)||source.rowSources.length!==source.receiving.length||!Array.isArray(source.declarations)||source.declarations.length<1||source.declarations.length>128)throw Error('Declare the complete bounded original challenge precision source.');
 const ids=[...new Set(source.rowSources.map(r=>r.eventIndex))];
 if(source.rowSources.some(r=>!Number.isInteger(r.eventIndex)||r.eventIndex<1||!Number.isInteger(r.rowIndex)||r.rowIndex<0)||ids.length!==source.declarations.length)throw Error('Declare exactly one original bound source per challenge.');
 const declarations=source.declarations.map((d,i)=>{if(!d||d.eventIndex!==ids[i]||!radius(d.radius)||typeof d.basis!=='string'||!d.basis.trim()||d.basis.length>1000)throw Error('Each retained challenge needs an explicit finite radius and source basis in original order.');return{eventIndex:d.eventIndex,radius:d.radius,basis:d.basis.trim()};});
 if(!Array.isArray(source.training)||source.training.length<1||source.training.length>4096||!Array.isArray(source.trainingDeclarations)||source.trainingDeclarations.length!==source.training.length)throw Error('Supply one sourced bound for every original training row.');
 const trainingDeclarations=source.trainingDeclarations.map((d,i)=>{if(!d||d.rowIndex!==i||!radius(d.radius)||typeof d.basis!=='string'||!d.basis.trim()||d.basis.length>1000)throw Error('Original training row identity, radius and basis must be complete and ordered.');return{rowIndex:i,radius:d.radius,basis:d.basis.trim()};});
 const trainingRadii=trainingDeclarations.map(d=>d.radius);
 if(source.trainingRadius!==Math.max(...trainingRadii))throw Error('Preparation radius must equal the complete original-row maximum.');
 const receivingRadii=source.rowSources.map(r=>declarations.find(d=>d.eventIndex===r.eventIndex).radius),context=prepareSharedTraining(source.model,source.training,source.receiving,{trainingRadius:source.trainingRadius,receivingRadius:Math.max(...receivingRadii)});
 if(context.status!=='prepared')return {...context,status:'unavailable'};
 const canonical={schema:SCHEMA,model:JSON.parse(context.sourceKey).model,training:context.training,receiving:context.receiving,trainingRadius:source.trainingRadius,trainingDeclarations,rowSources:source.rowSources.map(({eventIndex,rowIndex})=>({eventIndex,rowIndex})),declarations};
 return {...context,source:canonical,sourceKey:JSON.stringify(canonical),receivingRadii,trainingRadii,normalizedRows:context.marginal.rows.map(row=>{const influence=row.influence.map((x,i)=>x*trainingRadii[i]);const allowance=512*Number.EPSILON*Math.max(1,influence.reduce((sum,x)=>sum+Math.abs(x),0));return{...row,influence,numericalTolerance:row.numericalTolerance+allowance};})};
}
export function trainingRowBoundsContext(state,eventIndex,modelIndex,throughEvent,trainingDeclarations,declarations){
 const c=challengeCourseContext(state,eventIndex,modelIndex,throughEvent);if(c.status!=='available')return c;
 return prepare({schema:SCHEMA,model:c.model,training:c.training,receiving:c.receiving,trainingRadius:Math.max(...trainingDeclarations.map(d=>d.radius)),trainingDeclarations,rowSources:c.rowSources,declarations});
}
function checkPrepared(c,certificate){
 if(!certificate||certificate.schema!==CERT||certificate.sourceKey!==c.sourceKey||!['training-offsets','receiving-separator'].includes(certificate.kind)||!Array.isArray(certificate.values))throw Error('Certificate source, complete course or declared per-challenge bounds differ.');
 const v=certificate.values,offset=certificate.kind==='training-offsets';if(v.length!==(offset?c.training.length:c.receiving.length)||v.some((x,i)=>!Number.isFinite(x)||Math.abs(x)>(offset?c.trainingRadii[i]:1))||(!offset&&!v.some(x=>x!==0)))throw Error('Certificate vector exceeds its complete declared bounds.');
 let result;
 if(!offset)result=checkLinearEnvelopeSeparator(c.normalizedRows,v,1,c.receivingRadii);
 else{const fit=fitLinearColumns(c.columns,c.training.map((r,i)=>r.jointTorque+v[i]));if(!fit)return{status:'unresolved',reason:'independent-refit-rank-unavailable'};const model={...c.model,terms:c.model.terms.map((t,i)=>({id:t.id,coefficient:fit.coefficients[i]}))};const predictions=evaluate(model,c.receiving).rows.map(r=>r.prediction);result=checkLinearEnvelopeOffsets(c.marginal.rows,v,c.receivingRadii,predictions,fit.coefficients);}
 return {...result,qualification:'Computed fixed-coordinate least-squares family with separately declared original training-row and challenge radii. Numerical engineering checks do not certify QR error, measured calibration or physical adequacy.'};
}
export function checkTrainingRowBounds(source,certificate){const c=prepare(source);if(c.status!=='prepared')throw Error('Original precision source cannot prepare the maintained envelope.');return checkPrepared(c,certificate);}
export function searchTrainingRowBounds(state,eventIndex,modelIndex,throughEvent,trainingDeclarations,declarations,budgets={}){
 const c=trainingRowBoundsContext(state,eventIndex,modelIndex,throughEvent,trainingDeclarations,declarations);if(c.status!=='prepared')return{status:'unavailable',reason:c.reason};
 if(Object.keys(budgets).some(k=>!['maxIterations','maxProducts'].includes(k)))throw Error('Declare only iteration and matrix-term budgets.');
 const declared={maxIterations:budgets.maxIterations??512,maxProducts:budgets.maxProducts??16777216};
 const normalized={...c,marginal:{...c.marginal,rows:c.normalizedRows,settings:{...c.marginal.settings,trainingRadius:1}}};
 return searchPreparedLinearEnvelope(normalized,declared,{status:'unresolved',source:c.source,interpretation:'One common original-training perturbation under each sourced original training-row and challenge radius; not a refit adoption or prospective guarantee.'},{makeCertificate:(kind,values)=>({schema:CERT,sourceKey:c.sourceKey,kind,values:kind==='training-offsets'?values.map((x,i)=>x*c.trainingRadii[i]):[...values]}),checkCandidate:certificate=>checkPrepared(c,certificate),recheck:certificate=>checkTrainingRowBounds(c.source,certificate)});
}
export function serializeTrainingRowBounds(certificate){const source=JSON.parse(certificate.sourceKey);const check=checkTrainingRowBounds(source,certificate);if(!['verified-interior-witness','verified-separation'].includes(check.status))throw Error('Only independently checked evidence can be saved.');const raw=JSON.stringify({schema:SCHEMA,source,certificate},null,2);if(new TextEncoder().encode(raw).length>LIMIT)throw Error('Precision evidence exceeds2000000bytes.');return raw;}
export function replayTrainingRowBounds(raw){if(typeof raw!=='string'||new TextEncoder().encode(raw).length>LIMIT)throw Error('Choose precision evidence up to2000000bytes.');const x=JSON.parse(raw);if(x.schema!==SCHEMA)throw Error('Choose original challenge precision evidence.');const check=checkTrainingRowBounds(x.source,x.certificate);if(!['verified-interior-witness','verified-separation'].includes(check.status))throw Error('Saved candidate did not pass the public checker.');return{source:prepare(x.source).source,certificate:x.certificate,check};}
