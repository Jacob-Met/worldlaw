# Additional interval readings in Trajectory Challenge

This optional receiving comparison leaves the selected law, original point observations, initial state and completed forecast unchanged. It compares separate supplied readings with point predictions and with an explicitly declared uniform scalar-angle average of those same predictions.

An averaged reading is not a point initial state. Use this comparison only when the original forecast has a separately supplied point origin and rate, and retain its actual provenance. The source must match the existing forecast origin exactly; the tool neither changes that origin nor estimates it from the additional readings. Declaration text cannot authenticate acquisition or independence.

## Supply a source

With a successful original forecast selected, download its matching source template. Keep the generated binding unchanged. It binds the selected model and complete original point run, including source metadata. Supply `initialPoint` and `readings` from your actual source. The following is a format illustration, not measured evidence:

```json
{
  "initialPoint": {
    "kind": "independent-point-state",
    "time": 0,
    "position": 1,
    "rate": 0,
    "source": "Identify the separately supplied point-state source and its meaning",
    "pointObservationId": "original-point-origin"
  },
  "readings": [{
    "id": "additional-reading-1",
    "source": "Identify this additional reading and its measurement operation",
    "start": 0.25,
    "end": 0.5,
    "reportedTime": 0.5,
    "timestampConvention": "end",
    "weighting": "uniform",
    "observed": 0.2
  }]
}
```

Keep `format` and `binding` from the generated template; the illustration above shows only the fields you must supply. Times are seconds, angle is radians and initial rate is radians per second. Each reading needs a unique identity distinct from the point origin. Supported reporting conventions are `center` and `end`; the reported time must equal the declared midpoint or end exactly. Every interval start/end and reporting time must already exist in the completed prediction grid. Intervals must begin after the independent origin. Unsupported endpoints refuse; the application does not interpolate, solve additional times or infer windows from cadence.

At most 256 complete additional readings and 100,000 prediction segments across their intervals are admitted. Overlapping intervals reuse prediction nodes and are not independent evidence. Tables retain every raw value, using bounded pages without thinning.

## What the comparison means

Both additional-reading scores use the same supplied additional observations. The point-operation score compares the existing prediction at the reporting timestamp. The average-operation score applies composite trapezoids to existing prediction nodes over each explicitly declared interval. The original point-course score remains separate and unchanged. A smaller conditional score does not identify the true sensor, validate a law, or bound numerical integration error.

Scalar angle averaging is not generic camera averaging. Integrating projected light and then recovering an angle can give a different result, as the authored optical-centroid research demonstrates. No physical exposure metadata is inferred from frame spacing or recording cadence.

Source-only export stores binding, point-origin provenance and additional readings, never trusted derived results. Reopening recomputes against the matching current source/model. Changing the underlying source, selected run or model retires the additional comparison. No fitting, model ranking, #282 intake schema or shared solver behavior changes.

The averaging implementation is shared at `src/trajectory/interval-average.mjs`; the original research entrypoint is a thin compatibility re-export. Its original protocol, results and code-hash provenance remain unchanged, and the original controls/reproduction run through the shared implementation.
