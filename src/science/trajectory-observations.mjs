/**
 * Experimental encoder/tracking adapter. Converts declared unwrapped angular
 * telemetry to net-torque estimates using known inertia. No hardware control.
 */
import {DiscoveryError} from './torque-discovery.mjs';
function insist(condition, message) { if (!condition) throw new DiscoveryError(message); }
function finite(value, name, bound=1e12) {
  insist(typeof value==='number' && Number.isFinite(value) && Math.abs(value)<=bound,
    `${name} must be finite with magnitude at most ${bound}.`);
  return value;
}
const dot=(a,b)=>a.reduce((sum,value,i)=>sum+value*b[i],0);

// Cubic regression in centered, scaled time; two-pass QR avoids subtracting a
// large absolute epoch or squaring a badly conditioned Vandermonde matrix.
function localCubic(samples, center, positionSigma) {
  const scale=Math.max(...samples.map(row=>Math.abs(row.time-center.time)));
  insist(scale>0,'Telemetry time window has no positive duration.');
  const t=samples.map(row=>(row.time-center.time)/scale);
  const columns=[t.map(()=>1),t,t.map(value=>value*value),t.map(value=>value*value*value)];
  const q=[],r=Array.from({length:4},()=>[0,0,0,0]);
  for(let j=0;j<4;j++) {
    const v=[...columns[j]];
    for(let pass=0;pass<2;pass++) for(let i=0;i<j;i++) {
      const amount=dot(q[i],v); r[i][j]+=amount;
      for(let k=0;k<v.length;k++) v[k]-=amount*q[i][k];
    }
    r[j][j]=Math.hypot(...v);
    insist(r[j][j]>1e-8*Math.sqrt(samples.length),'Telemetry time window is numerically rank deficient.');
    q.push(v.map(value=>value/r[j][j]));
  }
  const solve=target=>{
    const result=[...target];
    for(let i=3;i>=0;i--) {
      for(let j=i+1;j<4;j++) result[i]-=r[i][j]*result[j];
      result[i]/=r[i][i];
    }
    return result;
  };
  const observed=samples.map(row=>row.position);
  const beta=solve(q.map(column=>dot(column,observed)));
  const residuals=observed.map((value,i)=>value-columns.reduce((sum,col,j)=>sum+col[i]*beta[j],0));
  const residualScale=Math.hypot(...residuals)/Math.sqrt(samples.length-4);
  const usedSigma=positionSigma ?? residualScale;
  const inverseColumns=Array.from({length:4},(_,j)=>solve(Array.from({length:4},(_,i)=>i===j?1:0)));
  const noiseGains=Array.from({length:4},(_,i)=>Math.hypot(...inverseColumns.map(column=>column[i])));
  const rateGain=noiseGains[1]/scale,accelerationGain=2*noiseGains[2]/(scale*scale);
  return {position:beta[0],rate:beta[1]/scale,acceleration:2*beta[2]/(scale*scale),
    rateSigma:usedSigma*rateGain,accelerationSigma:usedSigma*accelerationGain,
    rateNoiseGain:rateGain,accelerationNoiseGain:accelerationGain,localResidualScale:residualScale,
    conditionEstimate:Math.max(...r.map((row,i)=>row[i]))/Math.min(...r.map((row,i)=>row[i]))};
}

