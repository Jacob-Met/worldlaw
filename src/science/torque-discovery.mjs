import {fitInputOriginColumns,inputOriginWork} from './input-origin-fit.mjs';
import {splitResidual} from './split-multicolumn.mjs';
import {fitHeterogeneousColumns,heterogeneousWork} from './heterogeneous-fit.mjs';
import {fitSharedIterationColumns as fitContinuationColumns} from './shared-iteration-fit.mjs';
import {fitSharedIterationColumns as fitCompleteColumns,sharedIterationWork} from './curvature-fit.mjs';
import {prepareContinuationPredictor} from './continuation-fit.mjs';
import {fitCenteredResponse} from './centered-response.mjs';
import {outputIntervalCount} from './output-grid.mjs';
/**
 * Bounded structural discovery for scalar torque laws. Dependency-free browser ESM.
 * This searches a declared feature library; it does not infer mechanism topology.
 * No held-out observations are accepted by the fitting API.
 */
export const TERMS = Object.freeze([
  { id: 'command', label: 'u', coefficientUnit: '1' },
  { id: 'rate', label: 'ω', coefficientUnit: 'N·m·s/rad' },
  { id: 'coulomb', label: 'sign(ω)', coefficientUnit: 'N·m' },
  { id: 'spring', label: 'θ', coefficientUnit: 'N·m/rad' },
  { id: 'gravity', label: 'sin(θ)', coefficientUnit: 'N·m' },
  { id: 'quadratic', label: 'ω|ω|', coefficientUnit: 'N·m·s²/rad²' },
  { id: 'bias', label: '1', coefficientUnit: 'N·m' },
  { id: 'command_position', label: 'uθ', coefficientUnit: '1/rad', optional: true },
  { id: 'rate_squared', label: 'ω²', coefficientUnit: 'N·m·s²/rad²', optional: true },
  { id: 'cosine', label: 'cos(θ)', coefficientUnit: 'N·m', optional: true },
  { id: 'cubic', label: 'θ³', coefficientUnit: 'N·m/rad³', optional: true },
].map(Object.freeze));
export const DEFAULT_TERMS = Object.freeze(TERMS.filter(term => !term.optional).map(term => term.id));
export const UNITS = Object.freeze({command:'N·m', position:'rad', rate:'rad/s', jointTorque:'N·m'});
const ids = TERMS.map(t => t.id);
const LIMIT = 4096;
import {fitLinearColumns as fit, linearColumnRank as libraryRank, RANK_TOLERANCE} from './linear-fit.mjs';
import {fitSoftL1Columns, softL1Loss, softL1Weight, softL1Work, SOFT_L1_MAX_WORK} from './robust-fit.mjs';
const fields = ['command', 'position', 'rate'];
const observedFields = [...fields, 'jointTorque', 'torqueNoiseRatio'];
// Only private, freshly computed least-squares fits are reused. Robust fits
// deliberately rerun the complete bounded optimization on every refit.
const fittedSources = new WeakMap();

export class DiscoveryError extends Error {
  constructor(message, code = 'invalid_input') { super(message); this.name = 'DiscoveryError'; this.code = code; }
}
function requireThat(value, message, code) { if (!value) throw new DiscoveryError(message, code); }
function finite(value, name, bound = 1e12) {
  requireThat(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= bound,
    `${name} must be a finite number with magnitude at most ${bound}.`);
  return value;
}
function input(row, observed = false) {
  requireThat(row && typeof row === 'object' && !Array.isArray(row), 'Each observation/input must be an object.');
  const result = Object.fromEntries(fields.map(key => [key, finite(row[key], key, 1e6)]));
  if (observed) {
    result.jointTorque = finite(row.jointTorque, 'jointTorque');
    if (Object.hasOwn(row, 'torqueNoiseRatio')) {
      result.torqueNoiseRatio = finite(row.torqueNoiseRatio, 'torqueNoiseRatio', 1e6);
      requireThat(result.torqueNoiseRatio >= 1e-6, 'torqueNoiseRatio must be between 0.000001 and 1000000.');
    }
  }
  return result;
}
function rows(values, minimum = 0) {
  requireThat(Array.isArray(values) && values.length >= minimum && values.length <= LIMIT,
    `Expected between ${minimum} and ${LIMIT} observations.`);
  const samples = values.map(row => input(row, true));
  requireThat(!samples.some(row => row.torqueNoiseRatio !== undefined) || samples.every(row => row.torqueNoiseRatio !== undefined),
    'Declare a torqueNoiseRatio for every row in this observation group, or omit it from every row.');
  return samples;
}
function feature(id, row) {
  switch (id) {
    case 'command': return row.command;
    case 'command_position': return row.command * row.position;
    case 'rate': return row.rate;
    case 'coulomb': return Math.sign(row.rate);
    case 'spring': return row.position;
    case 'gravity': return Math.sin(row.position);
    case 'cosine': return Math.cos(row.position);
    case 'cubic': return row.position ** 3;
    case 'quadratic': return row.rate * Math.abs(row.rate);
    case 'rate_squared': return row.rate * row.rate;
    case 'bias': return 1;
    default: throw new DiscoveryError(`Unknown feature ${id}.`);
  }
}
function norm(a) { return Math.hypot(...a); }
function normalizeOptions(options = {}) {
  requireThat(options && typeof options === 'object' && !Array.isArray(options), 'Options must be an object.');
  const terms = options.terms === undefined ? [...DEFAULT_TERMS] : options.terms;
  requireThat(Array.isArray(terms) && terms.length > 0 && terms.length <= ids.length &&
    new Set(terms).size === terms.length && terms.every(id => ids.includes(id)), 'terms must be unique known feature IDs.');
  const result = {
    terms: [...terms], noiseSigma: options.noiseSigma ?? 0.01,
    maxTerms: options.maxTerms ?? Math.min(4, terms.length), ambiguityDelta: options.ambiguityDelta ?? 6,
  };
  finite(result.noiseSigma, 'noiseSigma', 1e6);
  requireThat(result.noiseSigma > 0 && result.noiseSigma >= 1e-12, 'noiseSigma must be at least 1e-12 N·m.');
  requireThat(Number.isInteger(result.maxTerms) && result.maxTerms >= 0 && result.maxTerms <= terms.length,
    'maxTerms must be an integer between zero and the feature-library size.');
  finite(result.ambiguityDelta, 'ambiguityDelta', 100);
  requireThat(result.ambiguityDelta >= 0, 'ambiguityDelta must be nonnegative.');
  requireThat(options.loss === undefined || ['least_squares', 'soft_l1', 'weighted_least_squares'].includes(options.loss), 'Unknown reading-loss assumption.');
  if (options.loss === 'weighted_least_squares') result.loss = 'weighted_least_squares';
  if (options.loss === 'soft_l1') {
    finite(options.lossScale, 'lossScale', 1e6);
    requireThat(options.lossScale >= 1e-7, 'Declare a soft-L1 scale of at least 0.0000001 N·m.');
    result.loss = 'soft_l1'; result.lossScale = options.lossScale;
  }
  return result;
}

