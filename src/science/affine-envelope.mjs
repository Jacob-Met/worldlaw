// Coordinate-envelope admission only. No integrator, fit or tolerance changes.
const abs=p=>Math.abs(p[0])+Math.abs(p[1]);
const EPS=Number.EPSILON;
const pad=x=>x*(1+1e-10)+1e-12;
export function affineEnvelopes(pairs,inertia,force,initialRate,duration,dt){
 const k=pairs.get('spring'),d=pairs.get('rate'),stiffness=abs(k)/inertia,drag=abs(d)/inertia,F=abs(force)/inertia,T=duration+dt;
 const original=pad((Math.abs(initialRate)+F*T)*Math.exp(Math.max(stiffness,1+drag)*T));
 const bounds=[{method:'absolute_coordinate_norm',rate:original,displacement:original}];
 const weight=stiffness>0?Math.max(1e-12,Math.min(1e12,2*stiffness/(Math.hypot(drag,2*Math.sqrt(stiffness))+drag))):1;
 const L=Math.max(stiffness/weight,weight+drag),weighted=pad((Math.abs(initialRate)+F*T)*Math.exp(L*T));
 bounds.push({method:'weighted_absolute_norm',rate:weighted,displacement:weighted/weight,coordinateWeight:weight});
 // Guard coefficient signs using conservative floating-point sum margins;
 // mixed-sign low components remain admitted only with a resolved sign.
 const kSum=k[0]+k[1],dSum=d[0]+d[1],kMargin=8*EPS*abs(k),dMargin=8*EPS*abs(d);
 if(kSum+kMargin<0&&dSum+dMargin<=0){
  const omega=Math.sqrt(stiffness),matrixBound=omega+drag,x=matrixBound*dt;
  const stiffnessLower=Math.max(0,-kSum-kMargin)/inertia;
  const coordinateMismatch=Math.max(0,stiffness-stiffnessLower)/(2*omega);
  // In energy coordinates (omega*delta,v), the continuous homogeneous
  // operator is dissipative. P4 differs from exp(Bh) by at most
  // exp(Lh)*(Lh)^5/120. Thus each accepted step norm <=exp(growth*h).
  // Rounding allowance is disclosed, not directed interval arithmetic.
  const growth=Math.exp(x)*matrixBound**5*dt**4/120+coordinateMismatch+64*EPS*matrixBound;
  // Internal RK4 stages <=exp(2*L*dt); constant forcing uses its positive
  // stage polynomial <=exp(L*dt), accumulated over the complete duration.
  const energy=pad((Math.abs(initialRate)+F*T*Math.exp(x))*Math.exp(growth*duration+2*x));
  bounds.push({method:'dissipative_energy_with_RK4_remainder',rate:energy,displacement:energy/omega,coordinateWeight:omega,matrixBound,growthPerSecond:growth,maximumStageArgument:x});
  // Pure restoring oscillator only: for the ideal skew energy matrix,
  // |P4(i*x)|^2 = 1-x^6/72+x^8/576 <=1 for |x|<=sqrt(8).
  // Use the stricter x<=2 gate. Bound coefficient-coordinate perturbation
  // of P4 by h*E*exp(L*h), retaining the separate internal-stage bound.
  if(d.every(v=>v===0)&&x<=2){
   const mismatch=(Math.max(0,stiffness-stiffnessLower)/omega+128*EPS*omega)*Math.exp(x);
   const oscillatory=pad((Math.abs(initialRate)+F*T*Math.exp(x))*Math.exp(mismatch*duration+2*x));
   bounds.push({method:'pure_oscillator_RK4_stability_polynomial',rate:oscillatory,displacement:oscillatory/omega,coordinateWeight:omega,maximumStageArgument:x,maximumPermittedStageArgument:2,growthPerSecond:mismatch});
  }

 }
 return bounds;
}
export function selectAffineEnvelope(bounds,anchor){return bounds.find(b=>Number.isFinite(b.rate)&&Number.isFinite(b.displacement)&&b.rate<1e6&&b.displacement<Math.min(1e6,1e6-Math.abs(anchor)));}
