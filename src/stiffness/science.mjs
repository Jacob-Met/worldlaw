import { fitLinearColumns } from '../science/linear-fit.mjs';
import { validateRows, UNITS } from '../data.mjs';

const NUISANCE = ['bias', 'command', 'rate'];
const LIMIT = 1e6;
function need(ok, message) { if (!ok) throw new Error(message); }
function bounded(value, label, max = LIMIT) {
  need(typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= max,
    label + ' must be a finite number of magnitude at most ' + max + '.');
  return value;
}
export function normalizeSettings(settings) {
  need(settings && typeof settings === 'object' && !Array.isArray(settings), 'Supply investigation settings.');
  need(Object.keys(settings).every(k => ['knots','nuisanceTerms','noiseSigma','ambiguityDelta'].includes(k)), 'Unknown investigation setting.');
  const knots = settings.knots;
  need(Array.isArray(knots) && knots.length > 0 && knots.length <= 101, 'Declare 1–101 possible change angles.');
  knots.forEach(x => bounded(x, 'Change angle'));
  need(new Set(knots).size === knots.length, 'Change angles must be distinct.');
  const nuisanceTerms = settings.nuisanceTerms ?? ['bias'];
  need(Array.isArray(nuisanceTerms) && new Set(nuisanceTerms).size === nuisanceTerms.length &&
    nuisanceTerms.every(x => NUISANCE.includes(x)), 'Nuisance terms must be distinct bias, command or rate.');
  const noiseSigma = bounded(settings.noiseSigma ?? 0.01, 'Assumed torque noise', 1000);
  need(noiseSigma >= 1e-7, 'Assumed torque noise must be at least 0.0000001 N·m.');
  const ambiguityDelta = bounded(settings.ambiguityDelta ?? 6, 'Competitive score difference', 100);
  need(ambiguityDelta >= 0, 'Competitive score difference must be nonnegative.');
  return {knots:[...knots].sort((a,b)=>a-b), nuisanceTerms:NUISANCE.filter(x=>nuisanceTerms.includes(x)), noiseSigma, ambiguityDelta};
}
export function defaultKnots(observations, count = 21) {
  const rows = validateRows(observations);
  need(Number.isInteger(count) && count >= 3 && count <= 101, 'Grid size must be an integer from 3 to 101.');
  const lo = Math.min(...rows.map(r=>r.position)), hi = Math.max(...rows.map(r=>r.position));
  need(hi > lo, 'Different observed angles are needed to offer change angles.');
  return Array.from({length:count}, (_,i)=>lo+(hi-lo)*(i+1)/(count+1));
}
function feature(id, row, knot) {
  if (id === 'bias') return 1;
  if (id === 'position') return row.position;
  if (id === 'hinge') return Math.max(0, row.position-knot);
  return row[id];
}
function checkedInput(row) {
  need(row && typeof row === 'object' && !Array.isArray(row), 'Supply a complete input state.');
  return Object.fromEntries(['command','position','rate'].map(k=>[k,bounded(row[k], k)]));
}
function checkModel(model) {
  need(model?.schema === 'worldlaw.stiffness-model/v1' && ['global','piecewise'].includes(model.family),
    'Expected an executable stiffness model.');
  need(Array.isArray(model.terms) && model.terms.length >= 1 && model.terms.length <= 5,
    'Invalid model terms.');
  const names = model.terms.map(t=>t?.id);
  need(new Set(names).size === names.length && names.includes('position') &&
    names.every(x=>[...NUISANCE,'position','hinge'].includes(x)) &&
    names.includes('hinge') === (model.family === 'piecewise'), 'Invalid stiffness structure.');
  if (model.family === 'piecewise') bounded(model.knot, 'Model change angle');
  else need(model.knot === null, 'Global models have no change angle.');
  model.terms.forEach(t=>bounded(t.coefficient, 'Coefficient', 1e18));
}
function prediction(model, row) {
  const v = model.terms.reduce((sum,t)=>sum+t.coefficient*feature(t.id,row,model.knot),0);
  need(Number.isFinite(v), 'Model prediction overflowed.');
  return v;
}
export function predictStiffness(model, row) {
  checkModel(model);
  return prediction(model, checkedInput(row));
}
export function evaluateStiffness(model, observations) {
  checkModel(model);
  const rows = validateRows(observations, {allowEmpty:true}).map(row=>{
    const predicted = prediction(model, row);
    const residual = row.jointTorque-predicted;
    const extrapolation = ['position','command','rate'].filter(k=>model.domain &&
      (row[k]<model.domain[k].min || row[k]>model.domain[k].max));
    return {...row, prediction:predicted, residual, extrapolation};
  });
  return {count:rows.length, rmse:rows.length?Math.hypot(...rows.map(r=>r.residual))/Math.sqrt(rows.length):null,
    maxAbsResidual:rows.length?Math.max(...rows.map(r=>Math.abs(r.residual))):null,
    extrapolationCount:rows.filter(r=>r.extrapolation.length).length, rows};
}
/** Training-only finite knot search. No challenge values are admitted here. */
export function investigateStiffness(observations, requestedSettings) {
  const rows = validateRows(observations), settings = normalizeSettings(requestedSettings);
  const domain = Object.fromEntries(['position','command','rate'].map(k=>[k,
    {min:Math.min(...rows.map(r=>r[k])), max:Math.max(...rows.map(r=>r[k]))}]));
  const positions = [...new Set(rows.map(r=>r.position))];
  const target = rows.map(r=>r.jointTorque), profile = [], candidates = [];
  for (const knot of [null,...settings.knots]) {
    const family = knot===null?'global':'piecewise';
    const support = knot===null?null:{
      left:positions.filter(x=>x<knot).length, right:positions.filter(x=>x>knot).length};
    const entry = {family,knot,support,status:'fitted',model:null};
    if (support && (support.left<3 || support.right<3)) {
      entry.status='insufficient_side_support'; profile.push(entry); continue;
    }
    const ids = [...settings.nuisanceTerms,'position',...(knot===null?[]:['hinge'])];
    const fitted = fitLinearColumns(ids.map(id=>rows.map(row=>feature(id,row,knot))),target);
    if (!fitted) { entry.status='rank_deficient'; profile.push(entry); continue; }
    if (fitted.coefficients.some(c=>!Number.isFinite(c)||Math.abs(c)>1e18)) {
      entry.status='unexecutable'; profile.push(entry); continue;
    }
    const terms = ids.map((id,i)=>({id,coefficient:fitted.coefficients[i]}));
    const model={schema:'worldlaw.stiffness-model/v1',family,knot,terms,units:{...UNITS},domain};
    const evaluation=evaluateStiffness(model,rows);
    // A finite-search ranking heuristic: count fitted coefficients plus the searched knot.
    // This is deliberately not a calibrated information criterion or probability.
    const parameterCount=terms.length+(knot===null?0:1);
    const score=rows.length*Math.log(Math.max(evaluation.rmse**2,settings.noiseSigma**2))+
      parameterCount*Math.log(rows.length);
    const slopeLeft=terms.find(t=>t.id==='position').coefficient;
    const slopeChange=terms.find(t=>t.id==='hinge')?.coefficient??0;
    Object.assign(model,{slopeLeft,slopeRight:slopeLeft+slopeChange,
      metrics:{...evaluation,rows:undefined,score,parameterCount,conditionEstimate:fitted.conditionEstimate}});
    delete model.metrics.rows;
    entry.model=model; profile.push(entry); candidates.push(model);
  }
  candidates.sort((a,b)=>a.metrics.score-b.metrics.score || a.metrics.parameterCount-b.metrics.parameterCount ||
    (a.knot??-Infinity)-(b.knot??-Infinity));
  const selected=candidates[0]??null;
  const competitive=selected?candidates.filter(m=>m.metrics.score-selected.metrics.score<=settings.ambiguityDelta):[];
  const baseline=candidates.find(m=>m.family==='global')??null;
  const status=!selected?'unidentifiable':selected.family==='global'?'global_preferred':
    competitive.some(m=>m.family==='global')?'structure_ambiguous':
    competitive.length>1?'change_angle_ambiguous':'piecewise_preferred';
  return {schema:'worldlaw.stiffness-investigation/v1',settings,observations:rows,domain,selected,baseline,
    candidates,competitive,profile,status,diagnostics:{
      examined:profile.length,fitted:candidates.length,refused:profile.filter(p=>p.status!=='fitted').length,
      adequacy:!selected?'unassessed':selected.metrics.rmse>3*settings.noiseSigma?'training_mismatch':'not_falsified_on_training',
      scoreMethod:'n*log(max(training_mse,assumed_noise^2))+(coefficient_count+searched_knot_count)*log(n)',
      minDistinctPositionsPerSide:3,
      limitations:[
        'Only the declared finite change-angle grid and nuisance terms are tested.',
        'A lower score or a kink does not establish a contact, joint topology or physical cause.',
        'Noise and competitive-score settings are assumptions; no probability or confidence interval is computed.',
        'Piecewise candidates require three distinct observed positions on each side, plus full numerical rank.',
        'Slope signs are unrestricted. No passivity, physical safety or causal claim is established.',
        'Future checks are excluded from fitting, ranking, grid generation and competitive-set construction.',
        'Predictions outside the observed input ranges are explicitly marked as extrapolation.'
      ]
    }};
}
