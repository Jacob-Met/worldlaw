import {commandSamples} from './controlled-instrument.mjs';

/** Request one signed interior excitation for the aliased linear/cubic actuator.
 * Only applied command intervals are inspected, never measured states. */
export function planActuatorExcitation(trainingRuns, template, {amplitudeBounds=[-1,1]}={}) {
  if (!Array.isArray(trainingRuns) || trainingRuns.length<1 || trainingRuns.length>3 ||
      trainingRuns.some(run=>!run || typeof run.id!=='string' || !run.id.trim()) ||
      new Set(trainingRuns.map(run=>run.id)).size!==trainingRuns.length)
    throw new RangeError('Require one to three distinct training acquisitions');
  if (!Array.isArray(amplitudeBounds) || amplitudeBounds.length!==2 ||
      !amplitudeBounds.every(Number.isFinite) || amplitudeBounds[0]>=amplitudeBounds[1])
    throw new RangeError('Invalid amplitude bounds');
  const {request,samples}=commandSamples(template);
  const n=samples.length-1;
  if(n%4) throw new RangeError('Four equal dwells require a multiple of four sample intervals');
  let active=0,total=0;
  for(const run of trainingRuns){
    if(!Array.isArray(run.samples)||run.samples.length<2)throw new RangeError('Missing command intervals');
    total+=run.samples.length;
    if(total>8192)throw new RangeError('Training sample budget exceeded');
    for(let i=0;i<run.samples.length-1;i++){
      const u=run.samples[i].command;
      if(!Number.isFinite(u))throw new RangeError('Invalid training command');
      if(u!==0&&u!==1&&u!==-1)return {status:'outside_aliased_alphabet',request:null};
      if(u!==0)active++;
    }
  }
  if(!active)return {status:'no_source_actuation',request:null};
  const limit=Math.min(1,-amplitudeBounds[0],amplitudeBounds[1]);
  if(limit<=0)return {status:'no_symmetric_command',request:null};
  const a=Math.min(limit,1/Math.sqrt(3)),contrast=a-a**3;
  const determinant=active*n*contrast**2;
  if(!(determinant>0))return {status:'unresolved_numerical_contrast',request:null};
  const segments=[a,-a,-a,a].map((amplitude,i)=>({startIndex:i*n/4,endIndex:(i+1)*n/4,amplitude}));
  const checked=commandSamples({...request,segments},{amplitudeBounds});
  return {status:'planned',request:checked.request,sourceActiveIntervals:active,
    addedIntervals:n,amplitude:a,actuatorFeatureContrast:contrast,
    jointGramDeterminant:determinant};
}
