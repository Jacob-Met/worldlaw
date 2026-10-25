# Original integer sensor timestamps in the affine-clock instrument

Epoch-scale sensor timestamps must remain strings until their declared origin is subtracted. For example, contemporary nanosecond timestamps separated by 100 ns can collapse to the same JavaScript Number. Subtracting two already-rounded epoch values cannot recover the original samples.

The integer-clock intake retains original timestamp strings, subtracts their separately declared device-clock origins with BigInt, and then converts exact relative seconds through the maintained rational/enclosure primitives. It feeds the existing affine-clock model comparison; it does not fit a new law or infer clock alignment.

## Original input contract

Use `worldlaw.clock-tick-input/v1`. Keep the affine instrument's source label, coordinate/torque units, hypotheses, gap declaration, training tolerance and original row roles. Set `units.time` to `ticks`. Replace each row's numeric `time` with a **quoted canonical integer** `timestampTicks` and provide:

```json
{
  "clocks": {
    "state": {"origin": "1792886400000000000", "ticksPerSecond": "1000000000"},
    "torque": {"origin": "82710000000", "ticksPerSecond": "1000"}
  },
  "maximumRoundingErrorSeconds": 1e-12
}
```

The two origins and rates are independent declarations. Do not also include `stateOrigin`, `torqueOrigin`, or a second numeric row `time`. Affine hypotheses now map seconds relative to these declared original clock origins:

`relativeTorqueSeconds = scale × relativeStateSeconds + offset`.

Offsets, the interpolation-gap limit and conversion-error cap use seconds, even though the original timestamp fields use ticks. Tick rate is a positive integer from 1 through 10¹² per second. Timestamp and origin strings admit at most 30 digits; relative times must stay within ±10⁶ seconds. State and torque row limits remain 2,048 and 4,096.

## Conversion custody

Every row retains its original timestamp, exact relative tick count, adjacent enclosing binary64 seconds, chosen representative seconds and exact rational absolute rounding error. The largest rounding error is also summarized. Every error must fit the caller's explicit cap. Original ticks and emitted times must both strictly increase. A distant origin and picosecond sampling can still collapse after conversion; the intake refuses instead of inventing a timestamp or silently sorting records. Choose a closer declared origin or a shorter course and explicitly rerun.

The conversion receipt bounds **numerical representation error only**. It does not establish sensor accuracy, clock-rate calibration, synchronization, independent acquisition or physical timing uncertainty. The existing affine receiver evaluates the representative seconds; these enclosures do not become physical uncertainty bounds in its interpolation or model comparison.

## Replay and compatibility

Original tick investigations use `worldlaw.clock-tick-investigation/v1` and retain the original model and input. Reopening recomputes conversion and comparison. They never silently export as ordinary seconds notebooks. The same-instrument dispatcher continues accepting the established affine-seconds format unchanged; relabeling a tick notebook as the older format refuses.

An authored two-recorder example uses a nanosecond epoch clock and a separate millisecond clock. It retains the correct offered scale/offset hypothesis after actual affine evaluation and source-only export/reopen, with maximum numerical conversion error approximately 1.77×10⁻¹⁵ seconds. This is numerical software qualification, not a physical sensor acquisition.

Eight direct native groups cover real epoch-magnitude collapse, exact receipt checks, independently changed clock rates/origins, chronology and ambiguous-declaration refusal, insufficient representability, original-only replay and unchanged legacy dispatch. The existing affine panel now imports both schemas, offers an authored recorder-tick example, and renders a read-only original-clock witness inside the same instrument. The current predecessor is merge `2bcb560533e38e93f655fa24e64029ca142495da`. Actual browser intake, witness inspection, source-preserving download/reopen and narrow-layout receiving remain a separate qualification step.

## Representative recorded timestamp export

`evidence/clock-tick-host-export.json` retains 128 actual local Python `time.time_ns()` readings, produced during this work, SHA-256 `7bca0844309918c3e09ea2c0a184a0b7627f1a3fb344db78517b058b2385de72`. All 128 original strings are distinct. Premature Number conversion preserves only 69 distinct values; this intake preserves all 128 normalized times. The largest exact conversion-error upper bound is about 3.13×10⁻²¹ seconds. `tests/clock-ticks-host.test.mjs` independently repeats that source receipt.

This is a genuine host-clock export, not a physical angle/torque recording. It contains no measured physical state. Its separate attempt to enter the physical-law receiver correctly refuses missing position values. The authored state/torque example and this clock-only receiving result are distinct qualifications.
