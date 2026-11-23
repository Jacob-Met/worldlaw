/** Derivative-SINDy for continuous scalar trajectories with known inertia.
 * No acceleration labels or initial-rate measurements enter the fit.
 */
import {prepareTorquePredictor, TERMS, UNITS} from '../science/torque-discovery.mjs';
import {fitLinearColumns, linearColumnRank} from '../science/linear-fit.mjs';
import {validateRun} from './data.mjs';

const rms = a => Math.hypot(...a)/Math.sqrt(a.length);
function check(ok, message) { if (!ok) throw new RangeError(message); }

function equations(runs, predictors) {
  const columns=predictors.map(()=>[]), target=[], coverage=[];
  for (const run of runs) {
    const s=run.samples;
    let included=0, excludedCrossing=0;
    for (let i=10;i<s.length-10;i++) {
      const win=s.slice(i-10,i+11);
      // Only commands on the twenty intervals enter these observations:
      // the command recorded at the last endpoint acts AFTER the window.
      if (win.slice(1,-1).some(row=>row.command!==win[0].command)) {
        excludedCrossing++; continue;
      }
      const center=s[i], span=Math.max(center.time-win[0].time,win[20].time-center.time);
      const t=win.map(r=>(r.time-center.time)/span);
      const poly=fitLinearColumns([t.map(()=>1),t,t.map(v=>v*v),t.map(v=>v*v*v)],
        win.map(r=>r.position-center.position));
      check(poly,'Singular local cubic derivative design');
      const rate=poly.coefficients[1]/span;
      const acceleration=(2*poly.coefficients[2]/span)/span;
      const torque=run.inertia*acceleration;
      check(Number.isFinite(torque),'Nonfinite derivative target');
      target.push(torque);
      for(let j=0;j<predictors.length;j++) {
        const v=predictors[j](center.command,center.position,rate);
        check(Number.isFinite(v),'Nonfinite derivative library feature');
        columns[j].push(v);
      }
      included++;
    }
    coverage.push({runId:run.id,sourceRows:s.length,included,excludedCrossing,
      excludedEdges:Math.min(s.length,20)});
  }
  return {columns,target,coverage};
}

function ridgeFit(cols,y,active,ridge) {
  // In normalized units: mean residual^2 + ridge*sum(coefficient^2).
  const penalty=Math.sqrt(y.length*ridge);
  const padded=active.map((j,k)=>cols[j].concat(active.map((_,i)=>i===k?penalty:0)));
  const fit=fitLinearColumns(padded,y.concat(active.map(()=>0)));
  check(fit,'Augmented-QR ridge fit failed');
  return fit.coefficients;
}