export function discoveryRobustWork(rowCount, requestedOptions = {}) {
  const options = normalizeOptions(requestedOptions);
  return options.loss === 'soft_l1' ? softL1Work(rowCount, options.terms.length, options.maxTerms) : 0;
}

function checkedTerms(model) {
  requireThat(model && model.schema === 'worldlaw.torque-model/v1' && Array.isArray(model.terms), 'Invalid executable torque model.');
  requireThat(model.terms.length <= ids.length && new Set(model.terms.map(t => t?.id)).size === model.terms.length,
    'Model terms must be unique.');
  model.terms.forEach(term => { requireThat(ids.includes(term.id), 'Model contains an unknown term.'); finite(term.coefficient, 'coefficient', 1e18); });
  return model.terms;
}
function predictUnchecked(model, row) {
  const value = model.terms.reduce((sum, term) => sum + term.coefficient * feature(term.id, row), 0);
  requireThat(Number.isFinite(value), 'Model prediction overflowed.', 'numerical_failure');
  return value;
}
export function predict(model, values) {
  if(model?.schema==='worldlaw.split-torque-experiment/v1')return prepareSplitTorquePoint(model)(values).roundedPrediction;
  if(model?.schema==='worldlaw.centered-torque-experiment/v1')return evaluateCenteredTorquePoint(model,values).rounded;
  checkedTerms(model); return predictUnchecked(model, input(values));
}
export function fitSplitTorque(observations,termIds,scale,limits){
  requireThat(Array.isArray(observations)&&Array.from(observations).every(row=>row!==undefined),'Original observations must be dense.');
  const samples=rows(observations,8);
  requireThat(samples.every(row=>row.torqueNoiseRatio===undefined),'Split soft-L1 does not support declared per-reading weights.');
  requireThat(Array.isArray(termIds)&&termIds.length>0&&termIds.length<=9&&new Set(termIds).size===termIds.length&&Array.from(termIds).every(id=>ids.includes(id)),'Choose 1–9 distinct maintained terms.');
  const fit=fitContinuationColumns(termIds.map(id=>samples.map(row=>feature(id,row))),samples.map(row=>row.jointTorque),scale,limits);
  if(fit.status!=='converged')return {status:fit.status,reservedWork:fit.reservedWork};
  return {status:'converged',schema:'worldlaw.split-torque-experiment/v1',terms:[...termIds],fit};
}
function prepareSplitTorquePoint(model){
  const selected=Array.isArray(model.terms)?model.terms.map(t=>typeof t==='string'?t:t?.id):model.terms;
  requireThat(model.status==='converged'&&Array.isArray(selected)&&selected.length>0&&selected.length<=9&&new Set(selected).size===selected.length&&Array.from(selected).every(id=>ids.includes(id))&&model.fit?.pairs?.length===selected.length,'Explicit split torque coefficients must match declared terms.');
  const snapshot=[...selected],point=prepareContinuationPredictor(model.fit);
  return (values,reading=0)=>{const row=input(values);return point(snapshot.map(id=>feature(id,row)),reading);};
}
export function fitCenteredTorque(observations, termIds, scale) {
  requireThat(Array.isArray(observations)&&Array.from(observations).every(row=>row!==undefined),'Original observations must be dense.');
  const samples=rows(observations,8);
  requireThat(samples.every(row=>row.torqueNoiseRatio===undefined),'Centered soft-L1 does not support declared per-reading weights.');
  requireThat(Array.isArray(termIds)&&termIds.length<=9&&termIds.includes('bias')&&new Set(termIds).size===termIds.length&&Array.from(termIds).every(id=>ids.includes(id)),'Choose up to nine maintained terms including bias.');
  const fit=fitCenteredResponse(termIds.map(id=>samples.map(row=>feature(id,row))),samples.map(row=>row.jointTorque),scale);
  if(fit.status!=='converged')return {status:fit.status};
  const delta={schema:'worldlaw.torque-model/v1',terms:termIds.map((id,i)=>({id,coefficient:fit.coefficients[i]}))};
  checkedTerms(delta);
  return {status:'converged',schema:'worldlaw.centered-torque-experiment/v1',origin:fit.origin,delta,fit:fit.fit};
}
export function evaluateCenteredTorquePoint(model,values,reading) {
  requireThat(model?.schema==='worldlaw.centered-torque-experiment/v1','Expected centered torque');
  finite(model.origin,'origin');checkedTerms(model.delta);
  const delta=predictUnchecked(model.delta,input(values)),rounded=model.origin+delta;
  requireThat(Number.isFinite(rounded),'Nonfinite rounded response');
  if(reading!==undefined)finite(reading,'reading');
  return {origin:model.origin,delta,rounded,...(reading===undefined?{}:{residual:(reading-model.origin)-delta,roundedResidual:reading-rounded})};
}

/**
 * Snapshot one model for repeated numerical evaluation. Every point still uses
 * the public coordinate bounds and finite-result check. The private snapshot
 * prevents a caller's later edits from changing a running solver's equation.
 */
export function prepareTorquePredictor(model) {
  if(model?.schema==='worldlaw.split-torque-experiment/v1'){const point=prepareSplitTorquePoint(model);return (command,position,rate)=>point({command,position,rate}).roundedPrediction;}
  if(model?.schema==='worldlaw.centered-torque-experiment/v1'){
    const snapshot=structuredClone(model);evaluateCenteredTorquePoint(snapshot,{command:0,position:0,rate:0});
    return (command,position,rate)=>evaluateCenteredTorquePoint(snapshot,{command,position,rate}).rounded;
  }
  checkedTerms(model);
  const snapshot = {schema: 'worldlaw.torque-model/v1',
    terms: model.terms.map(({id, coefficient}) => ({id, coefficient}))};
  // Validate the captured values as well, including accessor-backed callers.
  checkedTerms(snapshot);
  return (command, position, rate) => predictUnchecked(snapshot, {
    command: finite(command, 'command', 1e6),
    position: finite(position, 'position', 1e6),
    rate: finite(rate, 'rate', 1e6),
  });
}

