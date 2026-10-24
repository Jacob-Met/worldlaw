// Shared arithmetic for declared stationary AR(1) sensor covariance.
export function serialCovariance(weights,rho,sigma) {
  let variance=0, independentVariance=0;
  for(const a of weights) {
    independentVariance+=a.weight*a.weight;
    for(const b of weights) variance+=a.weight*b.weight*rho**Math.abs(a.sampleIndex-b.sampleIndex);
  }
  variance=Math.max(0,variance)*sigma**2;
  independentVariance*=sigma**2;
  return {variance,independentVariance};
}
