# Challenge gain versus clock-rate families in the affine-clock instrument

This implements the scoped #75 handoff in comment6392449938. The existing affine-clock instrument now accepts `worldlaw.gain-clock-input/v1` in its original-source editor/file intake, compares the complete offered profile/time course, and saves/reopens an input-only investigation. Existing affine/tick formats retain their dispatch and custody rules. No generic planner or dynamic whole-course fitting route is added.

Use **Gain or clock-rate experiment**, then **Compare complete family**. The authored control fixes the instantaneous law τ = command. It declares a sensor-gain family [1.24,1.26] at clock scale1 and a clock-rate family [.79,.81] at gain1. These are caller assumptions, not inferred parameter uncertainty. Zero origins/offset are part of this narrow input format: torque time = scale × state time. Other fixed-law terms refuse rather than silently disappear.

Seven analytic command profiles on five state-clock seconds and16torque-clock times make112offered pairs. Full mapped time support, amplitude and slew declarations admit90. Shared `screenIntervalPairs` and `selectSeparatingCandidate` choose sine with three half cycles at torque time0.5s. The gain forecast is approximately [1.003181073,1.019361413] N·m and the clock forecast [.918216107,.929483408] N·m. Their gap is .073697665N·m, leaving .033697665 after twice the declared .02reading radius. A ramp alone cannot separate these families.

The range calculation includes every continuous scale/gain combination and analytic interior sine extrema; it never samples a parameter subset to assert separation. Its admitted domain has1–4sine half cycles, .01–60second duration, scales .5–2 and gains .01–10. Floating-point ranges and observed-reading endpoints include128epsilon engineering slack. This is a disclosed numerical allowance, not a formal directed-rounding proof. At most16families and128profile/time pairs are evaluated, with no partial course on malformed input. No confidence probability, hardware execution, unique fault identification or coefficient uncertainty is claimed.

To receive a separately obtained result, add to the source JSON:

```json
"received": {
  "candidateId": "sine-3@0.5",
  "jointTorque": 1.0118,
  "source": "Describe the actual measurement and provenance here"
}
```

Then compare again. The candidate must be an admitted offered experiment. Selection never reads the received value. Families are excluded only when their frozen prediction interval and the received reading interval are disjoint. A retained family is merely not excluded. If both fail, the instrument preserves that failure and explains that a later coefficient refit is a new prediction, not validation of either prior explanation. Saving retains the fixed law and original declarations/reading; reopening recomputes results and ignores any injected derived result. Source/law changes retire the previous visible result. There is no trusted timestamp attesting that a user actually declared the law before acquisition; source custody is reproducibility, not an external preregistration service.

Receiving controls cover independent authored perturbations from both families, both-prior failure followed by a fitting new coefficient, dense gain/scale cross-checks including turning points, no separation, full-support and slew refusal, original-file import, actual save/reopen, keyboard activation and draft invalidation. Authored controls are not physical measurements.

The actual existing instrument is the consumer. It displays the competing torque intervals on a shared axis with readable labels and exact numeric endpoints. The initial SVG labels were too small on390pxscreens; the final version uses HTML labels and proportional bands. Desktop/narrow Chrome evidence and full native verification are recorded separately from these source claims.