export function evaluate(model, observations) {
  if(model?.schema==='worldlaw.split-torque-experiment/v1'){
    requireThat(Array.isArray(observations)&&Array.from(observations).every(row=>row!==undefined),'Original observations must be dense.');
    const point=prepareSplitTorquePoint(model),samples=rows(observations),result=samples.map(row=>{const value=point(row,row.jointTorque);return {...row,...value,prediction:value.roundedPrediction};});
    const residuals=result.map(r=>r.residual),rounded=result.map(r=>r.roundedResidual);
    return {count:result.length,rmse:result.length?norm(residuals)/Math.sqrt(result.length):null,roundedRmse:result.length?norm(rounded)/Math.sqrt(result.length):null,maxAbsResidual:result.length?Math.max(...residuals.map(Math.abs)):null,rows:result,representation:'split_coefficients; solver predictions remain rounded'};
  }
  if(model?.schema==='worldlaw.centered-torque-experiment/v1'){
    requireThat(Array.isArray(observations)&&Array.from(observations).every(row=>row!==undefined),'Original observations must be dense.');
    const samples=rows(observations),result=samples.map(row=>{const value=evaluateCenteredTorquePoint(model,row,row.jointTorque);return {...row,...value,prediction:value.rounded};});
    const residuals=result.map(row=>row.residual),roundedResiduals=result.map(row=>row.roundedResidual);
    return {count:result.length,rmse:result.length?norm(residuals)/Math.sqrt(result.length):null,roundedRmse:result.length?norm(roundedResiduals)/Math.sqrt(result.length):null,maxAbsResidual:result.length?Math.max(...residuals.map(Math.abs)):null,rows:result,representation:'origin_plus_delta; solver predictions remain rounded'};
  }
  checkedTerms(model);
  const samples = rows(observations);
  const result = samples.map(row => {
    const prediction = predictUnchecked(model, row);
    return { ...row, prediction, residual: row.jointTorque - prediction };
  });
  const residuals = result.map(row => row.residual);
  return { count: samples.length, rmse: samples.length ? norm(residuals) / Math.sqrt(samples.length) : null,
    ...(samples.length && samples[0].torqueNoiseRatio !== undefined ? {relativeNoiseRmse:norm(result.map(row => row.residual / row.torqueNoiseRatio)) / Math.sqrt(samples.length)} : {}),
    maxAbsResidual: samples.length ? Math.max(...residuals.map(Math.abs)) : null, rows: result };
}

export function discover(observations, requestedOptions = {}) {
  const samples = rows(observations, 8), options = normalizeOptions(requestedOptions);
  const robustWork = discoveryRobustWork(samples.length, options);
  requireThat(robustWork <= SOFT_L1_MAX_WORK,
    `Complete soft-L1 search needs ${robustWork} work units; the limit is ${SOFT_L1_MAX_WORK}. No subset of the observations or candidate library was fitted.`, 'work_limit');
  const weighted = options.loss === 'weighted_least_squares';
  requireThat(!weighted || samples.every(row => row.torqueNoiseRatio !== undefined),
    'Weighted least squares requires a declared torqueNoiseRatio on every original training row.');
  // Whitening uses declared relative standard deviations, never fitted residuals
  // or held-out data. All candidates share this same source and geometry.
  const columns = options.terms.map(id => samples.map(row => feature(id, row) / (weighted ? row.torqueNoiseRatio : 1)));
  const target = samples.map(row => row.jointTorque / (weighted ? row.torqueNoiseRatio : 1));
  const candidates = []; let rankDeficientCandidates = 0, unexecutableCandidates = 0, examined = 0;
  const domain = Object.fromEntries(fields.map(key => [key, {
    min: Math.min(...samples.map(row => row[key])), max: Math.max(...samples.map(row => row[key])),
  }]));
  for (let mask = 0; mask < (1 << options.terms.length); ++mask) {
    const indices = options.terms.flatMap((_, index) => mask & (1 << index) ? [index] : []);
    if (indices.length > options.maxTerms || indices.length >= samples.length) continue;
    examined++;
    let fitted = fit(indices.map(index => columns[index]), target);
    if (!fitted) { rankDeficientCandidates++; continue; }
    // An irrelevant, almost-zero feature can demand an enormous coefficient.
    // Reject that candidate without discarding other well-defined structures.
    if (fitted.coefficients.some(value => Math.abs(value) > 1e18)) { unexecutableCandidates++; continue; }
    if (options.loss === 'soft_l1') {
      fitted = fitSoftL1Columns(indices.map(index => columns[index]), target, options.lossScale, fitted);
      requireThat(fitted.status === 'converged',
        `Soft-L1 optimization is unresolved for ${indices.map(index => options.terms[index]).join('+') || 'zero'} (${fitted.status}). No partially optimized ranking is reported.`, 'robust_fit_incomplete');
      if (fitted.coefficients.some(value => Math.abs(value) > 1e18)) { unexecutableCandidates++; continue; }
    }
    const terms = indices.map((index, j) => ({ id: options.terms[index], coefficient: fitted.coefficients[j] }));
    const model = {
      schema: 'worldlaw.torque-model/v1', id: terms.map(term => term.id).join('+') || 'zero', terms, units: UNITS, domain,
      equation: 'τ = ' + (terms.map(term => `${Number(term.coefficient.toPrecision(5))}·${TERMS.find(t => t.id === term.id).label}`).join(' + ') || '0'),
    };
    const evaluation = evaluate(model, samples);
    // This noise-floor information criterion is a ranking heuristic. It is not
    // a posterior, a confidence interval, or evidence of absolute model adequacy.
    const scoreError = options.loss === 'soft_l1' ? fitted.meanLoss : weighted ? evaluation.relativeNoiseRmse ** 2 : evaluation.rmse ** 2;
    const score = samples.length * Math.log(Math.max(scoreError, options.noiseSigma ** 2)) + terms.length * Math.log(samples.length);
    model.metrics = { count: samples.length, rmse: evaluation.rmse, maxAbsResidual: evaluation.maxAbsResidual,
      score, conditionEstimate: fitted.conditionEstimate, rank: terms.length };
    if (weighted) {
      model.fitting = {loss:'weighted_least_squares',ratioField:'torqueNoiseRatio'};
      model.metrics.weighted = {relativeNoiseRmse:evaluation.relativeNoiseRmse,
        minRatio:Math.min(...samples.map(row => row.torqueNoiseRatio)),maxRatio:Math.max(...samples.map(row => row.torqueNoiseRatio))};
    }
    if (options.loss === 'soft_l1') {
      model.fitting = {loss:'soft_l1',scale:options.lossScale};
      model.metrics.robust = {meanLoss:fitted.meanLoss,iterations:fitted.iterations,
        scaledGradient:fitted.scaledGradient,stationarityTolerance:fitted.stationarityTolerance,
        minWeight:Math.min(...fitted.weights),halfWeightCount:fitted.weights.filter(weight => weight < 0.5).length};
    }
    candidates.push(model);
  }
  requireThat(candidates.length, 'No estimable model in the candidate library.', 'unidentifiable');
  const fullLibraryRank = libraryRank(columns);
  return rankFittedSource({samples, options, candidates, examined, rankDeficientCandidates,
    unexecutableCandidates, fullLibraryRank, robustWork}, options);
}

