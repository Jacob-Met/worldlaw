/** Serializable continuous actuator law. Three nonoverlapping Hann bursts.
 * Energy is integrated analytically; peak is a conservative physical bound.
 */
const need=(ok,message)=>{if(!ok)throw new RangeError(message);};
const triple=(a,p)=>Array.isArray(a)&&a.length===3&&Array.from(a).every(p);
function cosineIntegral(w,phase,length) {
  const x=w*length/2;
  const sinc=Math.abs(x)<1e-4?1-x*x/6+x**4/120-x**6/5040:Math.sin(x)/x;
  return length*Math.cos(phase+x)*sinc;
}
export function burstEnergyIntegral(frequency,phase,length) {
  need([frequency,phase,length].every(Number.isFinite)&&frequency>0&&length>0,'Invalid burst integral');
  const w=4*Math.PI*frequency,k=2*Math.PI/length,p=2*phase;
  const c=(a)=>cosineIntegral(a,p,length);
  return 3*length/16-3*c(w)/16+(c(w+k)+c(w-k))/8-(c(w+2*k)+c(w-2*k))/32;
}
export function compileBurstSchedule(schedule) {
  need(schedule?.schema==='worldlaw.hann-bursts/v1','Invalid continuous waveform schema');
  need(Object.keys(schedule).every(k=>['schema','duration','cycles','phases','energyShares','rms','peak'].includes(k)),'Unexpected waveform metadata');
  const {duration,cycles,phases,energyShares,rms,peak}=schedule;
  need(Number.isFinite(duration)&&duration>0&&duration<=1e6,'Invalid waveform duration');
  need(triple(cycles,x=>Number.isFinite(x)&&x>=.5&&x<=128),'Invalid burst frequencies');
  need(triple(phases,x=>Number.isFinite(x)&&Math.abs(x)<=Math.PI),'Invalid burst phases');
  need(triple(energyShares,x=>Number.isFinite(x)&&x>0&&x<1)&&Math.abs(energyShares.reduce((s,x)=>s+x,0)-1)<=1e-12,'Invalid energy shares');
  need([rms,peak].every(x=>Number.isFinite(x)&&x>0&&x<=1e3),'Invalid actuator energy or peak');
  const targetEnergy=rms*rms*duration;
  need(Number.isFinite(targetEnergy)&&targetEnergy>0,'Requested positive actuator energy is not representable');
  const phaseValues=phases.slice(),length=duration/3,frequencies=cycles.map(c=>c/duration);
  const integrals=frequencies.map((f,i)=>burstEnergyIntegral(f,phaseValues[i],length));
  need(integrals.every(x=>Number.isFinite(x)&&x>1e-12*length),'Degenerate burst energy');
  const amplitudes=integrals.map((v,i)=>Math.sqrt(targetEnergy*energyShares[i]/v));
  need(amplitudes.every(a=>Number.isFinite(a)&&a>0&&a<=peak*(1+1e-12)),'Continuous waveform exceeds its peak bound');
  const totalEnergy=amplitudes.reduce((s,a,i)=>s+a*a*integrals[i],0);
  need(Number.isFinite(totalEnergy)&&totalEnergy>0&&Math.abs(totalEnergy/targetEnergy-1)<=1e-12,'Actuator energy cannot be represented within tolerance');
  const at=time=>{
    need(Number.isFinite(time)&&time>=-1e-12*duration&&time<=duration*(1+1e-12),'Command outside declared waveform interval');
    if(time<=0||time>=duration)return 0;
    const i=Math.min(2,Math.floor(time/length)),t=time-i*length;
    if(t===0)return 0;
    return amplitudes[i]*Math.sin(Math.PI*t/length)**2*Math.sin(2*Math.PI*frequencies[i]*t+phaseValues[i]);
  };
  Object.freeze(amplitudes);Object.freeze(integrals);
  return Object.freeze({at,amplitudes,integrals,totalEnergy,peakBound:Math.max(...amplitudes),
    maximumComponentFrequency:Math.max(...frequencies)+1/length,
    derivativeBound:Math.max(...amplitudes.map((a,i)=>a*(Math.PI/length+2*Math.PI*frequencies[i])))});
}
export function compileContinuousInput(input,kind,n) {
  need(input?.schema==='worldlaw.continuous-input/v1'&&Number.isFinite(input.startTime),'Invalid continuous input descriptor');
  need(Object.keys(input).every(k=>['schema','startTime','waveform','profile'].includes(k)),'Unexpected continuous input metadata');
  const startTime=input.startTime;
  need(['oscillator','kinetic','periodic'].includes(kind),'Invalid actuator geometry');
  need(Number.isInteger(n)&&n>=2&&n<=128&&(kind==='periodic'||n===2),'Invalid actuator dimension');
  const wave=compileBurstSchedule(input.waveform);
  if(kind==='oscillator')need(input.profile===undefined,'Scalar oscillator input has no spatial profile');
  else need(Array.isArray(input.profile)&&input.profile.length===n&&Array.from(input.profile).every(x=>Number.isFinite(x)&&Math.abs(x)<=4)&&input.profile.some(x=>x!==0),'Invalid actuator profile');
  const profile=kind==='oscillator'?[1]:input.profile.slice();
  return Object.freeze({...wave,at:time=>{
    const value=wave.at(time-startTime);
    return kind==='oscillator'?value:profile.map(x=>x*value);
  },profileMeanSquare:profile.reduce((s,x)=>s+x*x,0)/profile.length,
    physicalPeakBound:wave.peakBound*Math.max(...profile.map(Math.abs))});
}
export function validateRecordedContinuousInput(run) {
  if(run.continuousInput===undefined)return null;
  const {samples,kind}=run,n=samples[0].state.length,input=run.continuousInput;
  const compiled=compileContinuousInput(input,kind,n),dt=samples[1].time-samples[0].time;
  const duration=samples.at(-1).time-samples[0].time;
  need(Math.abs(input.startTime-samples[0].time)<=1e-10*Math.max(1,duration)&&
    Math.abs(input.waveform.duration-duration)<=1e-10*Math.max(1,duration),'Continuous input and recording intervals differ');
  // Carrier plus Hann-envelope resolution rule, not a strict band-limit claim.
  need(dt*compiled.maximumComponentFrequency<=1/8+1e-12,'Continuous input is unresolved on the declared sample grid');
  const tolerance=1e-10*Math.max(1,compiled.physicalPeakBound);
  for(const row of samples) {
    const expected=compiled.at(row.time);
    need(kind==='oscillator'?Math.abs(row.command-expected)<=tolerance:
      Array.isArray(row.command)&&row.command.length===n&&Array.from(row.command).every((v,j)=>Number.isFinite(v)&&Math.abs(v-expected[j])<=tolerance),'Recorded commands disagree with continuous input');
  }
  return compiled;
}
