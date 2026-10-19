/** Reproducible, explicitly synthetic observations. Independent fine-step oracle. */
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const units={time:'s',position:'rad',command:'N·m',inertia:'kg·m²',initialRate:'rad/s'};
function random(seed){let state=seed>>>0;return ()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return (state+.5)/4294967296;};}
function gaussian(rng){return Math.sqrt(-2*Math.log(rng()))*Math.cos(2*Math.PI*rng());}
function run({id,initialPosition,initialRate,seed,driven=true,noise=.0006,duration=6.4}){
  const inertia=.8,randomNoise=random(seed),randomCommand=random(seed+723);
  const commands=Array.from({length:Math.ceil(duration/.4)+1},()=>driven?(randomCommand()-.5)*1.2:0);
  const dt=.04, count=Math.round(duration/dt),samples=[];
  let theta=initialPosition,omega=initialRate;
  // This reference explicitly evaluates its own physical equation. It imports
  // neither discovery feature evaluation nor the receiving forward solver.
  const derivative=(position,rate,u)=>[rate,(1.6*u-.24*rate-2.2*Math.sin(position)+(driven?.08:0))/inertia];
  for(let i=0;i<=count;i++){
    const time=Number((i*dt).toFixed(10)),command=commands[Math.floor((i+1e-7)/10)];
    const sensorError=i===0?0:noise*gaussian(randomNoise);
    samples.push({time,position:theta+sensorError,command});
    if(i===count)break;
    const n=80,h=dt/n;
    for(let step=0;step<n;step++){
      const a=derivative(theta,omega,command),b=derivative(theta+h*a[0]/2,omega+h*a[1]/2,command),
        c=derivative(theta+h*b[0]/2,omega+h*b[1]/2,command),d=derivative(theta+h*c[0],omega+h*c[1],command);
      theta+=h*(a[0]+2*b[0]+2*c[0]+d[0])/6;omega+=h*(a[1]+2*b[1]+2*c[1]+d[1])/6;
    }
  }
  return {id,label:id.replaceAll('-',' '),kind:'synthetic',inertia,initialRate,units:{...units},samples,
    source:{label:'Controlled nonlinear pendulum simulation',recordingId:id,
      generator:'scripts/generate-trajectory-fixtures-92be.mjs',seed,positionNoiseSigma:noise,
      acquisition:'Independent fine-step RK4 reference, dt=0.0005 s; observations every 0.04 s; commands held between observations.',
      initialState:'Initial angle and rate supplied directly by the controlled simulation; t=0 position noise is zero.',
      oracle:{inertia,command:1.6,rate:-.24,gravity:-2.2,bias:driven?.08:0},
      rights:'Generated for this repository; no external media or personal information.'}};
}
const rich={schema:'worldlaw.trajectory-bundle/v1',label:'Driven pendulum · independent challenge runs',units,
  trainingRuns:[run({id:'fit-push-positive',initialPosition:.55,initialRate:.2,seed:41}),run({id:'fit-push-negative',initialPosition:-1.05,initialRate:-.35,seed:89})],
  challengeRuns:[run({id:'challenge-wide-release',initialPosition:1.8,initialRate:.1,seed:137}),run({id:'challenge-reverse-velocity',initialPosition:-.95,initialRate:.8,seed:193})]};
const ambiguous={schema:'worldlaw.trajectory-bundle/v1',label:'Small-angle ambiguity · wide-angle challenge',units,
  trainingRuns:[run({id:'fit-small-positive',initialPosition:.06,initialRate:0,seed:293,driven:false,noise:.00002}),run({id:'fit-small-negative',initialPosition:-.045,initialRate:.025,seed:307,driven:false,noise:.00002})],
  challengeRuns:[run({id:'challenge-unseen-wide-angle',initialPosition:1.9,initialRate:0,seed:337,driven:false,noise:.00002})]};
for(const [name,bundle]of [['trajectory-pendulum-92be.json',rich],['trajectory-ambiguous-92be.json',ambiguous]]){
  const path=fileURLToPath(new URL('../examples/'+name,import.meta.url));
  await writeFile(path,JSON.stringify(bundle,null,2)+'\n');
  console.log(`${name}: ${bundle.trainingRuns.length} fit runs, ${bundle.challengeRuns.length} challenge runs; synthetic evidence.`);
}