/** Complete incumbent-library experimental soft-L1 search. Training only. */
export function discoverSplit(observations,requestedOptions={}){
 requireThat(Array.isArray(observations)&&Array.from(observations).every(r=>r!==undefined),'Original observations must be dense.');
 requireThat(requestedOptions.loss===undefined||requestedOptions.loss==='soft_l1','Split discovery supports only explicit soft-L1.');
 const samples=rows(observations,8),options=normalizeOptions({...requestedOptions,loss:'soft_l1'});
 requireThat(samples.every(r=>r.torqueNoiseRatio===undefined),'Split discovery does not support per-reading weights.');
 requireThat(options.maxTerms<=9,'Split discovery admits at most nine terms per structure.');
 const columns=options.terms.map(id=>samples.map(r=>feature(id,r))),target=samples.map(r=>r.jointTorque),n=samples.length;
 requireThat(columns.every(c=>c.every(v=>Number.isFinite(v)&&Math.abs(v)<=1e6)),'Complete split feature course exceeds the bounded coordinate representation.');
 const max=Math.max(...target.map(Math.abs)),schedule=[];
 let robustWork=n*(options.terms.length**2+options.terms.length+1);
 for(let mask=0;mask<(1<<options.terms.length);mask++){
  const indices=options.terms.flatMap((_,i)=>mask&(1<<i)?[i]:[]);if(indices.length>options.maxTerms||indices.length>=n)continue;
  // Ranking needs one compensated original-residual pass (62p); public prediction remains unchanged.
  schedule.push(indices);robustWork+=(indices.length?sharedIterationWork(n,indices.length,max,options.lossScale):0)+n*(64*indices.length+32);
 }
 requireThat(robustWork<=SOFT_L1_MAX_WORK,`Complete split search needs ${robustWork} work units; limit ${SOFT_L1_MAX_WORK}. No prefix fitted.`,'work_limit');
 const candidates=[];let rankDeficientCandidates=0,unexecutableCandidates=0;
 const domain=Object.fromEntries(fields.map(k=>[k,{min:Math.min(...samples.map(r=>r[k])),max:Math.max(...samples.map(r=>r[k]))}]));
 for(const indices of schedule){
  const fitted=indices.length?fitCompleteColumns(indices.map(i=>columns[i]),target,options.lossScale):null;
  if(fitted?.status==='rank-unavailable'){rankDeficientCandidates++;continue;}
  requireThat(!fitted||fitted.status==='converged',`Complete split optimization unresolved for ${indices.map(i=>options.terms[i]).join('+')} (${fitted?.status}); no partial ranking.`,'robust_fit_incomplete');
  if(fitted?.pairs.some(p=>p.some(x=>Math.abs(x)>1e18))){unexecutableCandidates++;continue;}
  const terms=indices.map((i,j)=>({id:options.terms[i],coefficient:fitted.pairs[j][0]+fitted.pairs[j][1]}));
  const model={schema:fitted?'worldlaw.split-torque-experiment/v1':'worldlaw.torque-model/v1',status:'converged',id:terms.map(t=>t.id).join('+')||'zero',terms,units:UNITS,domain,...(fitted?{fit:fitted}:{}),equation:'τ = '+(terms.map(t=>`${Number(t.coefficient.toPrecision(5))}·${TERMS.find(x=>x.id===t.id).label}`).join(' + ')||'0')};
  const residuals=splitResidual(indices.map(i=>columns[i]),target,fitted?.pairs??[]),evaluation={rmse:Math.hypot(...residuals)/Math.sqrt(n),maxAbsResidual:Math.max(...residuals.map(Math.abs))},meanLoss=residuals.reduce((sum,r)=>sum+softL1Loss(r,options.lossScale),0)/n,weights=residuals.map(r=>softL1Weight(r,options.lossScale));
  model.fitting={loss:'soft_l1',scale:options.lossScale,representation:fitted?'split_coefficients':'zero'};
  model.metrics={count:n,rmse:evaluation.rmse,maxAbsResidual:evaluation.maxAbsResidual,score:n*Math.log(Math.max(meanLoss,options.noiseSigma**2))+terms.length*Math.log(n),conditionEstimate:fitted?fitted.conditionEstimate:1,rank:terms.length,robust:{meanLoss,iterations:fitted?.iterations??0,scaledGradient:fitted?.gradient??0,stationarityTolerance:1e-8*options.lossScale,minWeight:Math.min(...weights),halfWeightCount:weights.filter(w=>w<.5).length}};
  candidates.push(model);
 }
 requireThat(candidates.length,'No estimable split candidate.','unidentifiable');
 const result=rankFittedSource({samples,options,candidates,examined:schedule.length,rankDeficientCandidates,unexecutableCandidates,fullLibraryRank:libraryRank(columns),robustWork},options);
 result.schema='worldlaw.split-discovery-experiment/v1';result.diagnostics.representation='Split coefficients; ordinary physical predictions remain rounded. Original-scale robust ranking uses stable training residuals.';
 return result;
}

