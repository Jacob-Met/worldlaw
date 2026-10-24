/** Explicit trailing-window starting-rate estimates, never future-conditioned. */
import {DiscoveryError} from './torque-discovery.mjs';
import {fitAngularWindow} from './angular-kinematics.mjs';
const insist=(ok,message)=>{if(!ok)throw new DiscoveryError(message,'invalid_prelude');};
const finite=value=>typeof value==='number'&&Number.isFinite(value);
export function estimateAngularPrelude(raw, endpoint, {windowSizes=[9,17,31],positionSigma=null}={}) {
 insist(Array.isArray(raw)&&raw.length>=5&&raw.length<=4096,'Supply 5–4096 prelude samples ending at the challenge start.');
 insist(endpoint&&finite(endpoint.time)&&finite(endpoint.position),'The challenge endpoint must contain finite time and position.');
 insist(Array.isArray(windowSizes)&&windowSizes.length>=1&&windowSizes.length<=14&&new Set(windowSizes).size===windowSizes.length&&Array.from(windowSizes).every(n=>Number.isInteger(n)&&n>=5&&n<=31&&n%2===1),'Declare unique odd trailing-window sizes from 5 through 31.');
 insist(positionSigma===null||(finite(positionSigma)&&positionSigma>=0&&positionSigma<=1e6),'Declare a nonnegative position-noise scale or null.');
 const samples=Array.from(raw,(row,i)=>{
  insist(row&&finite(row.time)&&Math.abs(row.time)<=1e12&&finite(row.position)&&Math.abs(row.position)<=1e6,'Prelude samples require bounded finite angular observations.');
  insist(row.time<=endpoint.time,'Future challenge observations cannot enter starting-rate estimation.');
  if(i)insist(row.time>raw[i-1].time,'Prelude timestamps must strictly increase.');
  return {time:row.time,position:row.position};
 });
 insist(samples.at(-1).time===endpoint.time&&samples.at(-1).position===endpoint.position,'Prelude endpoint must match the actual challenge starting observation exactly.');
 const estimates=windowSizes.map(windowSize=>{
  if(windowSize>samples.length)return {windowSize,status:'unavailable',reason:'insufficient_samples'};
  const window=samples.slice(-windowSize),base={windowSize,startTime:window[0].time,endTime:window.at(-1).time};
  try{return {...base,status:'estimated',...fitAngularWindow(window,endpoint,positionSigma)};}
  catch(error){return {...base,status:'unavailable',reason:error.message};}
 });
 const successful=estimates.filter(row=>row.status==='estimated');
 const spread=successful.length>=2?Math.max(...successful.map(row=>row.rate))-Math.min(...successful.map(row=>row.rate)):null;
 return {schema:'worldlaw.angular-prelude/v1',endpoint:{time:endpoint.time,position:endpoint.position},
  settings:{windowSizes:[...windowSizes],positionSigma},samples,estimates,rateSpread:spread,
  selectedWindow:null,selectionBasis:'none; every declared window retained',
  uncertaintySource:positionSigma===null?'polynomial_residual_proxy':'caller_declared_position_noise',
  units:{time:'s',position:'rad',rate:'rad/s',rateSigma:'rad/s'},
  limitations:['No future challenge angle, fitted physical model or supplied sensor rate enters estimation.',
   'Conditional noise propagation assumes independent position errors and a locally cubic trajectory; it excludes polynomial approximation bias.',
   'Longer windows can decrease reported conditional sigma while increasing derivative bias.',
   'Window disagreement is sensitivity evidence, not a calibrated confidence interval.',
   'No window is automatically selected; tuning with later challenge errors is exploratory reuse.',
   'Timestamp, angular calibration and source authenticity remain declared.']};
}
