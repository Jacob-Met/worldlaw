import {rational as R,add,sub,mul,div,cmp,serial,enclosure} from '../unknown-lab/chronos-exact-halfplanes.mjs';
const ZERO=R(0),TWO=R(2);
export function isMatchedReversal(a,b){
  return a.command===b.command&&a.position===b.position&&a.rate!==0&&a.rate===-b.rate;
}
function projectedInterval(lower,upper,scale){
  let a=mul(lower,scale),b=mul(upper,scale);
  if(cmp(a,b)>0)[a,b]=[b,a];
  return {exact:[serial(a),serial(b)],display:[enclosure(a).lower,enclosure(b).upper],
    sign:cmp(a,ZERO)>0?'positive':cmp(b,ZERO)<0?'negative':'includes_zero'};
}

/** Interpret one original pair from a freshly computed maintained contrast report.
 * This is not a JSON report importer or independent evidence admission path.
 */
export function rateReversal(report,pairIndex){
  if(report?.schema!=='worldlaw.prediction-contrast/v1'||report.status!=='computed'||
    !Number.isSafeInteger(pairIndex)||pairIndex<0||pairIndex>=report.pairs.length)
    throw Error('Select a pair from a freshly computed contrast report.');
  const pair=report.pairs[pairIndex],first=report.marginal.rows[pair.firstRow],second=report.marginal.rows[pair.secondRow];
  const a=first.input,b=second.input;
  if(!isMatchedReversal(a,b))
    return {status:'not_matched_reversal',firstRow:pair.firstRow,secondRow:pair.secondRow};
  // Use original observed centers and original declared radius, not the
  // already-rounded generic contrast endpoints or a fitted observation.
  const center=sub(R(first.observedTorque),R(second.observedTorque));
  const radius=mul(TWO,R(report.marginal.settings.receivingRadius));
  const scale=div(R(a.rate),TWO);
  const observed=projectedInterval(sub(center,radius),add(center,radius),scale);
  const predicted=projectedInterval(R(pair.prediction[0]),R(pair.prediction[1]),scale);
  return {schema:'worldlaw.rate-reversal/v1',status:'computed',firstRow:pair.firstRow,secondRow:pair.secondRow,
    input:{command:a.command,position:a.position,firstRate:a.rate,secondRate:b.rate},units:{power:'W'},observed,predicted,
    originalCompatibility:pair.status,originalNumericalQualification:report.numericalQualification,
    interpretation:'The source-pair statistic is omega_first*(torque_first-torque_second)/2. Observed bounds use exact arithmetic on supplied binary64 readings and declared separate torque-reading boxes. Only the odd-in-rate response is isolated under identical declared angle/command and matched magnitudes. State/history matching, acquisition independence, drift, coordinate error and physical validity remain unverified. This is not a physical activity or passivity certificate. Predicted bounds retain the original floating-point QR and engineering-screen qualification.'};
}