export function discoverHeterogeneous(observations,requestedOptions={}){
 requireThat(Array.isArray(observations)&&Array.from(observations).every(r=>r!==undefined),'Original observations must be dense.');
 requireThat(requestedOptions.loss===undefined||requestedOptions.loss==='soft_l1','Split discovery supports only explicit soft-L1.');
 const samples=rows(observations,8),options=normalizeOptions({...requestedOptions,loss:'soft_l1'});
 requireThat(samples.every(r=>r.torqueNoiseRatio!==undefined),'Every original training row must declare its noise ratio.');
 requireThat(options.maxTerms<=9,'Split discovery admits at most nine terms per structure.');
 const columns=options.terms.map(id=>samples.map(r=>feature(id,r))),target=samples.map(r=>r.jointTorque),n=samples.length;
 requireThat(columns.every(c=>c.every(v=>Number.isFinite(v)&&Math.abs(v)<=1e6)),'Complete split feature course exceeds the bounded coordinate representation.');
 const ratios=samples.map(r=>r.torqueNoiseRatio);requireThat(target.every((v,i)=>Math.abs(v/ratios[i])<=1e6)&&columns.every(c=>c.every((v,i)=>Math.abs(v/ratios[i])<=1e6)),'Declared normalized coordinates exceed bounded range.');const max=Math.max(...target.map((v,i)=>Math.abs(v/ratios[i]))),schedule=[];
 let robustWork=n*(options.terms.length**2+options.terms.length+1);
 for(let mask=0;mask<(1<<options.terms.length);mask++){
  const indices=options.terms.flatMap((_,i)=>mask&(1<<i)?[i]:[]);if(indices.length>options.maxTerms||indices.length>=n)continue;
  // Ranking needs one compensated original-residual pass (62p); public prediction remains unchanged.
  schedule.push(indices);robustWork+=(indices.length?heterogeneousWork(n,indices.length,max,options.lossScale):0)+n*(64*indices.length+40);
 }
 requireThat(robustWork<=SOFT_L1_MAX_WORK,`Complete split search needs ${robustWork} work units; limit ${SOFT_L1_MAX_WORK}. No prefix fitted.`,'work_limit');
 const candidates=[];let rankDeficientCandidates=0,unexecutableCandidates=0;
 const domain=Object.fromEntries(fields.map(k=>[k,{min:Math.min(...samples.map(r=>r[k])),max:Math.max(...samples.map(r=>r[k]))}]));
 for(const indices of schedule){
  const fitted=indices.length?fitHeterogeneousColumns(indices.map(i=>columns[i]),target,ratios,options.lossScale):null;
  if(fitted?.status==='rank-unavailable'){rankDeficientCandidates++;continue;}
  requireThat(!fitted||fitted.status==='converged',`Complete split optimization unresolved for ${indices.map(i=>options.terms[i]).join('+')} (${fitted?.status}); no partial ranking.`,'robust_fit_incomplete');
  if(fitted?.pairs.some(p=>p.some(x=>Math.abs(x)>1e18))){unexecutableCandidates++;continue;}
  const terms=indices.map((i,j)=>({id:options.terms[i],coefficient:fitted.pairs[j][0]+fitted.pairs[j][1]}));
  const model={schema:fitted?'worldlaw.split-torque-experiment/v1':'worldlaw.torque-model/v1',status:'converged',id:terms.map(t=>t.id).join('+')||'zero',terms,units:UNITS,domain,...(fitted?{fit:fitted}:{}),equation:'τ = '+(terms.map(t=>`${Number(t.coefficient.toPrecision(5))}·${TERMS.find(x=>x.id===t.id).label}`).join(' + ')||'0')};
  const physicalResiduals=splitResidual(indices.map(i=>columns[i]),target,fitted?.pairs??[]),evaluation={rmse:Math.hypot(...physicalResiduals)/Math.sqrt(n),maxAbsResidual:Math.max(...physicalResiduals.map(Math.abs))},residuals=physicalResiduals.map((r,i)=>r/ratios[i]),meanLoss=residuals.reduce((sum,r)=>sum+softL1Loss(r,options.lossScale),0)/n,weights=residuals.map(r=>softL1Weight(r,options.lossScale));
  model.fitting={loss:'soft_l1',scale:options.lossScale,representation:fitted?'split_coefficients':'zero',noise:'declared_per_reading_ratio'};
  model.metrics={normalizedRmse:Math.hypot(...residuals)/Math.sqrt(n),count:n,rmse:evaluation.rmse,maxAbsResidual:evaluation.maxAbsResidual,score:n*Math.log(Math.max(meanLoss,options.noiseSigma**2))+terms.length*Math.log(n),conditionEstimate:fitted?fitted.conditionEstimate:1,rank:terms.length,robust:{meanLoss,iterations:fitted?.iterations??0,scaledGradient:fitted?.gradient??0,stationarityTolerance:1e-8*options.lossScale,minWeight:Math.min(...weights),halfWeightCount:weights.filter(w=>w<.5).length}};
  candidates.push(model);
 }
 requireThat(candidates.length,'No estimable split candidate.','unidentifiable');
 const result=rankFittedSource({samples,options,candidates,examined:schedule.length,rankDeficientCandidates,unexecutableCandidates,fullLibraryRank:libraryRank(columns),robustWork},options);
 result.schema='worldlaw.heterogeneous-discovery-experiment/v1';result.diagnostics.scoreMeaning='Native complexity heuristic applied to declared-ratio soft-L1 residuals; not likelihood or confidence';result.diagnostics.adequacyMetric='declared_ratio_rmse';result.diagnostics.trainingRmseInNoiseUnits=result.selected.metrics.normalizedRmse/options.noiseSigma;result.diagnostics.adequacy=result.selected.metrics.normalizedRmse>3*options.noiseSigma?'residual_mismatch':'not_falsified_on_training';result.diagnostics.representation='Split coefficients; ordinary physical predictions remain rounded. Ranking uses original physical training residuals divided by declared ratios.';
 return result;
}

