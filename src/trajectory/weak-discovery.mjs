/** Known-inertia torque discovery without supplied initial-rate fitting. */
import {TERMS, DEFAULT_TERMS, UNITS, DiscoveryError} from '../science/torque-discovery.mjs';
import {fitLinearColumns, linearColumnRank} from '../science/linear-fit.mjs';
import {validateRun} from './data.mjs';
import {weakWindows, weakLocalRates} from './weak-operator.mjs';
const insist=(ok,message,code='invalid_input')=>{if(!ok)throw new DiscoveryError(message,code);};
const norm=v=>Math.hypot(...v);
export function discoverWeak(trainingRuns, raw={}) {
 insist(raw&&typeof raw==='object'&&!Array.isArray(raw),'Weak options must be an object.');
 const options={terms:raw.terms??DEFAULT_TERMS,maxTerms:raw.maxTerms??4,noiseSigma:raw.noiseSigma??.01,ambiguityDelta:raw.ambiguityDelta??6,windowDuration:raw.windowDuration??1,windowStride:raw.windowStride??.5,rateWindowSize:raw.rateWindowSize??9};
 insist(Array.isArray(options.terms)&&options.terms.length>0&&options.terms.length<=8&&new Set(options.terms).size===options.terms.length&&options.terms.every(id=>TERMS.some(t=>t.id===id)),'Offer unique supported scalar torque terms.');
 insist(Number.isInteger(options.maxTerms)&&options.maxTerms>=0&&options.maxTerms<=options.terms.length,'Invalid term limit.');
 insist(Number.isFinite(options.noiseSigma)&&options.noiseSigma>=1e-12&&options.noiseSigma<=1e6,'Invalid position noise scale.');
 insist(Number.isFinite(options.ambiguityDelta)&&options.ambiguityDelta>=0&&options.ambiguityDelta<=100,'Invalid ambiguity threshold.');
 insist(Number.isFinite(options.windowDuration)&&options.windowDuration>=.02&&options.windowDuration<=60,'Invalid weak duration.');
 insist(Number.isFinite(options.windowStride)&&options.windowStride>=.01&&options.windowStride<=options.windowDuration,'Invalid weak stride.');
 insist(Number.isInteger(options.rateWindowSize)&&options.rateWindowSize>=5&&options.rateWindowSize<=31&&options.rateWindowSize%2===1,'Invalid rate window.');
 insist(Array.isArray(trainingRuns)&&trainingRuns.length>=1&&trainingRuns.length<=4,'Supply one to four training runs.');
 const runs=trainingRuns.map(run=>validateRun(run,{role:'training'}));
 insist(new Set(runs.map(r=>r.id)).size===runs.length&&runs.reduce((n,r)=>n+r.samples.length,0)<=8192,'Duplicate runs or excessive source size.');
 const needsRates=options.terms.some(id=>['coulomb','quadratic'].includes(id));
 const blocks=runs.map(run=>{const rates=needsRates?weakLocalRates(run,options.rateWindowSize,insist):null;return {run,rates,rows:weakWindows(run,options,rates,insist)};});
 const rows=blocks.flatMap(b=>b.rows.map(row=>({...row,columns:row.columns.map(v=>v/b.run.inertia)})));
 insist(rows.length>=8&&rows.length<=2048,'Require 8–2048 weak windows.','resource_limit');
 const target=rows.map(r=>r.target), columns=options.terms.map((_,i)=>rows.map(r=>r.columns[i]));
 insist(Number.isFinite(norm(target))&&columns.every(c=>Number.isFinite(norm(c))),'Nonfinite weak equations.','numerical_failure');
 const bounds=v=>({min:Math.min(...v),max:Math.max(...v)}), samples=runs.flatMap(r=>r.samples);
 const domain={position:bounds(samples.map(r=>r.position)),command:bounds(samples.map(r=>r.command)),rate:needsRates?{...bounds(blocks.flatMap(b=>b.rates)),source:'local_cubic_first_derivative'}:{min:null,max:null,source:'not_estimated'}};
 const candidates=[];let examinedCandidates=0,rankDeficientCandidates=0,unexecutableCandidates=0;
 for(let mask=0;mask<2**options.terms.length;mask++){
  const indices=options.terms.flatMap((_,i)=>mask&(1<<i)?[i]:[]);if(indices.length>options.maxTerms)continue;
  examinedCandidates++;const fit=fitLinearColumns(indices.map(i=>columns[i]),target);
  if(!fit){rankDeficientCandidates++;continue;}
  if(fit.coefficients.some(v=>Math.abs(v)>1e18)){unexecutableCandidates++;continue;}
  const residuals=target.map((v,j)=>v-indices.reduce((sum,i,k)=>sum+fit.coefficients[k]*columns[i][j],0));
  const rmse=norm(residuals)/Math.sqrt(rows.length),score=rows.length*Math.log(Math.max(rmse**2,options.noiseSigma**2))+indices.length*Math.log(rows.length);
  if(!Number.isFinite(score)){unexecutableCandidates++;continue;}
  const terms=indices.map((i,k)=>({id:options.terms[i],coefficient:fit.coefficients[k]}));
  candidates.push({schema:'worldlaw.torque-model/v1',id:terms.map(t=>t.id).join('+')||'zero',terms,units:{...UNITS},domain,method:'compact_window_weak_torque_regression',equation:'τ = '+(terms.map(t=>`${Number(t.coefficient.toPrecision(5))}·${TERMS.find(x=>x.id===t.id).label}`).join(' + ')||'0'),metrics:{count:rows.length,rmse,score,maxAbsResidual:Math.max(...residuals.map(Math.abs)),conditionEstimate:fit.conditionEstimate,rank:terms.length,residualUnits:'rad',residualMeaning:'noise_normalized_weak_equation_not_forward_prediction'}});
 }
 insist(candidates.length,'No executable weak candidate.','unidentifiable');
 candidates.sort((a,b)=>a.metrics.score-b.metrics.score||a.terms.length-b.terms.length);
 const selected=candidates[0],competitive=candidates.filter(c=>c.metrics.score-selected.metrics.score<=options.ambiguityDelta),rank=linearColumnRank(columns);
 return {schema:'worldlaw.discovery/v1',method:'compact_window_weak_torque_regression',scope:'finite_library_scalar_torque_structure',units:{...UNITS},residualUnits:'rad',noiseSigmaUnits:'rad',selected,candidates,competitive,options,trainingRuns:runs,fitEquationCount:rows.length,diagnostics:{examinedCandidates,rankDeficientCandidates,unexecutableCandidates,fullLibraryRank:rank,librarySize:options.terms.length,selectionAmbiguous:competitive.length>1||rank<options.terms.length,competitiveCount:competitive.length,identifiability:rank<options.terms.length?'insufficient_excitation':'finite_library_local_only',trainingRmseInNoiseUnits:selected.metrics.rmse/options.noiseSigma,adequacy:selected.metrics.rmse>3*options.noiseSigma?'residual_mismatch':'not_falsified_on_training',initialRateAssumption:'not_used_in_fitting; supplied_rate_reserved_for_forward_initialization',commandConvention:'left_sample_zero_order_hold',covarianceTreatment:'target_row_noise_normalization_only; overlapping_windows_not_whitened',runs:blocks.map(b=>({runId:b.run.id,equationCount:b.rows.length,windows:b.rows.map(({target,columns,...metadata})=>metadata)})),limitations:['Known constant inertia and aligned calibrated scalar channels are declared assumptions.','Overlapping windows and noisy regressors invalidate calibrated likelihood or confidence claims.','Nonlinear quadrature and local rate estimates can bias coefficients; verify sampling resolution.','Initial rate is eliminated only from fitting; forward predictions retain the supplied initial rate.','Training window residuals are not independent forward validation.']}};
}

