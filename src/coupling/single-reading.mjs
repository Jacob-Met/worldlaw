/** Select one two-axis angle reading on the common, already screened clock. */
export function singleReadingForRelease(comparisons, tieTolerance) {
  if (!comparisons.length || comparisons.some(pair => !pair.screened)) return null;
  const clock = comparisons[0].curve;
  if (clock.length < 2 || comparisons.some(pair => pair.curve.length !== clock.length)) {
    throw new Error('Single-reading comparison requires the complete common output clock.');
  }
  const samples = clock.slice(1).map(({time}, offset) => {
    let separation = Infinity;
    for (const pair of comparisons) {
      const row = pair.curve[offset + 1];
      if (row.time !== time || !Number.isFinite(row.separation) || row.separation < 0) {
        throw new Error('Single-reading comparison received inconsistent sampled evidence.');
      }
      separation = Math.min(separation, row.separation);
    }
    return {sampleIndex: offset + 1, time, separation};
  });
  const best = samples.reduce((a, b) => b.separation > a.separation ? b : a);
  return {...best, tiedSampleCount: samples.filter(s => best.separation - s.separation <= tieTolerance).length};
}

export function rankSingleReadings(releases, settings) {
  const screened = releases.filter(r => r.singleReading);
  if (!screened.length) return {status:'unresolved', selected:null, tiedIndices:[]};
  const best = screened.reduce((a,b) => b.singleReading.separation > a.singleReading.separation ? b : a);
  const tiedIndices = screened.filter(r => best.singleReading.separation-r.singleReading.separation <= settings.tieTolerance).map(r=>r.index);
  if (best.singleReading.separation <= settings.minimumSeparation) return {status:'not_separated', selected:null, tiedIndices};
  return {status:'proposed', selected:{index:best.index,position:[...best.position],...best.singleReading}, tiedIndices};
}