export function discoverInputOrigin(observations,requestedOptions={}){
 requireThat(Array.isArray(observations)&&Array.from(observations).every(r=>r!==undefined),'Original observations must be dense.');
 requireThat(requestedOptions.loss===undefined||requestedOptions.loss==='soft_l1','Split discovery supports only explicit soft-L1.');
 const samples=rows(observations,8),options=normalizeOptions({...requestedOptions,loss:'soft_l1'});
 requireThat(samples.every(r=>r.torqueNoiseRatio!==undefined),'Every original training row must declare its noise ratio.');
 requireThat(options.maxTerms<=9,'Split discovery admits at most nine terms per structure.');
 const columns=options.terms.map(id=>samples.map(r=>feature(id,r))),target=samples.map(r=>r.jointTorque),n=samples.length;
 requireThat(columns.every(c=>c.every(v=>Number.isFinite(v)&&Math.abs(v)<=1e6)),'Complete split feature course exceeds the bounded coordinate representation.');
 const ratios=samples.map(r=>r.torqueNoiseRatio);requireThat(target.every((v,i)=>Math.abs(v/ratios[i])<=1e6)&&columns.every(c=>c.every((v,i)=>Math.abs(v/ratios[i])<=1e6)),'Declared normalized coordinates exceed bounded range.');const max=Math.max(...target.map((v,i)=>Math.abs(v/ratios[i]))),schedule=[];
 let robustWork=n*(options.terms.length**2+options.terms.length+1);
 for(let mask=0;mask<(1<<options.terms.length);mask++){
  const indices=options.terms.flatMap((_,i)=>mask&(1<<i)?[i]:[]);if(indices.length>options.maxTerms||indices.length>=n)continue;
  // Ranking needs one compensated original-residual pass (62p); public prediction remains unchanged.
  schedule.push(indices);robustWork+=(indices.length?(indices.some(i=>options.terms[i]==='bias')?inputOriginWork:heterogeneousWork)(n,indices.length,max,options.lossScale):0)+n*(64*indices.length+40);
 }
 requireThat(robustWork<=SOFT_L1_MAX_WORK,`Complete split search needs ${robustWork} work units; limit ${SOFT_L1_MAX_WORK}. No prefix fitted.`,'work_limit');
 const candidates=[];let rankDeficientCandidates=0,unexecutableCandidates=0;
 const domain=Object.fromEntries(fields.map(k=>[k,{min:Math.min(...samples.map(r=>r[k])),max:Math.max(...samples.map(r=>r[k]))}]));
 for(const indices of schedule){
  const fitted=indices.length?(indices.some(i=>options.terms[i]==='bias')?fitInputOriginColumns:fitHeterogeneousColumns)(indices.map(i=>columns[i]),target,ratios,options.lossScale):null;
  if(fitted?.status==='rank-unavailable'){rankDeficientCandidates++;continue;}
  requireThat(!fitted||fitted.status==='converged',`Complete split optimization unresolved for ${indices.map(i=>options.terms[i]).join('+')} (${fitted?.status}); no partial ranking.`,'robust_fit_incomplete');
  if(fitted?.pairs.some(p=>p.some(x=>Math.abs(x)>1e18))){unexecutableCandidates++;continue;}
  const terms=indices.map((i,j)=>({id:options.terms[i],coefficient:fitted.pairs[j][0]+fitted.pairs[j][1]}));
  const model={schema:fitted?'worldlaw.split-torque-experiment/v1':'worldlaw.torque-model/v1',status:'converged',id:terms.map(t=>t.id).join('+')||'zero',terms,units:UNITS,domain,...(fitted?{fit:fitted}:{}),equation:'τ = '+(terms.map(t=>`${Number(t.coefficient.toPrecision(5))}·${TERMS.find(x=>x.id===t.id).label}`).join(' + ')||'0')};
  const physicalResiduals=splitResidual(indices.map(i=>columns[i]),target,fitted?.pairs??[]),evaluation={rmse:Math.hypot(...physicalResiduals)/Math.sqrt(n),maxAbsResidual:Math.max(...physicalResiduals.map(Math.abs))},residuals=physicalResiduals.map((r,i)=>r/ratios[i]),meanLoss=residuals.reduce((sum,r)=>sum+softL1Loss(r,options.lossScale),0)/n,weights=residuals.map(r=>softL1Weight(r,options.lossScale));
  model.fitting={loss:'soft_l1',scale:options.lossScale,representation:fitted?'split_coefficients':'zero',noise:'declared_per_reading_ratio'};
  model.metrics={normalizedRmse:Math.hypot(...residuals)/Math.sqrt(n),count:n,rmse:evaluation.rmse,maxAbsResidual:evaluation.maxAbsResidual,score:n*Math.log(Math.max(meanLoss,options.noiseSigma**2))+terms.length*Math.log(n),conditionEstimate:fitted?fitted.conditionEstimate:1,rank:terms.length,robust:{meanLoss,iterations:fitted?.iterations??0,scaledGradient:fitted?.gradient??0,stationarityTolerance:1e-8*options.lossScale,minWeight:Math.min(...weights),halfWeightCount:weights.filter(w=>w<.5).length}};
  candidates.push(model);
 }
 requireThat(candidates.length,'No estimable split candidate.','unidentifiable');
 const result=rankFittedSource({samples,options,candidates,examined:schedule.length,rankDeficientCandidates,unexecutableCandidates,fullLibraryRank:libraryRank(columns),robustWork},options);
 result.schema='worldlaw.input-origin-discovery-experiment/v1';result.diagnostics.scoreMeaning='Native complexity heuristic applied to declared-ratio soft-L1 residuals; not likelihood or confidence';result.diagnostics.adequacyMetric='declared_ratio_rmse';result.diagnostics.trainingRmseInNoiseUnits=result.selected.metrics.normalizedRmse/options.noiseSigma;result.diagnostics.adequacy=result.selected.metrics.normalizedRmse>3*options.noiseSigma?'residual_mismatch':'not_falsified_on_training';result.diagnostics.representation='Split coefficients; ordinary physical predictions remain rounded. Ranking uses original physical training residuals divided by declared ratios.';
 return result;
}

