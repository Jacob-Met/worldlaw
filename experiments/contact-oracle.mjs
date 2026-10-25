import {RUN_UNITS} from '../src/trajectory/data.mjs';
export function harmonicPosition(time,start,{stiffness=4,friction=.6}={}) {
  const frequency=Math.sqrt(stiffness),halfPeriod=Math.PI/frequency;
  let position=start;
  for(let halfCycle=0;halfCycle<100;halfCycle++) {
    if(Math.abs(stiffness*position)<=friction)return position;
    const center=Math.sign(position)*friction/stiffness;
    if(time<=halfPeriod)return center+(position-center)*Math.cos(frequency*time);
    position=2*center-position;time-=halfPeriod;
  }
  throw new Error('Independent oracle half-cycle limit');
}
export function harmonicRun(id,start,duration=10,parameters) {
  return {id,label:id,units:RUN_UNITS,kind:'synthetic',source:{label:'Independently evaluated exact Coulomb harmonic half-cycles'},inertia:1,initialRate:0,
    samples:Array.from({length:Math.round(duration/.01)+1},(_,i)=>({time:i*.01,position:harmonicPosition(i*.01,start,parameters),command:0}))};
}
