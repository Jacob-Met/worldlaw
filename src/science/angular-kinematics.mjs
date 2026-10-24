/** Shared bounded angular-window kinematics; no inertia or torque assumption. */
import {DiscoveryError} from './torque-discovery.mjs';
const insist=(ok,message)=>{if(!ok)throw new DiscoveryError(message);};
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const dot=(a,b)=>a.reduce((sum,value,i)=>sum+value*b[i],0);

// Cubic regression in centered, scaled time; two-pass QR avoids subtracting a
// large absolute epoch or squaring a badly conditioned Vandermonde matrix.
export function fitAngularWindow(samples, center, positionSigma = null) {
  insist(Array.isArray(samples) && samples.length >= 5 && samples.length <= 31, 'An angular window requires 5–31 samples.');
  insist(center && finite(center.time), 'An angular window needs a finite center time.');
  insist(positionSigma === null || (finite(positionSigma) && positionSigma >= 0 && positionSigma <= 1e6), 'Position noise must be null or a finite nonnegative radian scale.');
  for (let i=0;i<samples.length;i++) {
    const row=samples[i];
    insist(row && finite(row.time) && Math.abs(row.time)<=1e12 && finite(row.position) && Math.abs(row.position)<=1e6, 'Angular samples must contain bounded finite times and positions.');
    if(i) insist(row.time>samples[i-1].time, 'Angular window timestamps must strictly increase.');
  }
  insist(center.time>=samples[0].time && center.time<=samples.at(-1).time, 'The fitted center must lie inside the observation window.');
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
  const result = {position:beta[0],rate:beta[1]/scale,acceleration:2*beta[2]/(scale*scale),
    rateSigma:usedSigma*rateGain,accelerationSigma:usedSigma*accelerationGain,
    rateNoiseGain:rateGain,accelerationNoiseGain:accelerationGain,localResidualScale:residualScale,
    conditionEstimate:Math.max(...r.map((row,i)=>row[i]))/Math.min(...r.map((row,i)=>row[i]))};
  insist(Object.values(result).every(finite), 'Angular window derivatives or conditional noise exceed finite numerical range.');
  return result;
}