function rankFittedSource(source, options) {
  const {samples, examined, rankDeficientCandidates, unexecutableCandidates, fullLibraryRank, robustWork} = source;
  // Keep the private fits in their original enumeration order. Sorting a prior
  // ranked list would change the stable tie-break when a new noise floor ties it.
  const candidates = source.candidates.map(model => ({...model,
    terms: model.terms.map(term => ({...term})),
    ...(model.fitting ? {fitting:{...model.fitting}} : {}),
    domain: Object.fromEntries(fields.map(key => [key, {...model.domain[key]}])),
    metrics: {...model.metrics, ...(model.metrics.weighted ? {weighted:{...model.metrics.weighted}} : {}), score: samples.length * Math.log(Math.max(
      options.loss === 'soft_l1' ? model.metrics.robust.meanLoss : options.loss === 'weighted_least_squares' ? model.metrics.weighted.relativeNoiseRmse ** 2 : model.metrics.rmse ** 2,
      options.noiseSigma ** 2)) + model.terms.length * Math.log(samples.length)},
  }));
  candidates.sort((a, b) => a.metrics.score - b.metrics.score || a.terms.length - b.terms.length);
  const selected = candidates[0];
  const competitive = candidates.filter(model => model.metrics.score - selected.metrics.score <= options.ambiguityDelta);
  const adequacyRmse = options.loss === 'weighted_least_squares' ? selected.metrics.weighted.relativeNoiseRmse : selected.metrics.rmse;
  const result = {
    schema: 'worldlaw.discovery/v1', scope: 'finite_library_scalar_torque_structure', units: UNITS,
    selected, candidates, competitive, observations: samples.map(row => ({...row})),
    options: {...options, terms: [...options.terms]},
    diagnostics: {
      examinedCandidates: examined, rankDeficientCandidates, unexecutableCandidates, fullLibraryRank, librarySize: options.terms.length,
      rankTolerance: RANK_TOLERANCE, selectionAmbiguous: competitive.length > 1 || fullLibraryRank < options.terms.length,
      identifiability: fullLibraryRank < options.terms.length ? 'insufficient_excitation' :
        selected.metrics.conditionEstimate > 1e4 ? 'weak_numerical_conditioning' : 'finite_library_local_only',
      competitiveCount: competitive.length, trainingRmseInNoiseUnits: adequacyRmse / options.noiseSigma,
      adequacy: adequacyRmse > 3 * options.noiseSigma ? 'residual_mismatch' : 'not_falsified_on_training',
      scoreMethod: options.loss === 'soft_l1' ? 'n*log(max(mean_soft_l1_loss,noise_sigma^2))+term_count*log(n)' : options.loss === 'weighted_least_squares' ? 'n*log(max(mean_squared_residual_over_declared_ratio,noise_sigma^2))+term_count*log(n)' : 'n*log(max(training_mse,noise_sigma^2))+term_count*log(n)',
      ...(options.loss === 'weighted_least_squares' ? {adequacyMetric:'relative_noise_rmse',rankGeometry:'columns_divided_by_declared_torque_noise_ratio'} : {}),
      conditionEstimateMeaning: 'ratio_of_scaled_QR_diagonal_extremes_not_exact_condition_number',
      limitations: [
        'Only structures expressible by the supplied finite term library are searched.',
        'noiseSigma is a caller assumption; rankings and ambiguity depend on it.',
        'Competitive-model spread is not calibrated predictive uncertainty.',
        'Training fit does not establish physical validity or held-out performance.',
        'No passivity, friction-sign, or mechanism-topology constraints are imposed.',
        'Rank-deficient structures are not executable hypotheses; additional pilot excitation may be needed.',
        ...(options.loss === 'soft_l1' ? [
          'The chosen soft-L1 scale reduces large-residual influence; it does not identify which readings are wrong.',
          'Raw RMSE and adequacy retain every original reading, including reduced-weight residuals.',
          'The soft-L1 complexity score is a ranking heuristic, not likelihood or calibrated confidence.',
          'Large coordinate leverage, coherent omitted physics and majority contamination can still mislead this estimator.',
        ] : []),
        ...(options.loss === 'weighted_least_squares' ? [
          'torqueNoiseRatio is a caller-declared relative standard deviation, not measured reliability or confidence.',
          'noiseSigma is the assumed torque standard deviation at ratio one; each row assumes noiseSigma times its declared ratio.',
          'Ranking and adequacy use residuals divided by declared ratios; every raw residual and raw RMSE remains available.',
          'The column rank and conditioning describe the declared weighted design; small-weight evidence may not resolve a structure numerically.',
          'Wrong ratios, correlated noise, omitted physics and noisy input coordinates can still mislead this fit.',
        ] : []),
      ],
      ...(options.loss === 'soft_l1' ? {robustWorkReserved:robustWork,robustWorkLimit:SOFT_L1_MAX_WORK} : {}),
    },
  };
  if (options.loss !== 'soft_l1') fittedSources.set(result, source);
  return result;
}

/** Reuse only private least-squares fits with identical source and library. */
export function refitDiscovery(discovery, requestedOptions = {}) {
  if(discovery?.schema==='worldlaw.input-origin-discovery-experiment/v1')return discoverInputOrigin(discovery.observations,requestedOptions);
  if(discovery?.schema==='worldlaw.heterogeneous-discovery-experiment/v1')return discoverHeterogeneous(discovery.observations,requestedOptions);
  if(discovery?.schema==='worldlaw.split-discovery-experiment/v1')return discoverSplit(discovery.observations,requestedOptions);
  requireThat(discovery?.schema === 'worldlaw.discovery/v1', 'Expected a discovery result.');
  const samples = rows(discovery.observations, 8), options = normalizeOptions(requestedOptions);
  const source = fittedSources.get(discovery);
  if (source && options.loss !== 'soft_l1' && source.options.loss !== 'soft_l1'
    && options.loss === source.options.loss
    && options.maxTerms === source.options.maxTerms
    && options.terms.length === source.options.terms.length
    && options.terms.every((term, i) => term === source.options.terms[i])
    && samples.length === source.samples.length
    && samples.every((row, i) => observedFields.every(key => Object.is(row[key], source.samples[i][key])))) {
    return rankFittedSource(source, options);
  }
  return discover(samples, options);
}

export function planExperiment(discovery, candidateInputs) {
  requireThat(['worldlaw.discovery/v1','worldlaw.split-discovery-experiment/v1','worldlaw.heterogeneous-discovery-experiment/v1','worldlaw.input-origin-discovery-experiment/v1'].includes(discovery?.schema) && Array.isArray(discovery.competitive) && discovery.competitive.length,
    'Expected a discovery result.');
  requireThat(Array.isArray(candidateInputs) && candidateInputs.length > 0 && candidateInputs.length <= LIMIT,
    `Provide one to ${LIMIT} candidate inputs.`);
  if(['worldlaw.heterogeneous-discovery-experiment/v1','worldlaw.input-origin-discovery-experiment/v1'].includes(discovery.schema))requireThat(candidateInputs.every(r=>!Object.hasOwn(r,'torqueNoiseRatio')||r.torqueNoiseRatio===1),'This nominal planner assumes prospective noise ratio one; unequal prospective ratios are unsupported.');
  const models = discovery.competitive;
  models.forEach(prepareTorquePredictor);
  const ranked = candidateInputs.map((row, index) => {
    const point = input(row);
    const predictions = models.map(model => ({ modelId: model.id, value: predict(model, point) }));
    const values = predictions.map(p => p.value);
    const disagreement = Math.max(...values) - Math.min(...values);
    const extrapolation = fields.filter(key => discovery.selected.domain &&
      (point[key] < discovery.selected.domain[key].min || point[key] > discovery.selected.domain[key].max));
    return { index, input: point, disagreement, predictions, extrapolation };
  }).sort((a, b) => b.disagreement - a.disagreement || a.index - b.index);
  return { status: models.length > 1 && ranked[0].disagreement > 2 * discovery.options.noiseSigma ? 'proposed' : 'uninformative',
    selected: ranked[0], ranked, modelIds: models.map(model => model.id),
    method: 'maximum_competitive_model_prediction_range',
    ...(['worldlaw.heterogeneous-discovery-experiment/v1','worldlaw.input-origin-discovery-experiment/v1'].includes(discovery.schema)?{prospectiveNoiseRatio:1}:{}),
    interpretation: ['worldlaw.heterogeneous-discovery-experiment/v1','worldlaw.input-origin-discovery-experiment/v1'].includes(discovery.schema)?'Nominal physical prediction-spread heuristic assuming prospective noise ratio one. Unequal prospective ratios are unsupported; no physical actuation is performed.':'A heuristic among caller-permitted inputs; no physical actuation is performed.' };
}

