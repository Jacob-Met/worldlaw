import {inspectRelaxationReads, planRelaxationReads} from './relaxation-order.mjs';

const readingLimit = 1e6;
const arithmeticError = 8 * Number.EPSILON * readingLimit;

// Divide the second differences by four so that every contrast stays within
// the original instrument range. The three weights have absolute sum one.
export function inspectAffineReads(rows, error) {
  if (!Number.isFinite(error) || error < 0 || error > readingLimit) {
    throw new RangeError('Invalid per-reading absolute error');
  }
  if (!Array.isArray(rows) || rows.length > 5) throw new RangeError('Use at most five readings');
  const stride = rows.length > 1 ? rows[1]?.wait : 1;
  if (!Number.isSafeInteger(stride) || stride < 1) throw new RangeError('Invalid stride');
  for (const [index, row] of rows.entries()) {
    if (!Number.isSafeInteger(row?.wait) || row.wait !== index * stride ||
        !Number.isFinite(row.difference) || Math.abs(row.difference) > readingLimit) {
      throw new RangeError('Use bounded readings at five consecutive equal-stride waits starting at zero');
    }
  }
  if (rows.length < 5 || error + arithmeticError > readingLimit) return {status:'unresolved'};
  const contrasts = rows.slice(0, 3).map((row, i) => ({
    wait: row.wait,
    difference: (row.difference / 4 - rows[i+1].difference / 2) + rows[i+2].difference / 4,
  }));
  const inspected = inspectRelaxationReads(contrasts, error + arithmeticError);
  return {...inspected, status:inspected.status === 'positive-curvature' ? 'affine-invariant-curvature' : 'unresolved', contrasts};
}

export function planAffineReads(domain) {
  const {candidates: strides} = planRelaxationReads(domain);
  const [fastMin, fastMax] = domain.fast, [slowMin, slowMax] = domain.slow;
  const [minAmp, maxAmp] = domain.amplitude;
  const error = domain.error + arithmeticError;
  const candidates = strides.map(({stride}) => {
    const fast = fastMax ** stride, slow = slowMin ** stride, slowUpper = slowMax ** stride;
    // For retention r, differencing twice preserves r and scales the
    // amplitude by (1-r)^2 / 4. Use separate bounds for the two modes.
    const fastLower = minAmp * (1-fast)**2 / 4, slowLower = minAmp * (1-slowUpper)**2 / 4;
    const fastUpper = maxAmp * (1-fastMin**stride)**2 / 4;
    const slowAmplitudeUpper = maxAmp * (1-slow)**2 / 4;
    const determinant = fastLower * slowLower * Math.max(0, slow-fast)**2;
    const penalty = 2*error*(fastUpper*(1+fast)**2 + slowAmplitudeUpper*(1+slowUpper)**2) + 4*error**2;
    const tolerance = 256*Number.EPSILON*Math.max(1,(fastUpper+slowAmplitudeUpper+2*error)**2);
    return {stride,margin:determinant-penalty-tolerance};
  });
  const best = candidates.reduce((a,b) => b.margin > a.margin ? b : a);
  if (best.margin <= 0) return {status:'unresolved',candidates};
  return {status:'separating-plan',waits:[0,1,2,3,4].map(i=>i*best.stride),candidates};
}
