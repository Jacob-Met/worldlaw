import {inspectAffineClocks} from './clock-affine.mjs';
import {rational,sub,cmp,enclosure,serial} from '../unknown-lab/chronos-exact-halfplanes.mjs';
import {DiscoveryError} from './torque-discovery.mjs';
const check=(ok,message)=>{if(!ok)throw new DiscoveryError(message);};
const integer=(text,label)=>{check(typeof text==='string'&&/^(?:0|-?[1-9]\d{0,29})$/.test(text),`${label} must be a canonical integer string of at most 30 digits.`);return BigInt(text);};
const clone=x=>JSON.parse(JSON.stringify(x));
/** Original device ticks are subtracted EXACTLY before conversion to seconds.
 * The supplied origins and rates are declarations, never inferred alignment.
 */
export function normalizeClockTicks(raw){
 check(raw?.schema==='worldlaw.clock-tick-input/v1','Expected integer-clock input v1.');
 check(raw.units?.time==='ticks','Declare original time units as ticks.');
 check(!Object.hasOwn(raw,'stateOrigin')&&!Object.hasOwn(raw,'torqueOrigin'),'Declare origins only in the original tick clocks, not a second seconds-origin field.');
 check(Array.isArray(raw.hypotheses)&&raw.hypotheses.length>=1&&raw.hypotheses.length<=65,'Supply 1–65 affine hypotheses.');
 const tolerance=raw.maximumRoundingErrorSeconds;
 check(typeof tolerance==='number'&&Number.isFinite(tolerance)&&tolerance>=0&&tolerance<=.001,'Declare maximumRoundingErrorSeconds between zero and 0.001.');
 const toleranceQ=rational(tolerance),receipts={};let largestError=[0n,1n];
 function channel(name,rows,minimum,maximum){
  check(Array.isArray(rows)&&rows.length>=minimum&&rows.length<=maximum,`${name} must contain ${minimum}–${maximum} rows.`);
  const clock=raw.clocks?.[name],origin=integer(clock?.origin,`${name} clock origin`),rate=integer(clock?.ticksPerSecond,`${name} ticksPerSecond`);
  check(rate>0n&&rate<=1_000_000_000_000n,'Clock rate must be between 1 and 1000000000000 ticks per second.');
  let previousTick=null,previousTime=null;const witnesses=[];
  const converted=rows.map((row,index)=>{
   check(row&&typeof row==='object'&&!Array.isArray(row)&&!Object.hasOwn(row,'time'),'Tick rows require timestampTicks; a second time field is ambiguous.');
   const tick=integer(row.timestampTicks,`${name} row ${index+1} timestamp`),delta=tick-origin;
   check(previousTick===null||tick>previousTick,`${name} original tick timestamps must strictly increase.`);
   check(delta>=-1_000_000n*rate&&delta<=1_000_000n*rate,'Each declared-origin-relative time must be within ±1000000 seconds.');
   const exact=[delta,rate],bounds=enclosure(exact);
   const time=bounds.lower+(bounds.upper-bounds.lower)/2;
   const signedError=sub(rational(time),exact),error=[signedError[0]<0n?-signedError[0]:signedError[0],signedError[1]];
   if(cmp(error,largestError)>0)largestError=error;
   check(cmp(error,toleranceQ)<=0,`${name} row ${index+1} conversion exceeds the declared rounding-error bound.`);
   check(previousTime===null||time>previousTime,`${name} timestamp resolution collapses after conversion; choose a closer declared origin or a shorter course.`);
   witnesses.push({sourceIndex:index,originalTicks:row.timestampTicks,relativeTicks:delta.toString(),secondsBounds:bounds,seconds:time,absoluteRoundingError:serial(error)});
   previousTick=tick;previousTime=time;
   const {timestampTicks,...values}=row;return {...values,time};
  });
  receipts[name]={origin:clock.origin,ticksPerSecond:clock.ticksPerSecond,rows:witnesses};return converted;
 }
 const states=channel('state',raw.states,4,2048),torques=channel('torque',raw.torques,2,4096);
 const input={schema:'worldlaw.clock-affine-input/v1',source:raw.source,units:{...raw.units,time:'s'},stateOrigin:0,torqueOrigin:0,maxGap:raw.maxGap,tieTolerance:raw.tieTolerance,hypotheses:clone(raw.hypotheses),states,torques};
 return {input,conversion:{schema:'worldlaw.clock-tick-conversion/v1',clocks:receipts,maximumRoundingErrorSeconds:tolerance,largestRoundingError:serial(largestError),largestRoundingErrorSecondsUpper:enclosure(largestError).upper,interpretation:'Affine hypotheses map seconds relative to the separately declared original clock origins.',limitations:[
  'Integer timestamp strings are retained and origins are subtracted exactly before binary64 conversion.',
  'The receipt bounds numerical representation error only, not sensor jitter, clock-rate calibration or synchronization.',
  'The affine comparison consumes the declared representative seconds. Numeric conversion enclosures are not propagated as physical timing uncertainty.',
  'Origins and tick rates are caller declarations; the adapter does not infer alignment or repair resets, missing samples or reversed chronology.',
 ]}};
}
export function inspectClockTickEvidence(model,raw){const {input,conversion}=normalizeClockTicks(raw);return {result:inspectAffineClocks(model,input),conversion};}
export function exportClockTickInvestigation(model,input){inspectClockTickEvidence(model,input);return JSON.stringify({schema:'worldlaw.clock-tick-investigation/v1',model:clone(model),input:clone(input)},null,2);}
export function reopenClockTickInvestigation(text){check(typeof text==='string'&&text.length<=2_000_000,'Investigation must be at most 2 MB.');const saved=JSON.parse(text);check(saved?.schema==='worldlaw.clock-tick-investigation/v1','Expected integer-clock investigation v1.');return {model:saved.model,input:saved.input,...inspectClockTickEvidence(saved.model,saved.input)};}
