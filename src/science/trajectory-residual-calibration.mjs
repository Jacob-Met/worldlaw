import {verifyEvolutionRollout} from './operator-rollout.mjs';
import {createResidualCalibration,assessResidual} from '../trajectory/residual-abstention.mjs';

function ensure(ok,message){if(!ok)throw new RangeError(message);}
function scoreGroup(model,group,tolerance){
  let maximum=0;
  for(const {course,observations} of group.records){
    const result=verifyEvolutionRollout(model,course,observations,
      {maxError:Number.MAX_VALUE,resolutionTolerance:tolerance});
    if(!result.accepted) return {id:group.id,score:null,course:course.id,reason:result.reason};
    maximum=Math.max(maximum,result.held.maxError);
  }
  return {id:group.id,score:maximum};
}

/** One preselected model. Each independent acquisition contributes one maximum,
 * even when it contains multiple windows or strongly dependent sensor samples. */
export function assessCalibratedTrajectory(model,calibration,target,{alpha,resolutionTolerance}) {
  ensure(Array.isArray(calibration)&&calibration.length>0&&calibration.length<=255,'Require 1–255 calibration acquisitions');
  ensure(Number.isFinite(resolutionTolerance)&&resolutionTolerance>=0,'Declare finite refinement tolerance');
  const numerator=alpha?.numerator,denominator=alpha?.denominator;
  ensure(Number.isSafeInteger(numerator)&&Number.isSafeInteger(denominator)&&
    0<numerator&&numerator<denominator&&denominator<=1000000,'Declare an exact rational risk level');
  const groups=[...calibration,target],ids=new Set(),courses=new Set();
  let cells=0;
  for(const g of groups){
    ensure(g&&typeof g.id==='string'&&g.id.length>0&&g.id.length<=160&&!ids.has(g.id),'Acquisition ids must be unique');
    ids.add(g.id);
    ensure(Array.isArray(g.records)&&g.records.length>=1&&g.records.length<=32,'Declare bounded acquisition records');
    for(const {course} of g.records){
      ensure(course&&typeof course.id==='string'&&course.id.length>0&&!courses.has(course.id),'A measured course must belong to one acquisition');
      courses.add(course.id);
      ensure(Array.isArray(course.initial)&&Number.isSafeInteger(course.steps)&&course.steps>0,'Invalid measured course shape');
      cells+=(course.steps+1)*course.initial.length;
    }
  }
  ensure(courses.size<=512&&cells<=2000000,'Acquisition set exceeds the trajectory budget');
  const size=groups.length, minP={numerator:1,denominator:size};
  if(denominator>numerator*size) return {status:'insufficient_calibration_resolution',minimumP:minP,p:null};
  const scores=[];
  for(const g of calibration){
    const result=scoreGroup(model,g,resolutionTolerance);
    if(result.score===null)return {status:'unresolved_calibration_course',failure:result,p:null};
    scores.push(result);
  }
  const observed=scoreGroup(model,target,resolutionTolerance);
  if(observed.score===null)return {status:'unresolved_target_course',failure:observed,p:null};
  const policyId='symbolic-group-maximum/v1';
  const reference=createResidualCalibration({policyId,alpha:numerator/denominator,maxRounds:1,
    roundScoresByWorld:scores.map(r=>({worldId:'acquisition-'+r.id,scores:[r.score]}))});
  const assessment=assessResidual(reference,{policyId,round:1,worldId:'acquisition-'+observed.id,score:observed.score});
  const rank=1+assessment.atLeast;
  const p={numerator:rank,denominator:size};
  return {status:rank*denominator<=numerator*size?'residual_outlier':'within_calibrated_residual',
    p,minimumP:minP,observed,calibration:scores};
}

function rankLag(residuals) {
  const n = residuals.length;
  const order = Array.from({length:n}, (_, i) => i).sort((a, b) =>
    residuals[a] < residuals[b] ? -1 : Number(residuals[a] > residuals[b]));
  const ranks = new Array(n);
  for (let start = 0; start < n;) {
    let end = start + 1;
    while (end < n && residuals[order[end]] === residuals[order[start]]) end++;
    // Twice the centered midrank. Ties receive the same integer.
    for (let i = start; i < end; i++) ranks[order[i]] = start + end - n;
    start = end;
  }
  let lag = 0, energy = 0;
  for (let t = 0; t < n; t++) {
    energy += ranks[t] * ranks[t];
    if (t > 0) lag += ranks[t - 1] * ranks[t];
  }
  return energy === 0 ? null : {numerator:Math.abs(lag), denominator:energy};
}

function compareFractions(a, b) {
  const left = BigInt(a.numerator) * BigInt(b.denominator);
  const right = BigInt(b.numerator) * BigInt(a.denominator);
  return left < right ? -1 : Number(left > right);
}

