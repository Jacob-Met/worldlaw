/** Independent controlled ODE instrument. Its private parameters never enter acquired evidence.
 * This is a synthetic, known-inertia instrument, not physical hardware.
 */
import {RUN_UNITS, validateRun} from './data.mjs';
const REQUEST='worldlaw.continuous-command-request/v1';
const copy=value=>JSON.parse(JSON.stringify(value));
const check=(ok,message)=>{if(!ok)throw new RangeError(message);};
const finite=(v,lo,hi,name)=>{check(typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi,'Invalid '+name);return v;};

export function commandSamples(raw,{amplitudeBounds=[-1,1],maximumSamples=4096}={}) {
  check(raw&&raw.schema===REQUEST,'Unsupported continuous command request');
  const r=copy(raw);
  finite(r.inertia,.01,1e4,'inertia');
  finite(r.initialPosition,-20,20,'initialPosition');finite(r.initialRate,-20,20,'initialRate');
  finite(r.duration,.1,60,'duration');finite(r.dt,.001,.2,'dt');
  finite(r.noiseSigma,0,1,'noiseSigma');
  check(Array.isArray(amplitudeBounds)&&amplitudeBounds.length===2&&
    amplitudeBounds.every(Number.isFinite)&&amplitudeBounds[0]<amplitudeBounds[1],'Invalid actuator bounds');
  const n=Math.round(r.duration/r.dt);
  check(n>=1&&n+1<=maximumSamples&&Math.abs(n*r.dt-r.duration)<=32*Number.EPSILON*r.duration,
    'Duration must contain a bounded whole number of sample intervals');
  check(Array.isArray(r.segments)&&r.segments.length>=1&&r.segments.length<=32,'Invalid actuator segments');
  let cursor=0;
  for(const s of r.segments){
    check(Number.isSafeInteger(s.startIndex)&&Number.isSafeInteger(s.endIndex)&&
      s.startIndex===cursor&&s.endIndex>cursor&&s.endIndex<=n,'Segments must partition every sample interval');
    finite(s.amplitude,amplitudeBounds[0],amplitudeBounds[1],'amplitude');cursor=s.endIndex;
  }
  check(cursor===n,'Command schedule has an unassigned suffix');
  const samples=[];
  let segment=0;
  for(let i=0;i<=n;i++){
    while(segment<r.segments.length-1&&i>=r.segments[segment].endIndex)segment++;
    samples.push({time:i*r.dt,command:r.segments[segment].amplitude});
  }
  return {request:r,samples};
}

function generator(seed){
  let state=seed>>>0;
  if(!state)state=0x9e3779b9;
  const uniform=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return ((state>>>0)+.5)/4294967296;};
  return ()=>Math.sqrt(-2*Math.log(uniform()))*Math.cos(2*Math.PI*uniform());
}