export function discoverSindy(trainingRuns, raw={}) {
  const fields=['terms','maxTerms','noiseSigma','derivativeWindow','threshold','ridge','maxIterations'];
  check(raw && typeof raw==='object' && !Array.isArray(raw) &&
    Object.keys(raw).every(k=>fields.includes(k)),'Invalid derivative discovery options');
  const {terms,noiseSigma,derivativeWindow=21,threshold=.05,ridge=1e-8,maxIterations=10}=raw;
  check(Array.isArray(terms) && terms.length>0 && terms.length<=9 &&
    new Set(terms).size===terms.length && Array.from(terms).every(id=>TERMS.some(t=>t.id===id)),
    'Require one to nine unique executable library terms');
  const maxTerms=raw.maxTerms??terms.length;
  check(Number.isInteger(maxTerms) && maxTerms>=0 && maxTerms<=terms.length,'Invalid maxTerms');
  check(derivativeWindow===21 && Number.isFinite(noiseSigma) && noiseSigma>=1e-12 && noiseSigma<=1e6 &&
    Number.isFinite(threshold) && threshold>=0 && Number.isFinite(ridge) && ridge>0 &&
    Number.isInteger(maxIterations) && maxIterations>=1 && maxIterations<=50,'Invalid SINDy settings');
  check(Array.isArray(trainingRuns) && trainingRuns.length>=1 && trainingRuns.length<=4,
    'Require one to four training runs');
  const runs=Array.from(trainingRuns,r=>validateRun(r,{role:'training'}));
  check(new Set(runs.map(r=>r.id)).size===runs.length && runs.reduce((s,r)=>s+r.samples.length,0)<=8192,
    'Duplicate run identity or source sample limit exceeded');
  const predictors=terms.map(id=>prepareTorquePredictor({schema:'worldlaw.torque-model/v1',
    terms:[{id,coefficient:1}]}));
  const {columns,target,coverage}=equations(runs,predictors);
  const diagnostics={coverage,library:[...terms],equationCount:target.length,derivativeWindow,
    derivative:'centered local cubic on physical irregular time; position at measured center',
    noiseSigma,noiseSigmaUnits:'rad; declared observation noise, not a torque threshold',
    maxIterations,threshold,ridge,maxTerms,history:[]};
  const base={schema:'worldlaw.sindy-discovery/v1',method:'derivative_stlsq',diagnostics};
  const refuse=reason=>({...base,status:'refused',reason,selected:null,candidates:[],support:null});
  if (coverage.some(r=>r.included===0) || target.length<Math.max(8,terms.length))
    return refuse('insufficient_derivative_windows');
  const scales=columns.map(rms), targetRms=rms(target);
  check(scales.every(Number.isFinite) && Number.isFinite(targetRms),'Nonfinite derivative scale');
  const normalized=columns.map((c,j)=>c.map(x=>x/(scales[j]||1)));
  const y=target.map(x=>x/(targetRms||1));
  const aliases=[];
  for(let j=0;j<terms.length;j++) for(let k=0;k<j;k++) {
    if (!scales[j] || !scales[k]) continue;
    for(const sign of [-1,1])
      if (normalized[j].every((v,i)=>Math.abs(v-sign*normalized[k][i])<=1e-12))
        aliases.push({left:terms[k],right:terms[j],normalizedSign:sign});
  }
  Object.assign(diagnostics,{columnRms:scales,torqueRms:targetRms,aliases,
    unregularizedRank:linearColumnRank(normalized),zeroColumns:terms.filter((_,i)=>scales[i]===0)});

  let active=terms.map((_,i)=>i), converged=false;
  for(let iter=0;iter<maxIterations;iter++) {
    const beta=ridgeFit(normalized,y,active,ridge);
    const retained=active.map((id,j)=>({id,magnitude:Math.abs(beta[j])}))
      .filter(p=>scales[p.id]>0 && p.magnitude>0 && p.magnitude>=threshold)
      .sort((a,b)=>b.magnitude-a.magnitude || a.id-b.id);
    const next=retained.slice(0,maxTerms).map(p=>p.id).sort((a,b)=>a-b);
    diagnostics.history.push({support:active.map(i=>terms[i]),normalizedCoefficients:[...beta],
      excludedByTermCap:retained.slice(maxTerms).map(p=>terms[p.id]),nextSupport:next.map(i=>terms[i])});
    if(next.length===active.length) { converged=true; break; }
    active=next;
    if(!active.length) { converged=true; break; }
  }
  diagnostics.iterations=diagnostics.history.length;
  if (!converged) return refuse('support_iteration_cap');
  const final=ridgeFit(normalized,y,active,ridge);
  const fitted=active.map((j,k)=>({id:terms[j],coefficient:final[k]*(targetRms||1)/scales[j]}));
  const residual=target.map((v,i)=>v-fitted.reduce((sum,t,k)=>sum+t.coefficient*columns[active[k]][i],0));
  const selected={schema:'worldlaw.torque-model/v1',id:'sindy:'+ (fitted.map(t=>t.id).join('+')||'zero'),
    terms:fitted,units:{...UNITS},method:'derivative_stlsq',
    metrics:{count:target.length,rmse:rms(residual),residualUnits:'N·m'}};
  prepareTorquePredictor(selected);
  check(Number.isFinite(selected.metrics.rmse),'Nonfinite SINDy training residual');
  diagnostics.identification=diagnostics.unregularizedRank<terms.length?'offered_library_rank_deficient':
    'finite_observed_library_only';
  return {...base,status:'fit',reason:null,selected,candidates:[selected],support:fitted.map(t=>t.id)};
}