function scoreForecastGroup(group, windows) {
  let score = null;
  const reports = [];
  for (const [w, record] of group.records.entries()) {
    const {samples, channels} = windows[w];
    const {predicted, observed} = record;
    for (const panel of [predicted, observed]) {
      ensure(Array.isArray(panel) && panel.length === samples, 'Forecast and observation need the declared sample count');
      for (const row of panel) ensure(Array.isArray(row) && row.length === channels.length, 'Incomplete forecast or observation row');
    }
    const channelScores = [];
    for (let j = 0; j < channels.length; j++) {
      const errors = new Array(samples);
      for (let t = 0; t < samples; t++) {
        ensure(Number.isFinite(observed[t][j]) && Number.isFinite(predicted[t][j]), 'Forecast and observation must be finite');
        errors[t] = observed[t][j] - predicted[t][j];
        if (!Number.isFinite(errors[t])) return {id:group.id, recordId:record.id, channel:channels[j], reason:'residual_overflow', score:null};
      }
      const shape = rankLag(errors);
      channelScores.push(shape);
      if (shape && (!score || compareFractions(shape, score) > 0)) score = shape;
    }
    if (channelScores.every(s => s === null)) return {id:group.id, recordId:record.id, reason:'constant_residual_record', score:null};
    reports.push({id:record.id, channelScores});
  }
  return {id:group.id, score, records:reports};
}

/** Rank serial association on a declared grid of held-out predictions. The caller
 * owns prediction provenance, numerical resolution and the exchangeable design. */
export function assessForecastResidualShape(calibration, target, {forecastId, windows, alpha}) {
  const validId = id => typeof id === 'string' && id.trim().length > 0 && id.length <= 160;
  ensure(validId(forecastId), 'Declare the frozen forecast identity');
  ensure(Array.isArray(calibration) && calibration.length >= 1 && calibration.length <= 255, 'Require 1–255 calibration acquisitions');
  ensure(Array.isArray(windows) && windows.length >= 1 && windows.length <= 32, 'Declare the fixed window layout');
  const {numerator, denominator} = alpha ?? {};
  ensure(Number.isSafeInteger(numerator) && Number.isSafeInteger(denominator) &&
    0 < numerator && numerator < denominator && denominator <= 1000000, 'Declare an exact rational risk level');
  const groups = [...calibration, target], ids = new Set(), recordIds = new Set();
  let cells = 0;
  for (const window of windows) {
    const {start, step, samples, channels} = window;
    ensure(Number.isFinite(start) && Number.isFinite(step) && step > 0 &&
      Number.isInteger(samples) && samples >= 1 && samples <= 4096, 'Invalid regular sample grid');
    let time = start;
    for (let t = 1; t < samples; t++) {
      const next = start + t * step;
      ensure(Number.isFinite(next) && next > time, 'Unrepresentable regular sample grid');
      time = next;
    }
    ensure(Array.isArray(channels) && channels.length >= 1 && channels.length <= 256 &&
      [...channels].every(validId) && new Set(channels).size === channels.length, 'Declare distinct ordered channels');
    cells += samples * channels.length;
  }
  ensure(groups.length * windows.length <= 512 && groups.length * cells <= 2000000, 'Forecast panel exceeds the acquisition budget');
  for (const g of groups) {
    ensure(g && validId(g.id) && !ids.has(g.id) && g.forecastId === forecastId, 'Duplicate acquisition or wrong forecast identity');
    ids.add(g.id);
    ensure(Array.isArray(g.records) && g.records.length === windows.length, 'Acquisition windows differ from the fixed layout');
    for (const [w, r] of g.records.entries()) {
      const plan = windows[w];
      ensure(r && validId(r.id) && !recordIds.has(r.id), 'Each record needs a unique id');
      recordIds.add(r.id);
      ensure(r.start === plan.start && r.step === plan.step && Array.isArray(r.channels) &&
        r.channels.length === plan.channels.length && plan.channels.every((id, j) => id === r.channels[j]), 'Acquisition grid or ordered channels differ');
    }
  }
  const minimumP = {numerator:1, denominator:groups.length};
  if (compareFractions(minimumP, alpha) > 0) return {status:'insufficient_calibration_resolution', minimumP, p:null};
  if (windows.some(w => w.samples < 4)) return {status:'insufficient_temporal_support', minimumP, p:null};
  const scores = [];
  for (const g of calibration) {
    const result = scoreForecastGroup(g, windows);
    if (!result.score) return {status:'unresolved_calibration_record', failure:result, minimumP, p:null};
    scores.push(result);
  }
  const observed = scoreForecastGroup(target, windows);
  if (!observed.score) return {status:'unresolved_target_record', failure:observed, minimumP, p:null};
  const rank = 1 + scores.filter(r => compareFractions(r.score, observed.score) >= 0).length;
  const p = {numerator:rank, denominator:groups.length};
  return {status:compareFractions(p, alpha) <= 0 ? 'serial_shape_outlier' : 'within_calibrated_shape',
    forecastId, p, minimumP, observed, calibration:scores};
}