export function deriveTorqueObservations(telemetry, {inertia,windowSize=7,positionSigma=null}={}) {
  insist(Array.isArray(telemetry) && telemetry.length<=4096,'Telemetry must contain at most 4096 rows.');
  insist(Number.isInteger(windowSize) && windowSize>=5 && windowSize<=31 && windowSize%2===1,
    'windowSize must be an odd integer between 5 and 31.');
  insist(telemetry.length>=windowSize,`At least ${windowSize} telemetry rows are required.`);
  finite(inertia,'inertia'); insist(inertia>0,'Known inertia must be positive, in kg·m².');
  if(positionSigma!==null) { finite(positionSigma,'positionSigma',1e6); insist(positionSigma>=0,'positionSigma cannot be negative.'); }
  const source=telemetry.map((row,i)=>({
    time:finite(row?.time,`time at row ${i+1}`), position:finite(row?.position,`position at row ${i+1}`,1e6),
    command:finite(row?.command,`command at row ${i+1}`,1e6),
  }));
  const steps=[]; let possibleWraps=0;
  for(let i=1;i<source.length;i++) {
    insist(source[i].time>source[i-1].time,'Telemetry timestamps must be strictly increasing; missing data is not interpolated.');
    steps.push(source[i].time-source[i-1].time);
    if(Math.abs(source[i].position-source[i-1].position)>Math.PI) possibleWraps++;
  }
  const half=(windowSize-1)/2,estimates=[];
  for(let i=half;i<source.length-half;i++) {
    const local=localCubic(source.slice(i-half,i+half+1),source[i],positionSigma);
    const row={command:source[i].command,position:local.position,rate:local.rate,jointTorque:inertia*local.acceleration};
    finite(row.position,'derived position',1e6); finite(row.rate,'derived rate',1e6); finite(row.jointTorque,'derived torque');
    estimates.push({time:source[i].time,observation:row,acceleration:local.acceleration,
      positionSourceIndex:i,sourceStart:i-half,sourceEnd:i+half,
      rateSigma:local.rateSigma,jointTorqueSigma:inertia*local.accelerationSigma,
      jointTorqueNoiseGain:inertia*local.accelerationNoiseGain,localResidualScale:local.localResidualScale,
      conditionEstimate:local.conditionEstimate});
  }
  const gapRatio=Math.max(...steps)/Math.min(...steps);
  return {schema:'worldlaw.derived-torque/v1',provenance:'derived_from_angular_position',
    source,observations:estimates.map(row=>({...row.observation})),estimates,
    settings:{inertia,windowSize,positionSigma,angleConvention:'unwrapped_radians'},
    units:{time:'s',position:'rad',command:'N·m',rate:'rad/s',jointTorque:'N·m',inertia:'kg·m²'},
    diagnostics:{inputCount:source.length,outputCount:estimates.length,droppedEdges:half,
      uncertaintySource:positionSigma===null?'local_polynomial_residual_proxy':'caller_position_sigma',
      maxTorqueSigma:Math.max(...estimates.map(row=>row.jointTorqueSigma)),
      maxTorqueNoiseGain:Math.max(...estimates.map(row=>row.jointTorqueNoiseGain)),
      maxConditionEstimate:Math.max(...estimates.map(row=>row.conditionEstimate)),gapRatio,possibleWraps,
      warnings:[...(possibleWraps?['possible_angle_wrap_no_unwrapping_applied']:[]),...(gapRatio>10?['highly_irregular_sampling']:[])],
      limitations:[
        'Known constant inertia and aligned torque commands are assumed.',
        'Angles must already be unwrapped radians; no tracking or calibration is performed.',
        'Numerical differentiation amplifies noise and smoothing introduces truncation bias.',
        'Derived neighboring rows share raw observations and are correlated.',
        'Uncertainty propagation assumes independent position errors; it is not a confidence guarantee.',
        'Local fit residuals mix sensor noise with approximation error.',
      ],
    }};
}

/** Split with a source-window guard band so raw telemetry is never shared. */
export function splitTrajectoryEvidence(derived,{trainingFraction=.7}={}) {
  insist(derived?.schema==='worldlaw.derived-torque/v1' && Array.isArray(derived.estimates) && Array.isArray(derived.source),
    'Expected derived torque evidence.');
  finite(trainingFraction,'trainingFraction',1);
  insist(trainingFraction>0 && trainingFraction<1,'trainingFraction must lie strictly between 0 and 1.');
  const cut=Math.floor(derived.source.length*trainingFraction);
  const training=derived.estimates.filter(row=>row.sourceEnd<cut);
  const heldOut=derived.estimates.filter(row=>row.sourceStart>=cut);
  const crossing=derived.estimates.filter(row=>row.sourceStart<cut && row.sourceEnd>=cut);
  return {observations:training.map(row=>({...row.observation})),heldOut:heldOut.map(row=>({...row.observation})),
    provenance:'contiguous_time_split_with_disjoint_source_windows',
    split:{rawSourceCut:cut,excludedCrossingWindows:crossing.length,
      trainingRawIndices:training.length?[training[0].sourceStart,training.at(-1).sourceEnd]:null,
      heldOutRawIndices:heldOut.length?[heldOut[0].sourceStart,heldOut.at(-1).sourceEnd]:null,
      limitation:'Disjoint source windows do not make nearby physical states statistically independent or new mechanisms.'}};
}
