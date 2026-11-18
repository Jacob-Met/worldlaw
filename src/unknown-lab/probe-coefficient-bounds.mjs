import {add, clip, cmp, enclosure, neg, rational, serial, sub} from './chronos-exact-halfplanes.mjs';

const lower = rational(-100), upper = rational(100), zero = rational(0);

/** Conditional on the two stated features, the declared coefficient box and error bounds. */
export function coefficientBounds(readouts) {
  if (!Array.isArray(readouts) || readouts.length < 1 || readouts.length > 24) throw Error('Supply between one and 24 observation screens.');
  const work = {count:0, limit:200000};
  let polygon = [[lower, lower], [upper, lower], [upper, upper], [lower, upper]];
  for (const {rate, position, contrast, radius} of readouts) {
    if (![rate, position, contrast, radius].every(Number.isFinite) || radius < 0)
      throw Error('Each readout requires finite coordinates, contrast and nonnegative radius.');
    const a = rational(rate), b = rational(Math.sin(position));
    const y = rational(contrast), e = rational(radius);
    polygon = clip(polygon, a, b, add(y,e), work);
    polygon = clip(polygon, neg(a), neg(b), sub(e,y), work);
  }
  if (!polygon.length) return {status:'inconsistent'};
  const projections = [0,1].map(axis => {
    const values = polygon.map(vertex => vertex[axis]);
    const lo = values.reduce((a,b) => cmp(a,b) <= 0 ? a : b);
    const hi = values.reduce((a,b) => cmp(a,b) >= 0 ? a : b);
    return {lower:serial(lo),upper:serial(hi),outward:[enclosure(lo).lower,enclosure(hi).upper],
      zeroPossible:cmp(lo,zero)<=0 && cmp(hi,zero)>=0};
  });
  return {status:'feasible',rate:projections[0],restoring:projections[1],
    vertices:polygon.map(vertex=>vertex.map(serial))};
}
