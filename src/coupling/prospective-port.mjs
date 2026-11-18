// Prospective intervention: commit a bounded command BEFORE reading an encoder.
// This is model-conditioned offline experiment design, never motor actuation.
import {schedulePortObservations, comparePortObservation} from './actuator-port.mjs';

export const PROSPECTIVE_PORT_SCHEMA = 'worldlaw.prospective-port/v1';
const FAMILIES = Object.freeze(['hold','sine','double-sine','delayed']);
const number = (x,lo,hi) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
const fail = message => { throw Error(message); };
const angleGap = (a,b) => Math.hypot(...[0,1].map(i=>Math.atan2(Math.sin(a[i]-b[i]),Math.cos(a[i]-b[i]))));
const approx = (a,b) => Math.abs(a-b) <= 1e-10;
const identical = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const freezeCopy = value => JSON.parse(JSON.stringify(value));

function normalize(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source) ||
      Object.keys(source).some(key => !['initial','settings'].includes(key))) fail('Declare only initial encoder state and experiment constraints.');
  const initial=source.initial;
  if (!Array.isArray(initial) || initial.length!==4 ||
      !initial.slice(0,2).every(x=>number(x,-Math.PI,Math.PI)) ||
      !initial.slice(2).every(x=>number(x,-15,15))) fail('Supply four bounded finite initial encoder coordinates/rates.');
  const s=source.settings;
  if (!s || Object.keys(s).sort().join(',') !== 'amplitudeCapNm,contrastRadiusRad,durationSeconds,impulseCapNms,maxSlewNmPerSecond,stepSeconds') {
    fail('Declare amplitude, impulse, slew, duration, step and encoder contrast bounds explicitly.');
  }
  if (!number(s.stepSeconds,.005,.02) || !number(s.durationSeconds,.12,.35) ||
      !Number.isInteger(Math.round(s.durationSeconds/s.stepSeconds)) ||
      !approx(Math.round(s.durationSeconds/s.stepSeconds)*s.stepSeconds,s.durationSeconds)) {
    fail('Use an exact 0.005–0.02 s time grid and 0.12–0.35 s horizon.');
  }
  const steps=Math.round(s.durationSeconds/s.stepSeconds);
  if(steps<8 || steps>70 || !number(s.amplitudeCapNm,.3,3) ||
     !number(s.impulseCapNms,.01,1) || !number(s.maxSlewNmPerSecond,3,200) ||
     !number(s.contrastRadiusRad,.001,.3)) fail('Constraints exceed the bounded prospective design domain.');
  return {initial:[...initial],settings:{...s},steps};
}

function commands(steps, settings, family, polarity, amplitude) {
  const {stepSeconds:dt,durationSeconds:horizon} = settings;
  const ramp=Math.max(dt*2,.03);
  const values=Array.from({length:steps+1},(_,i)=>{
    const time=i*dt;
    const envelope=Math.min(1,time/ramp,Math.max(0,(horizon-time)/ramp));
    const shape=family==='hold'?1:family==='sine'?Math.sin(2*Math.PI*time/horizon):
      family==='double-sine'?Math.sin(4*Math.PI*time/horizon):
      Math.max(0,Math.min(1,(time-horizon*.40)/ramp));
    return polarity*amplitude*envelope*shape;
  });
  // The last sample is an unactuated boundary: drive[i] is held over [i,i+1).
  values[steps]=0;
  return values;
}
function admitted(torques,s) {
  const dt=s.stepSeconds, impulse=torques.slice(0,-1).reduce((sum,x)=>sum+Math.abs(x)*dt,0);
  const slew=torques.slice(1).reduce((greatest,x,i)=>Math.max(greatest,Math.abs(x-torques[i])/dt),0);
  return {impulse,slew,within:impulse<=s.impulseCapNms+1e-12 &&
    slew<=s.maxSlewNmPerSecond+1e-12 &&
    torques.every(v=>Math.abs(v)<=s.amplitudeCapNm+1e-12)};
}
function forecast(initial,s,torques,maxIntegrationStep) {
  const drive=torques.map((torque,i)=>({time:i*s.stepSeconds,torque}));
  // The physical port is deliberately withheld; both independent branches use the same drive.
  const plan=schedulePortObservations(drive,0,initial,.5,maxIntegrationStep);
  return {drive, predictions:plan.predictions};
}
function scoreCandidate(initial,s,torques,id) {
  const effort=admitted(torques,s);
  if(!effort.within) return null;
  const coarse=forecast(initial,s,torques,.005);
  const fine=forecast(initial,s,torques,.0025);
  const readings=coarse.predictions.map((p,i)=>{
    const q=fine.predictions[i];
    const numerical=Math.max(angleGap(p.shoulder,q.shoulder),angleGap(p.elbow,q.elbow));
    return {index:p.index,time:p.elapsed,shoulder:p.shoulder,elbow:p.elbow,
      separation:p.separation,numerical,
      // Both model forecasts may err under step refinement. Their individual
      // position balls must be disjoint after adding declared observation radius.
      certifiedMargin:p.separation-2*(s.contrastRadiusRad+numerical)};
  });
  const safe=readings.filter(r=>r.numerical <= .01);
  const first=safe.find(r=>r.certifiedMargin>1e-6);
  const best=safe.reduce((a,b)=>!a||b.certifiedMargin>a.certifiedMargin?b:a,null);
  return {id,drive:coarse.drive,impulseNms:effort.impulse,peakSlewNmPerSecond:effort.slew,
    numericalStatus:safe.length===readings.length?'qualified':'refused-step-sensitivity',
    readings, firstWitness:first?.index??null,
    maxCertifiedMargin:best?.certifiedMargin??null};
}

