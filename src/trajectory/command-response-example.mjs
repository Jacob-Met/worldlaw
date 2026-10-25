/** Independent closed-form first-order input response and mechanical oscillator.
 * No fitted RK4, command timeline or regression is used to author these observations.
 */
import {RUN_UNITS} from './data.mjs';

export function commandResponseExample() {
  const inertia=.84,damping=.55,spring=3.2,gain=1.6,bias=.12;
  const delay=.04,tau=.18,before=.2;
  const alpha=damping/(2*inertia),omega=Math.sqrt(spring/inertia-alpha*alpha),r=1/tau;
  function evolve(position,rate,applied,target,dt){
    const A=applied-target,P=gain*A/(inertia*r*r-damping*r+spring);
    const equilibrium=(gain*target+bias)/spring;
    const B=position-equilibrium-P,C=(rate+r*P+alpha*B)/omega;
    const er=Math.exp(-r*dt),ea=Math.exp(-alpha*dt),cs=Math.cos(omega*dt),sn=Math.sin(omega*dt);
    return [equilibrium+P*er+ea*(B*cs+C*sn),-r*P*er+ea*((-alpha*B+omega*C)*cs+(-alpha*C-omega*B)*sn),target+A*er];
  }
  function run(id,initial,pulses,cadence){
    const times=Array.from({length:241},(_,i)=>i*cadence);
    const events=pulses.map(([index,value])=>({at:times[index],value}));
    const shifted=events.map(e=>({at:e.at+delay,value:e.value}));
    let [position,rate]=initial,applied=before,target=before,clock=0,next=0;
    const samples=times.map(time=>{
      while(next<shifted.length&&shifted[next].at<=time){
        [position,rate,applied]=evolve(position,rate,applied,target,shifted[next].at-clock);
        clock=shifted[next].at;target=shifted[next++].value;
      }
      [position,rate,applied]=evolve(position,rate,applied,target,time-clock);clock=time;
      let command=before;for(const event of events){if(event.at>time)break;command=event.value;}
      return {time,position,command};
    });
    return {id,label:`Analytic gradual-response oscillator ${id}`,kind:'synthetic',units:{...RUN_UNITS},inertia,initialRate:initial[1],
      source:{label:'Authored closed-form first-order command response and oscillator; no physical recording',recordingId:`analytic-response-${id}`,
        method:'closed_form_exponential_forcing_and_damped_oscillator',trueDelaySeconds:delay,trueResponseTimeSeconds:tau},samples};
  }
  return {bundle:{schema:'worldlaw.trajectory-bundle/v1',label:'Authored oscillator: delay and gradual command arrival',units:{...RUN_UNITS},
    trainingRuns:[run('training',[.4,-.2],[[0,.8],[23,-.6],[61,.3],[90,1],[136,-.8],[189,.4]],.02)],
    challengeRuns:[run('separate',[-.3,.45],[[0,-.4],[17,.9],[67,-.7],[122,.5],[161,-.2],[209,.7]],.023)]},
    options:{delays:[0,.04,.08,.12,.2],responseTimes:[0,.09,.18,.27],beforeStart:before,terms:['command','rate','spring','bias'],noiseSigma:1e-5,maxStep:.01}};
}
