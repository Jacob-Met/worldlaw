// DFKI RealAIGym's published, common two-link parameters (radians, seconds, N m).
// The coordinate frame is q1 from downward vertical, q2 relative to link one.
const mass1 = .5234602302310271, mass2 = .6255677234174437;
const length1 = .2, center1 = .2, center2 = .25569305436052964;
const inertia1 = .031887199591513114, inertia2 = .05086984812807257;
const rotor = 6.287203962819607e-5, gear = 6, gravity = 9.81;
const crossMass = mass2 * length1 * center2;
export const criteria = Object.freeze({ triggerNm: .25, separationRad: .12, horizonSeconds: .35 });

function rate(state, torque, port) {
  const [q1, q2, v1, v2] = state;
  const cross = crossMass * Math.cos(q2);
  const m11 = inertia1 + inertia2 + mass2 * length1**2 + 2*cross + (gear**2+1)*rotor;
  const m12 = inertia2 + cross - gear*rotor;
  const m22 = inertia2 + gear**2*rotor;
  const combinedGravity = gravity * mass2 * center2 * Math.sin(q1+q2);
  const centrifugal = crossMass * Math.sin(q2);
  const first = (port===0 ? torque : 0) + centrifugal*(2*v1*v2 + v2*v2)
    - gravity*(mass1*center1+mass2*length1)*Math.sin(q1) - combinedGravity
    - .001*v1 - .16*Math.atan(100*v1);
  const second = (port===1 ? torque : 0) - centrifugal*v1*v1 - combinedGravity
    - .001*v2 - .12*Math.atan(100*v2);
  const det = m11*m22 - m12*m12;
  return [v1, v2, (m22*first-m12*second)/det, (m11*second-m12*first)/det];
}

function integrate(state, torque, interval, port) {
  const steps = Math.ceil(interval / .005);
  const dt = interval/steps;
  const add = (x, dx, h) => x.map((value, i) => value + h*dx[i]);
  for (let i = 0; i < steps; i++) {
    const a=rate(state,torque,port);
    const b=rate(add(state,a,dt/2),torque,port);
    const c=rate(add(state,b,dt/2),torque,port);
    const d=rate(add(state,c,dt),torque,port);
    state=state.map((x,j)=>x+dt*(a[j]+2*b[j]+2*c[j]+d[j])/6);
  }
  return state;
}

function angularDistance(a, b) {
  return Math.hypot(...[0,1].map(i=>Math.atan2(Math.sin(a[i]-b[i]),Math.cos(a[i]-b[i]))));
}

export function readRealAIGymCsv(text) {
  if (typeof text!=='string' || text.length > 12*1024*1024) throw new Error('Supply a numeric RealAIGym CSV under 12 MiB.');
  const lines=text.trim().replace(/^\uFEFF/,'').split(/\r?\n/);
  const header=lines.shift().split(',').map(x=>x.trim());
  const names=['time','pos_meas1','pos_meas2','vel_meas1','vel_meas2','tau_con1','tau_con2'];
  const columns=names.map(name=>{
    const first=header.indexOf(name);
    if (first<0 || header.lastIndexOf(name)!==first) throw new Error('Missing or repeated column '+name+'.');
    return first;
  });
  const drive=[], states=[];
  for (const line of lines) {
    const fields=line.split(',');
    const v=columns.map(i=>fields[i]?.trim() ? Number(fields[i]) : NaN);
    if (v.some(x=>!Number.isFinite(x))) throw new Error('Missing or non-finite required measurement.');
    if (drive.length && v[0]<=drive.at(-1).time) throw new Error('Acquisition times must increase.');
    drive.push({time:v[0],torque:v[5]+v[6]});
    states.push(v.slice(1,5));
  }
  if (drive.length<2) throw new Error('At least two acquisition samples are required.');
  return {drive,states};
}

// Only one encoder state is visible to the planner. Future encoder observations
// are absent from this interface, as are the commanded joint IDs and filenames.
export function schedulePortObservations(drive, start, initial, randomFraction=.5) {
  if (!Number.isInteger(start) || start<0 || start>=drive.length) throw new Error('Invalid acquisition anchor.');
  if (!Array.isArray(initial) || initial.length!==4 || !initial.every(Number.isFinite)) throw new Error('Invalid initial state.');
  if (!(randomFraction>=0 && randomFraction<1)) throw new Error('Invalid random-clock fraction.');
  const anchor=drive[start].time, predictions=[];
  let a=initial.slice(), b=initial.slice();
  for (let i=start+1;i<drive.length && drive[i].time-anchor<=criteria.horizonSeconds+1e-12;i++){
    const dt=drive[i].time-drive[i-1].time;
    if (!(dt>0) || !Number.isFinite(drive[i-1].torque)) throw new Error('Invalid acquisition drive.');
    a=integrate(a,drive[i-1].torque,dt,0);
    b=integrate(b,drive[i-1].torque,dt,1);
    if (![...a,...b].every(Number.isFinite)) throw new Error('Mechanical prediction diverged.');
    predictions.push({index:i,elapsed:drive[i].time-anchor,shoulder:a.slice(0,2),elbow:b.slice(0,2),separation:angularDistance(a,b)});
  }
  if (!predictions.length) throw new Error('No subsequent sample in the measurement horizon.');
  const last=predictions.at(-1);
  const at=seconds=>predictions.find(p=>p.elapsed>=seconds)??last;
  return {anchor, predictions, clocks:{first:predictions[0],fixed100:at(.1),fixed350:last,
    uniform:at(randomFraction*criteria.horizonSeconds),active:predictions.find(p=>p.separation>=criteria.separationRad)??last}};
}

export function comparePortObservation(prediction, measured) {
  if (!Array.isArray(measured) || measured.length<2 || !measured.slice(0,2).every(Number.isFinite)) throw new Error('Missing measured joint angles.');
  const shoulderError=angularDistance(prediction.shoulder,measured);
  const elbowError=angularDistance(prediction.elbow,measured);
  const gap=elbowError-shoulderError;
  return {...prediction, observed:measured.slice(0,2),shoulderError,elbowError,
    winner:Math.abs(gap)<1e-9?'unresolved':gap>0?'shoulder':'elbow'};
}

export function replayActuatorPort(recording,randomFraction=.5) {
  const start=recording.drive.findIndex(p=>Math.abs(p.torque)>=criteria.triggerNm);
  if (start<0) throw new Error('No anonymous command reaches 0.25 N m.');
  const plan=schedulePortObservations(recording.drive,start,recording.states[start],randomFraction);
  const results=Object.fromEntries(Object.entries(plan.clocks).map(([name,p])=>[name,comparePortObservation(p,recording.states[p.index])]));
  return {anchor:plan.anchor,initial:recording.states[start].slice(),thresholdReached:plan.clocks.active.separation>=criteria.separationRad,
    predictions:plan.predictions,results};
}