/** No learned model, proposed forecast, future label, or parameter estimate is accepted. */
export function createControlledInstrument(raw) {
  const p=copy(raw);
  check(typeof p.sourceId==='string'&&p.sourceId.length>0&&p.sourceId.length<80,'Require source identity');
  finite(p.inertia,.01,1e4,'inertia');finite(p.noiseSigma,0,1,'noiseSigma');
  check(Number.isSafeInteger(p.seed)&&p.seed>=0&&p.seed<=0xffffffff,'Require uint32 seed');
  check(Number.isSafeInteger(p.maximumAcquisitions)&&p.maximumAcquisitions>=1&&p.maximumAcquisitions<=32,'Invalid acquisition budget');
  const drive=p.drive??{}, restoring=p.restoring??{};
  for(const k of ['linear','cubic'])finite(drive[k]??0,-10,10,'drive '+k);
  for(const k of ['spring','gravity','cubic'])finite(restoring[k]??0,0,10,'restoring '+k);
  finite(p.damping,0,10,'damping');
  const hidden=p.hidden??{coupling:0,frequency:1,damping:0};
  finite(hidden.coupling,0,10,'hidden coupling');finite(hidden.frequency,.1,10,'hidden frequency');
  finite(hidden.damping,0,10,'hidden damping');
  const bounds=p.amplitudeBounds??[-1,1];
  check(Array.isArray(bounds)&&bounds.length===2&&bounds.every(Number.isFinite)&&bounds[0]<bounds[1]&&
    Math.max(...bounds.map(Math.abs))<=10,'Invalid physical amplitude envelope');
  const step=finite(p.integrationStep??.001,.0001,.005,'integrationStep');
  let acquired=0,chargedSamples=0;
  const calls=[];
  function acquire(rawRequest) {
    check(acquired<p.maximumAcquisitions,'Independent acquisition budget exhausted');
    const {request:r,samples}=commandSamples(rawRequest,{amplitudeBounds:bounds});
    check(r.inertia===p.inertia&&r.noiseSigma===p.noiseSigma,'Request changes declared instrument inertia/noise');
    // Charge before execution; a failed physical or numerical acquisition is not free.
    const index=acquired++;chargedSamples+=samples.length;
    calls.push(copy(r));
    const normal=generator((p.seed+Math.imul(index+1,0x9e3779b9))>>>0);
    let state=[r.initialPosition,r.initialRate,0,0];
    const derivative=(s,u)=>{
      const [q,v,z,w]=s;
      const torque=(drive.linear??0)*u+(drive.cubic??0)*u**3-p.damping*v-
        (restoring.spring??0)*q-(restoring.gravity??0)*Math.sin(q)-(restoring.cubic??0)*q**3-
        hidden.coupling*(q-z);
      return [v,torque/p.inertia,w,hidden.frequency**2*(q-z)-hidden.damping*w];
    };
    const combine=(a,k,h)=>a.map((v,j)=>v+h*k[j]);
    const observations=[{...samples[0],position:state[0]}];
    let steps=0;
    for(let i=0;i<samples.length-1;i++){
      const elapsed=samples[i+1].time-samples[i].time;
      const count=Math.max(1,Math.ceil(elapsed/step)),h=elapsed/count,u=samples[i].command;
      for(let j=0;j<count;j++){
        const a=derivative(state,u),b=derivative(combine(state,a,h/2),u),
          c=derivative(combine(state,b,h/2),u),d=derivative(combine(state,c,h),u);
        state=state.map((v,k)=>v+h*(a[k]+2*b[k]+2*c[k]+d[k])/6);
        check(state.every(v=>Number.isFinite(v)&&Math.abs(v)<=100),'Independent instrument escaped its registered state envelope');
        steps++;
      }
      observations.push({...samples[i+1],position:state[0]+p.noiseSigma*normal()});
    }
    const id=p.sourceId+'-acquisition-'+index;
    return validateRun({id,label:'Controlled synthetic acquisition '+index,kind:'synthetic',
      units:{...RUN_UNITS},inertia:p.inertia,initialRate:r.initialRate,
      source:{label:'Independent controlled ODE instrument',recordingId:id,
        instrument:'worldlaw.controlled-ode-instrument/v1',sourceId:p.sourceId,
        request:copy(r),acquisitionIndex:index,noise:{distribution:'iid_gaussian',sigma:p.noiseSigma,
          initialPosition:'exactly set by the synthetic instrument; later observations noisy'},
        integrator:{method:'independent_classical_RK4',maximumStep:step,steps},
        truthParametersExposed:false,physicalHardware:false},
      samples:observations},{role:'training'});
  }
  return Object.freeze({acquire,envelope:Object.freeze({inertia:p.inertia,noiseSigma:p.noiseSigma,
    amplitudeBounds:Object.freeze([...bounds]),maximumAcquisitions:p.maximumAcquisitions,
    physicalHardware:false}),usage:()=>({acquired,chargedSamples,requests:copy(calls)})});
}

/** Bind supplied evidence to the prospective command; no interpolation or repair. */
export function receiveContinuousRun(request,rawRun,{amplitudeBounds=[-1,1]}={}) {
  const expected=commandSamples(request,{amplitudeBounds});
  const run=validateRun(rawRun,{role:'training'});
  check(run.inertia===request.inertia&&run.initialRate===request.initialRate&&
    run.samples[0].position===request.initialPosition,'Acquired initial state/inertia mismatch');
  check(run.samples.length===expected.samples.length,'Incomplete prospective observation grid');
  for(let i=0;i<run.samples.length;i++){
    check(run.samples[i].time===expected.samples[i].time,'Acquired timestamp mismatch');
    check(run.samples[i].command===expected.samples[i].command,'Applied actuator schedule mismatch');
  }
  return run;
}
