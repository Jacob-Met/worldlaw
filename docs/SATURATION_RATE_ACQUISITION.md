# Prospective saturation rate requests and separate receiving

UNKNOWN LAB's continuous saturation investigation can now ask which supplied probe state separates **two declared velocity-scale windows**. It retains the original shared-amplitude training constraints and does not use challenge outcomes to rank future rates.

## What the comparison establishes

For each scale window, every intersecting retained training box stays associated with its own amplitude outer interval. A window must also contain a certified training-compatible witness. This avoids declaring separation from an empty or merely speculative competing family.

At an offered rate, each box receives a directed outer response interval using the maintained analytic tanh enclosure. Each band is then intersected with every original training response multiplied by a directed bound on tanh(offered rate / scale) / tanh(training rate / scale). This preserves the shared response amplitude. At an already observed rate, the ratio is exactly one, so the forecast respects the original training screen. The union may still over-enclose the feasible family's remaining amplitude–scale correlation. Its endpoints are not asserted attainable. Disjointness of these conservative sets is a sufficient discriminator; overlap is unresolved.

The reported margin is the smallest gap over **every** cross-window pair of prediction bands, minus twice the declared future response radius, clipped at zero. Positive margin certifies separation of these two offered windows under the declared screening assumptions. The selected state maximizes that certified margin among affordable supplied states, then breaks ties by cost and identifier. This is not a globally optimal rate, calibrated information gain, mechanical feasibility check or hardware instruction.

The untested ranges are explicit, with open/closed endpoints. For windows [0.05,0.2] and [0.5,1], the interval (0.2,0.5) remains untested. A later outcome may exclude both offered windows while leaving that interval entirely plausible.

The model depends on rate only. Angular, mixed, time-varying and instrument effects can remain omitted. Each offer nevertheless declares its angle and rate; command and fixed preparation/recovery come from the original study. Outside-training-range flags remain visible.

## Use in UNKNOWN LAB

1. Load the original probe study, or choose the explicitly authored high-rate ambiguity control.
2. Declare the continuous scale domain and work limits in the profile controls. Enter two separated scale windows, offered angle/rate states and costs, the future response radius, and effort budget.
3. Compare all offered states. Review both witnesses, every prediction union, the untested ranges and the complete offered table.
4. Declare a new run identifier, preparation/measurement arrangement and 8–128 matched pairs. At least four pairs in each acquisition order must actually be supplied.
5. Freeze the selected manual request. It records the complete command/angle/rate state, preparation/recovery, source kind and original study. It contains no invented future readings.
6. Receive an independently supplied observation file. Both windows are screened before any study change.
7. Optionally add the received challenge to the probe study through the explicit button. The original training roles remain unchanged.

The authored outcome controls operate only on synthetic requests. They are separate from planning and clearly retain synthetic provenance. No physical action is performed.

## Source-only request and receipt

An exported acquisition uses `worldlaw.saturation-rate-acquisition/v1` with:

- `request`: a `worldlaw.saturation-rate-request/v1` containing the original admitted study, comparison settings and frozen full protocol;
- `observation`: either null, or the frozen protocol plus one original challenge run.

Reopening recomputes from those inputs. Saved plans, forecasts and result labels are ignored. The frozen protocol must still agree with the recomputed selection; it cannot be silently changed into a different acquisition.

An observation file supplied separately has this structure:

```json
{
  "protocol": {"...": "Copy the complete frozen protocol exactly"},
  "run": {
    "id": "the-frozen-run-id",
    "role": "challenge",
    "preparation": {"...": "The frozen preparation"},
    "probe": {"command": 0, "position": 0.6, "rate": 0.3},
    "notebook": {"...": "Original worldlaw.history-challenge/v1 paired readings"}
  }
}
```

The example is a structure guide, not an admissible measurement or a fabricated reading. Use the exact protocol shown in the consumer and actual original notebook rows.

Receiving refuses a stale study, mismatched run identity, role, preparation, full state or paired count, mixed measured/synthetic evidence, and repeated recordings under the maintained probe admission rules. Source declarations are not authentication of physical independence.

If acquisition order is insufficient or the realized screening radius exceeds the frozen planning radius, the original observation is retained as **unqualified**, and neither window receives an exclusion claim.

For a qualified observation, its entire actual screening interval is compared with every frozen forecast band in each window. Only complete disjointness excludes that window. Outer overlap is not a parameter witness or proof of a physical law. Both windows are evaluated; neither outcome refits the training family.

## Bounds and receiving controls

The comparison uses at most eight distinct offered states. The existing continuous-profile box and feature-evaluation limits apply to training and forecasts together. Complete cross-band comparison work is reserved before forecasts and capped at 150,000 comparisons. If feature work exhausts during any offered course, all course outputs and selection are withheld; no completed prefix wins.

Worker cancellation retires pending and completed results when sources or relevant controls change. Reopening, observation replacement and exports use current source snapshots. The existing continuous profile and post-training joint consistency API remain intact.

Native controls exercise informative and saturated/zero future rates, actual full-state freezing, original-source replay, challenge noninterference, repeated-acquisition rejection, mismatches, stale sources, realized order/radius failure, work/cost/radius negatives and the intermediate-scale adverse outcome. The actual browser receiver covers desktop/narrow layout, keyboard focus, source-only export/reopen, stale worker retirement and explicit later adoption.

The implemented prospective research also received an independent exact interval-union oracle and a separate high-precision check of amplitude intersections and predicted intervals. These establish the conditional numerical mechanism, not new physical measurement accuracy.

## Training-conditioned forecast proof

For positive offered rate q and training rate r, the ratio tanh(q/s)/tanh(r/s) increases with s when q>r, decreases when q<r, and equals one when q=r. The derivative of its logarithm with respect to log(s) is h(r/s)−h(q/s), where h(x)=2x/sinh(2x) is decreasing for positive x. Directed tanh bounds at the appropriate endpoints therefore enclose the complete ratio on a retained scale interval. Multiplying all four endpoint products with the normalized original training interval and intersecting the original forecast cannot remove a feasible shared-amplitude response. Negative rates are normalized before this operation and restored afterward; zero queries return zero. A zero denominator lower bound skips that tightening.

Each returned forecast retains its original box index. A proven empty response intersection is separately listed; it is not a silently missing course. Every offered course shares the original feature-work budget. Exhaustion discards all offered results and the selection. Forecast endpoints remain outer bounds, not asserted attainable states.

This update does not revise the completed earlier acquisition receipts. Reopening source-only inputs recomputes under the current maintained producer and still refuses a frozen protocol that no longer matches the selected offer. Joint challenge screening and original training admission remain unchanged.
