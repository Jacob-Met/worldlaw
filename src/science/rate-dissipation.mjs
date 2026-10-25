import {predict} from './torque-discovery.mjs';
import {rational as R,add,mul,div,neg,cmp,serial,enclosure} from '../unknown-lab/chronos-exact-halfplanes.mjs';
const ZERO=R(0),TWO=R(2);
const supported=new Set(['command','command_position','rate','coulomb','spring','gravity','quadratic','bias','cubic']);
const abs=x=>cmp(x,ZERO)<0?neg(x):x;
const describe=x=>({...serial(x),...enclosure(x)});

/** Exact sign investigation of the supplied binary64 rate coefficients.
 * Power = r(f + d r + q r²), r=|ω|. It is not a physical passivity test.
 */
export function investigateRateDissipation(model,maxSpeed) {
  predict(model,{position:0,rate:0,command:0});
  if(model.terms.some(t=>!supported.has(t.id)))throw Error('Unaccounted torque term.');
  if(typeof maxSpeed!=='number'||!Number.isFinite(maxSpeed)||maxSpeed<0||maxSpeed>1e6)
    throw Error('Declare a finite maximum speed from 0 to 1000000 rad/s.');
  const coefficients=Object.fromEntries(model.terms.map(t=>[t.id,t.coefficient]));
  const c=R(coefficients.coulomb??0),b=R(coefficients.rate??0),a=R(coefficients.quadratic??0),V=R(maxSpeed);
  const factor=r=>add(c,add(mul(b,r),mul(a,mul(r,r))));
  const locations=[{role:'zero_speed_limit',speed:ZERO},{role:'maximum_speed',speed:V}];
  if(cmp(a,ZERO)<0){
    const vertex=div(neg(b),mul(TWO,a));
    if(cmp(vertex,ZERO)>0&&cmp(vertex,V)<0)locations.push({role:'interior_maximum',speed:vertex});
  }
  const evaluations=locations.map(x=>({...x,value:factor(x.speed)}));
  const peak=evaluations.reduce((best,x)=>cmp(x.value,best.value)>0?x:best);
  let witness=null;
  if(cmp(V,ZERO)>0&&cmp(peak.value,ZERO)>0){
    let speed=peak.speed;
    if(cmp(speed,ZERO)===0){
      // For r≤V, |d r + q r²| ≤ r(|d|+|q|V).
      // This positive r keeps the factor ≥ f/2, even when the maximum is at0.
      const slopeBound=add(abs(b),mul(abs(a),V));
      speed=cmp(slopeBound,ZERO)===0?V:div(c,mul(TWO,slopeBound));
      if(cmp(speed,V)>0)speed=V;
    }
    const value=factor(speed),power=mul(speed,value);
    if(cmp(speed,ZERO)<=0||cmp(speed,V)>0||cmp(power,ZERO)<=0)throw Error('No valid active-speed witness.');
    witness={speed:describe(speed),power:describe(power)};
  }
  return {schema:'worldlaw.rate-dissipation/v1',units:{speed:'rad/s',power:'W',factor:'N·m'},maximumSpeed:maxSpeed,
    status:witness?'positive_rate_power_exists':'rate_power_nonpositive_on_declared_interval',
    coefficients:{coulomb:coefficients.coulomb??0,rate:coefficients.rate??0,quadratic:coefficients.quadratic??0},
    maximumCandidates:evaluations.map(x=>({role:x.role,speed:describe(x.speed),factor:describe(x.value)})),witness,
    interpretation:'Exact real-arithmetic sign of the polynomial defined by the supplied binary64 coefficients over the declared speed interval; not a certificate for rounded solver arithmetic. Coefficient uncertainty, physical validity, conservative storage, command supply and unmodeled physics are not certified. Rational witnesses may lie between representable binary64 speeds.'};
}