export function revise(discovery, newObservations) {
  requireThat(['worldlaw.discovery/v1','worldlaw.split-discovery-experiment/v1','worldlaw.heterogeneous-discovery-experiment/v1','worldlaw.input-origin-discovery-experiment/v1'].includes(discovery?.schema), 'Expected a discovery result.');
  const added = rows(newObservations, 1);
  const before = evaluate(discovery.selected, added);
  const next = (discovery.schema==='worldlaw.input-origin-discovery-experiment/v1'?discoverInputOrigin:discovery.schema==='worldlaw.heterogeneous-discovery-experiment/v1'?discoverHeterogeneous:discovery.schema==='worldlaw.split-discovery-experiment/v1'?discoverSplit:discover)([...discovery.observations, ...added], discovery.options);
  return { ...next, revision: { previousModelId: discovery.selected.id, addedCount: added.length, before } };
}

/** Execute learned dynamics θ'=ω, ω'=τ/I using fixed-step classical RK4. */
export function simulate(model, initial, { duration = 4, dt = 0.01, inertia = 1, command = 0 } = {}) {
  const torque = prepareTorquePredictor(model);
  finite(duration, 'duration', 1000); finite(dt, 'dt', 1); finite(inertia, 'inertia', 1e12); finite(command, 'command', 1e6);
  requireThat(duration > 0 && dt > 0 && inertia > 0 && outputIntervalCount(duration, dt) <= 10000,
    'Simulation needs positive duration, dt and inertia, with at most 10000 steps.');
  let position = finite(initial?.position, 'initial.position', 1e6), rate = finite(initial?.rate, 'initial.rate', 1e6), time = 0;
  const state = () => ({time, position, rate, jointTorque: torque(command, position, rate)});
  const trajectory = [state()];
  const derivative = (p, v) => ({p: v, v: torque(command, p, v) / inertia});
  const steps = outputIntervalCount(duration, dt);
  for (let i = 0; i < steps; ++i) {
    const h = Math.min(dt, duration - time);
    const a = derivative(position, rate), b = derivative(position+h*a.p/2, rate+h*a.v/2);
    const c = derivative(position+h*b.p/2, rate+h*b.v/2), d = derivative(position+h*c.p, rate+h*c.v);
    position += h*(a.p+2*b.p+2*c.p+d.p)/6; rate += h*(a.v+2*b.v+2*c.v+d.v)/6;
    time = i === steps-1 ? duration : (i+1)*dt;
    trajectory.push(state());
  }
  return trajectory;
}




/** Explicit unequal-noise fixed-law fit; no default or selected-law replacement. */
export function fitHeterogeneousTorque(observations,termIds,scale,limits={}){
 requireThat(Array.isArray(observations)&&Array.from(observations).every(r=>r!==undefined),'Original observations must be dense.');
 const samples=rows(observations,8);
 requireThat(samples.every(r=>r.torqueNoiseRatio!==undefined),'Every original training row must declare its noise ratio.');
 requireThat(Array.isArray(termIds)&&termIds.length>0&&termIds.length<=9&&new Set(termIds).size===termIds.length&&Array.from(termIds).every(id=>ids.includes(id)),'Choose 1–9 distinct maintained terms.');
 const fit=fitHeterogeneousColumns(termIds.map(id=>samples.map(r=>feature(id,r))),samples.map(r=>r.jointTorque),samples.map(r=>r.torqueNoiseRatio),scale,limits);
 if(fit.status!=='converged')return {status:fit.status,reservedWork:fit.reservedWork};
 return {schema:'worldlaw.split-torque-experiment/v1',status:'converged',terms:[...termIds],fit,fitting:{loss:'declared_ratio_soft_l1',scale}};
}
export function evaluateHeterogeneousTorque(model,observations){
 requireThat(model?.fitting?.loss==='declared_ratio_soft_l1','Explicit unequal-noise model required.');
 requireThat(Array.isArray(observations)&&Array.from(observations).every(r=>r!==undefined),'Original readings must be dense.');
 const samples=rows(observations,0);requireThat(samples.every(r=>r.torqueNoiseRatio!==undefined),'Every evaluated original reading must declare its noise ratio.');
 const physical=evaluate(model,samples),normalized=physical.rows.map((row,i)=>row.residual/samples[i].torqueNoiseRatio);
 return {physical,normalizedRmse:normalized.length?Math.hypot(...normalized)/Math.sqrt(normalized.length):null,normalizedResiduals:normalized,meaning:'Physical torque residuals and declared-ratio residuals are separate. Ratios are supplied assumptions, not inferred reliability or calibrated uncertainty.'};
}

/** Explicit equivalent-input-basis experiment; original terms and pairs retained. */
export function fitInputOriginTorque(observations,termIds,scale,limits={}){
 requireThat(Array.isArray(observations)&&Array.from(observations).every(r=>r!==undefined),'Original observations must be dense.');
 const samples=rows(observations,8);
 requireThat(samples.every(r=>r.torqueNoiseRatio!==undefined),'Every original training row must declare its noise ratio.');
 requireThat(Array.isArray(termIds)&&termIds.length>0&&termIds.length<=9&&new Set(termIds).size===termIds.length&&Array.from(termIds).every(id=>ids.includes(id)),'Choose 1–9 distinct maintained terms.');
 const fit=fitInputOriginColumns(termIds.map(id=>samples.map(r=>feature(id,r))),samples.map(r=>r.jointTorque),samples.map(r=>r.torqueNoiseRatio),scale,limits);
 if(fit.status!=='converged')return {status:fit.status,reservedWork:fit.reservedWork};
 return {schema:'worldlaw.split-torque-experiment/v1',status:'converged',terms:[...termIds],fit,fitting:{loss:'declared_ratio_soft_l1',scale}};
}
