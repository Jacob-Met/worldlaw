/** Equal static/kinetic Coulomb inclusion; no claim of identified contact physics. */
export function advanceCoulombContact({position,rate,duration,friction,drive,advance,fail}) {
  let remaining=duration,events=0,held=0;
  for(let split=0;remaining>0;split++) {
    if(split>=8)fail('Too many velocity-zero events in one integration step.','contact_event_limit');
    const force=drive(position);
    if(rate===0&&Math.abs(force)<=friction) {held+=remaining;break;}
    const direction=rate===0?Math.sign(force):Math.sign(rate);
    const next=advance(position,rate,remaining,direction);
    if(next.rate*direction>0) {position=next.position;rate=next.rate;break;}
    // The smooth fixed-direction branch is continued only to its first located
    // zero. This bounded bisection is a numerical event approximation, not a
    // proof that a coarse step cannot conceal multiple zero crossings.
    let lo=0,hi=remaining;
    for(let j=0;j<48;j++) {
      const mid=lo+(hi-lo)/2;
      if(mid===lo||mid===hi)break;
      const trial=advance(position,rate,mid,direction);
      if(trial.rate*direction>0)lo=mid;else hi=mid;
    }
    if(!(hi>0)||remaining-hi===remaining)fail('Velocity-zero event time cannot advance representably.','numerical_failure');
    position=advance(position,rate,hi,direction).position;
    rate=0;events++;remaining-=hi;
  }
  return {position,rate,events,held};
}
