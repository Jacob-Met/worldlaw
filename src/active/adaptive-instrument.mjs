/** Separate source-bound synthetic apparatus. This module never imports a
 * candidate model, calls its simulator or reads its inferred survivor set.
 * Its fixed coupling is [1,0,1]; it evaluates the closed position response to
 * the selected frozen input. This is an authored instrument, not physical data.
 */
export const ADAPTIVE_DEMO_SOURCE_SHA256='6d4c8ce6d1503a2de318e50f0da1d9462156e773f3882be384c0502517dd63c3';
function hundredths(value){
  let numerator=BigInt(value),denominator=100n,a=numerator<0n?-numerator:numerator,b=denominator;
  while(b)[a,b]=[b,a%b];const divisor=a||1n;numerator/=divisor;denominator/=divisor;
  return denominator===1n?String(numerator):numerator+'/'+denominator;
}
export function adaptiveTrackReadings(book){
  if(book.plan.sourceSHA256!==ADAPTIVE_DEMO_SOURCE_SHA256||
    book.plan.status!=='optimal_certified_adaptive_policy')throw Error('This synthetic apparatus is bound to its original coupled-track source.');
  const last=book.readouts.at(-1)?.result;
  if(last&&last.status!=='continue_frozen_policy')throw Error('This apparatus notebook has no pending experiment.');
  const key=last?last.nextStateKey:book.plan.policy.rootKey;
  const node=book.plan.policy.states.find(row=>row.key===key);
  const experiment=book.plan.experiments.find(row=>row.id===node?.action);
  if(!experiment)throw Error('The frozen apparatus input is missing.');
  const inputs=experiment.controls.map(row=>row.map(value=>{
    if(!/^[01]$/.test(value))throw Error('Synthetic apparatus received an unexpected input.');return Number(value);
  }));
  const round=book.readouts.length+1,position=370+29*round,velocity=-210+17*round;
  const readings=experiment.readings.map(({tick})=>{
    let response=0;
    for(let inputTick=0;inputTick<tick;inputTick++)
      response+=(tick-1-inputTick)*(inputs[inputTick][0]+inputs[inputTick][2]);
    const boundedError=tick%2?-1:1;
    return {tick,value:hundredths(position+tick*velocity+100*response+boundedError)};
  });
  return {schema:'worldlaw.active-adaptive-readings/v1',
    source:'Separate closed-form synthetic track apparatus v1; fresh unobserved position and velocity each round, bounded rational perturbations.',
    acquisition:'synthetic',sourceSHA256:book.plan.sourceSHA256,planSHA256:book.plan.planSHA256,
    round,previousReadingsSHA256:last?.readingsSHA256??null,stateKey:key,experimentId:experiment.id,readings};
}