export function planProspectivePortIntervention(input) {
  const {initial,settings:s,steps}=normalize(input);
  const amplitudes=[.4,.7,1].map(f=>Math.min(s.amplitudeCapNm,s.amplitudeCapNm*f))
    .filter((a,i,self)=>i===self.indexOf(a));
  const candidates=[];
  for(const family of FAMILIES)for(const polarity of [1,-1])for(const amplitude of amplitudes) {
    const id=family+'-'+(polarity>0?'positive':'negative')+'-'+amplitudes.indexOf(amplitude);
    const candidate=scoreCandidate(initial,s,commands(steps,s,family,polarity,amplitude),id);
    if(candidate)candidates.push(candidate);
  }
  if(!candidates.length) return {schema:PROSPECTIVE_PORT_SCHEMA,source:{initial,settings:s},
    status:'no-admissible-command',selected:null,candidates:[],
    interpretation:'The declared amplitude, slew and impulse constraints reject every designed waveform. No acquisition was scheduled.'};
  candidates.sort((a,b)=>
    Number(b.firstWitness!==null)-Number(a.firstWitness!==null) ||
    (a.firstWitness??Infinity)-(b.firstWitness??Infinity) ||
    (b.maxCertifiedMargin??-Infinity)-(a.maxCertifiedMargin??-Infinity) ||
    a.impulseNms-b.impulseNms || a.id.localeCompare(b.id));
  const selected=candidates[0];
  return {schema:PROSPECTIVE_PORT_SCHEMA,source:{initial,settings:s},
    status:selected.firstWitness===null?'not-separable-under-declared-constraints':'prospective-witness',
    selected:{id:selected.id,observationIndex:selected.firstWitness,
      observationTime:selected.firstWitness===null?null:selected.readings[selected.firstWitness-1].time,
      impulseNms:selected.impulseNms,peakSlewNmPerSecond:selected.peakSlewNmPerSecond,
      drive:selected.drive,
      predicted:selected.firstWitness===null?null:selected.readings[selected.firstWitness-1]},
    candidateCount:candidates.length,
    candidates:candidates.map(({id,impulseNms,peakSlewNmPerSecond,numericalStatus,firstWitness,maxCertifiedMargin})=>
      ({id,impulseNms,peakSlewNmPerSecond,numericalStatus,firstWitness,maxCertifiedMargin})),
    interpretation:'Locked simulation-only command and one future encoder readout. This is conditional on two DFKI mechanical hypotheses, the declared reading error and finite admissible waveforms. No actuator is connected, no safety certification exists, and solver step agreement is not a physical error bound.'};
}

export function receiveProspectivePortObservation(proposal, deliveredDrive, measured) {
  if(proposal?.schema!==PROSPECTIVE_PORT_SCHEMA)fail('Supply an original prospective port proposal.');
  const fresh=planProspectivePortIntervention(proposal.source);
  if(!identical(proposal,fresh))fail('The prospective plan changed; recompute from original constraints.');
  if(fresh.status!=='prospective-witness')fail('No numerically screened distinguishable observation was scheduled.');
  const chosen=fresh.selected;
  if(!Array.isArray(deliveredDrive)||deliveredDrive.length!==chosen.drive.length ||
     !deliveredDrive.every((v,i)=>Object.keys(v??{}).sort().join(',')==='time,torque' &&
       number(v.time,0,1)&&number(v.torque,-3,3) &&
       approx(v.time,chosen.drive[i].time)&&approx(v.torque,chosen.drive[i].torque))) {
    fail('Delivered command trace differs from the locked intervention; do not classify this observation.');
  }
  if(!measured || Object.keys(measured).sort().join(',')!=='position,time' ||
     !number(measured.time,0,1) || !approx(measured.time,chosen.observationTime) ||
     !Array.isArray(measured.position)||measured.position.length!==2 ||
     !measured.position.every(x=>number(x,-1e4,1e4))) fail('Supply exactly one finite two-angle readout at the precommitted clock.');
  const model=comparePortObservation(chosen.predicted,measured.position);
  const radius=fresh.source.settings.contrastRadiusRad+chosen.predicted.numerical;
  const shoulderFits=model.shoulderError<=radius;
  const elbowFits=model.elbowError<=radius;
  const status=shoulderFits&&!elbowFits?'shoulder':
    elbowFits&&!shoulderFits?'elbow':
    shoulderFits&&elbowFits?'ambiguous':'model-inadequate';
  return {schema:'worldlaw.prospective-port-receipt/v1',status,
    observationIndex:chosen.observationIndex,observationTime:chosen.observationTime,
    observed:[...measured.position],
    shoulderResidualRad:model.shoulderError,elbowResidualRad:model.elbowError,
    declaredAcceptanceRadiusRad:radius,
    interpretation:status==='model-inadequate'?
      'Neither offered mechanical port explains the readout within the declared radius. Do not force a port identity.':
      'Conditional port discrimination only; sensor calibration, torque delivery, physical fidelity and independent experimental provenance are not verified.'};
}
