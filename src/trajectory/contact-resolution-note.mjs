/** Read-only presentation of actual paired contact-run event counts. */
export function contactEventResolutionNote(resolution) {
  const comparison=resolution?.status==='compared' ? resolution.contactEventComparison : null;
  if(!comparison)return 'Contact event-count refinement unavailable; do not infer event agreement.';
  const {coarseZeroRateEvents,refinedZeroRateEvents,countsDiffer}=comparison;
  return countsDiffer
    ? `Detected zero-rate events: ${coarseZeroRateEvents} at nominal vs ${refinedZeroRateEvents} at half steps (different; contact events are step-sensitive).`
    : `Detected zero-rate events: ${coarseZeroRateEvents} at nominal and ${refinedZeroRateEvents} at half steps (same count does not certify complete event detection).`;
}
