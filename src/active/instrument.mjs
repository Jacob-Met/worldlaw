/** A separate, deliberately small synthetic instrument. It does not call the
 * candidate simulator or choose a law from the planner's predicted outputs. */
export const COUPLED_DEMO_SOURCE_SHA256='f7f996c569a07cf9b2a3230c12519bd80536cc0a2082f857b3ca671c1e4ffe19';
export const COUPLED_DEMO_PROFILES=Object.freeze({
  unit:{gain:1,label:'Unit coupling'},double:{gain:2,label:'Double coupling'},
  outside:{gain:5,label:'Outside the offered family'},partial:{gain:1,label:'Only the first planned reading'},
});
export function coupledDemoReadings(plan,profile='unit'){
  if(plan?.sourceSHA256!==COUPLED_DEMO_SOURCE_SHA256||plan.status!=='optimal_certified_intervention'||
    plan.chosenIntervention!=='velocity_pulse')throw Error('This separate synthetic instrument is attached only to the unchanged coupled-track example. Supply readouts for other sources.');
  const setting=COUPLED_DEMO_PROFILES[profile];
  if(!setting)throw Error('Choose a declared synthetic instrument profile.');
  const ticks=plan.chosenReadings.map(row=>row.tick);
  // Independently derived closed response for p[t+1]=p[t]+g*v[t],
  // v[t+1]=v[t]+u[t], p[0]=3, v[0]=-2, u[0]=1, later u=0.
  const requested=profile==='partial'?ticks.slice(0,1):ticks;
  return {
    schema:'worldlaw.active-linear-readings/v1',
    source:'Separate synthetic coupled-track instrument v1; p0=3, v0=-2, gain='+setting.gain+
      ', pulse u0=1. Exact discrete outputs; no random error added and no physical acquisition.',
    acquisition:'synthetic',sourceSHA256:plan.sourceSHA256,planSHA256:plan.planSHA256,
    interventionId:plan.chosenIntervention,
    readings:requested.map(tick=>({tick,value:3+setting.gain*(-2*tick+Math.max(0,tick-1))})),
  };
}
