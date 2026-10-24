/** Finite two-coordinate quasi-static torque hypotheses. No hardware authority. */
import {fitLinearColumns, linearColumnRank, RANK_TOLERANCE} from '../science/linear-fit.mjs';

export const STRUCTURES = Object.freeze([
  Object.freeze({id:'independent', label:'Independent responses', terms:['k11','k22','b1','b2']}),
  Object.freeze({id:'reciprocal', label:'Reciprocal coupling', terms:['k11','k22','cross','b1','b2']}),
  Object.freeze({id:'directional', label:'Directional coupling', terms:['k11','k22','k12','k21','b1','b2']}),
]);
export const UNITS = Object.freeze({position:'rad', torque:'N·m'});
export class CouplingError extends Error {
  constructor(message, code='invalid_input') { super(message); this.name='CouplingError'; this.code=code; }
}
export function requireThat(condition, message, code) { if (!condition) throw new CouplingError(message, code); }
export function finite(value, name, bound=1e6) {
  requireThat(typeof value==='number' && Number.isFinite(value) && Math.abs(value)<=bound, `${name} must be finite with magnitude at most ${bound}.`);
  return value;
}
export function pair(value, name, bound=1e6) {
  requireThat(Array.isArray(value) && value.length===2, `${name} must have two coordinates.`);
  return value.map((v,i)=>finite(v,`${name}[${i}]`,bound));
}
export function observation(value) {
  requireThat(value && typeof value==='object' && !Array.isArray(value), 'Each observation must be an object.');
  requireThat(typeof value.id==='string' && value.id.trim().length>0 && value.id.length<=120, 'Each observation needs a nonempty ID of at most 120 characters.');
  return {id:value.id, q:pair(value.q,'q'), torque:pair(value.torque,'torque',1e12)};
}
function samples(value, minimum=0) {
  requireThat(Array.isArray(value) && value.length>=minimum && value.length<=2048, `Supply ${minimum}–2048 observations.`);
  const result=value.map(observation);
  requireThat(new Set(result.map(row=>row.id)).size===result.length, 'Observation IDs must be unique.');
  return result;
}
function features(term, q, axis) {
  switch(term) {
    case 'k11': return axis===0?q[0]:0;
    case 'k22': return axis===1?q[1]:0;
    case 'k12': return axis===0?q[1]:0;
    case 'k21': return axis===1?q[0]:0;
    case 'cross': return axis===0?q[1]:q[0];
    case 'b1': return axis===0?1:0;
    case 'b2': return axis===1?1:0;
    default: throw new CouplingError('Unknown response term.');
  }
}
function columns(rows, terms) { return terms.map(term=>rows.flatMap(row=>[features(term,row.q,0),features(term,row.q,1)])); }
function modelOf(structure, coefficients, domain) {
  const values=Object.fromEntries(structure.terms.map((term,i)=>[term,coefficients[i]]));
  return {schema:'worldlaw.coupled-torque-model/v1',id:structure.id,label:structure.label,
    matrix:[[values.k11,values.cross??values.k12??0],[values.cross??values.k21??0,values.k22]],
    bias:[values.b1,values.b2],units:UNITS,domain};
}
function checkedModel(raw) {
  requireThat(raw?.schema==='worldlaw.coupled-torque-model/v1' && STRUCTURES.some(s=>s.id===raw.id), 'Invalid coupled response model.');
  requireThat(Array.isArray(raw.matrix) && raw.matrix.length===2, 'Response matrix must be two by two.');
  const matrix=raw.matrix.map((row,i)=>pair(row,`matrix[${i}]`,1e18));
  const bias=pair(raw.bias,'bias',1e18);
  requireThat(raw.id!=='independent' || (matrix[0][1]===0 && matrix[1][0]===0), 'Independent model contains cross terms.');
  requireThat(raw.id!=='reciprocal' || matrix[0][1]===matrix[1][0], 'Reciprocal model has unequal cross terms.');
  return {matrix,bias};
}
function predicted(model,q) {
  const result=model.matrix.map((row,i)=>row[0]*q[0]+row[1]*q[1]+model.bias[i]);
  requireThat(result.every(Number.isFinite), 'Response prediction overflowed.', 'numerical_failure');
  return result;
}
export function predictCoupling(model, q) { return predicted(checkedModel(model),pair(q,'q')); }
export function evaluateCoupling(model, rawRows) {
  const valid=checkedModel(model), rows=samples(rawRows);
  const results=rows.map(row=>{ const prediction=predicted(valid,row.q); return {...row,prediction,residual:row.torque.map((v,i)=>v-prediction[i])}; });
  const sum=[0,0], maxima=[0,0];
  for(const row of results) for(let axis=0;axis<2;axis++) {sum[axis]+=row.residual[axis]**2;maxima[axis]=Math.max(maxima[axis],Math.abs(row.residual[axis]));}
  const n=rows.length;
  return {count:n,rmse:n?Math.sqrt((sum[0]+sum[1])/(2*n)):null,axisRmse:sum.map(v=>n?Math.sqrt(v/n):null),maxAbsResidual:n?Math.max(...maxima):null,rows:results};
}
export function discoverCoupling(rawRows, rawOptions={}) {
  const rows=samples(rawRows,8);
  requireThat(rawOptions && typeof rawOptions==='object' && !Array.isArray(rawOptions),'Options must be an object.');
  const options={noiseSigma:rawOptions.noiseSigma??0.025, ambiguityDelta:rawOptions.ambiguityDelta??6};
  finite(options.noiseSigma,'noiseSigma');finite(options.ambiguityDelta,'ambiguityDelta',100);
  requireThat(options.noiseSigma>=1e-12 && options.ambiguityDelta>=0, 'Noise must be positive and ambiguity delta nonnegative.');
  const domain=[0,1].map(axis=>({min:Math.min(...rows.map(r=>r.q[axis])),max:Math.max(...rows.map(r=>r.q[axis]))}));
  const target=rows.flatMap(row=>row.torque), candidates=[], refused=[];
  for(const structure of STRUCTURES) {
    const design=columns(rows,structure.terms),rank=linearColumnRank(design);
    const fitted=fitLinearColumns(design,target);
    if(!fitted || fitted.coefficients.some(c=>!Number.isFinite(c)||Math.abs(c)>1e18)) {
      refused.push({id:structure.id,label:structure.label,rank,parameters:structure.terms.length,reason:rank<structure.terms.length?'insufficient_excitation':'numerical_failure'});
      continue;
    }
    const model=modelOf(structure,fitted.coefficients,domain), score=evaluateCoupling(model,rows);
    model.metrics={...score,rows:undefined,parameters:structure.terms.length,rank,conditionEstimate:fitted.conditionEstimate,
      score:target.length*Math.log(Math.max(score.rmse**2,options.noiseSigma**2))+structure.terms.length*Math.log(target.length)};
    delete model.metrics.rows;
    candidates.push(model);
  }
  candidates.sort((a,b)=>a.metrics.score-b.metrics.score || a.metrics.parameters-b.metrics.parameters);
  const selected=candidates[0]??null;
  const competitive=selected?candidates.filter(m=>m.metrics.score-selected.metrics.score<=options.ambiguityDelta):[];
  const fullRank=linearColumnRank(columns(rows,STRUCTURES[2].terms));
  return {schema:'worldlaw.coupling-discovery/v1',observations:rows,options,domain,candidates,refused,selected,competitive,
    diagnostics:{fullRank,libraryColumns:6,rankTolerance:RANK_TOLERANCE,identifiability:fullRank<6?'insufficient_excitation':'finite_library_local_only',
      adequacy:!selected?'unidentifiable':selected.metrics.rmse>3*options.noiseSigma?'residual_mismatch':'not_falsified_on_training',
      scoreMethod:'2*n*log(max(training_mse,noise_sigma^2))+parameter_count*log(2*n)',
      limitations:['Only three affine quasi-static response families are offered.','Equal angle/torque units and a common coordinate convention are caller assumptions.',
        'Reciprocal coefficients do not prove a passive mechanism or its topology.','Noisy input coordinates, unobserved rates, drift or nonlinear responses can invalidate these hypotheses.',
        'Rank and model spread are not physical identifiability or calibrated probability.']}};
}
export function planCoupling(discovery, rawPermitted) {
  requireThat(discovery?.schema==='worldlaw.coupling-discovery/v1','Expected a coupling discovery.');
  requireThat(Array.isArray(rawPermitted) && rawPermitted.length<=512,'At most 512 explicitly permitted angle pairs are supported.');
  const permitted=rawPermitted.map((q,i)=>pair(q,`permitted[${i}]`));
  if(!permitted.length)return {status:'no_permitted_inputs',selected:null,ranked:[],method:'training_only_finite_input_disagreement'};
  const models=discovery.competitive, needsExcitation=discovery.diagnostics.fullRank<6;
  const ranked=permitted.map((q,index)=>{
    const predictions=models.map(model=>({modelId:model.id,torque:predictCoupling(model,q)}));
    let disagreement=0;
    for(let i=0;i<predictions.length;i++)for(let j=0;j<i;j++)disagreement=Math.max(disagreement,Math.hypot(...predictions[i].torque.map((v,a)=>v-predictions[j].torque[a])));
    const rank=needsExcitation?linearColumnRank(columns([...discovery.observations,{q}],STRUCTURES[2].terms)):discovery.diagnostics.fullRank;
    return {index,q,predictions,disagreement,rankGain:rank-discovery.diagnostics.fullRank,
      extrapolatedAxes:q.flatMap((v,a)=>v<discovery.domain[a].min||v>discovery.domain[a].max?[a]:[])};
  });
  ranked.sort((a,b)=>(needsExcitation?b.rankGain-a.rankGain:0)||b.disagreement-a.disagreement||a.index-b.index);
  const best=ranked[0];
  const status=needsExcitation?(best.rankGain>0?'needs_excitation':'insufficient_excitation'):
    !discovery.selected?'unexecutable_models':discovery.diagnostics.adequacy==='residual_mismatch'?'model_mismatch':
      models.length>1 && best.disagreement>2*Math.SQRT2*discovery.options.noiseSigma?'proposed':'uninformative';
  return {status,selected:best,ranked,method:needsExcitation?'training_design_rank_gain':'training_only_finite_input_disagreement',
    interpretation:'Only caller-permitted inputs. The proposal is a numerical question, not a physical safety decision.'};
}
