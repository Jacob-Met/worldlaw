# Return energy under declared reading assumptions

After inspecting an equal-reported-coordinate return in Trajectory Challenge, enter two explicit declarations in **Does this loss remain negative under your reading assumptions?**:

- A hypothetical radius for each original angle reading, in radians.
- A separate bound on the difference between physical angular rate and the exact local cubic-polynomial derivative, in rad/s.

Both fields start blank. CSV decimal resolution does not establish either bound. **Check declared return bounds** computes the complete original population in an owned worker. **Cancel exact calculation**, source replacement, declaration edits and pending imported-source replacement terminate the calculation and retire results. No partial population becomes a finding.

The selected original recording, cycle and matching level remain the source of the observed trace and violet return markers. The new result describes that same interval; it does not generate motion or change any coefficient, rate window or original loss comparison. Export saves original return inputs and declarations only. Reopening recomputes through a worker; claimed saved bounds are never trusted.

## What is bounded

For each endpoint, the original sample times define a cubic least-squares derivative as a linear functional of the original positions:

`v_fit = Σ w_i q_i`.

The implementation reuses the maintained bounded rational arithmetic helper. It solves the four-column cubic dual exactly over the supplied binary64 values and checks reproduction of all four polynomial columns. If each position may change independently by at most `e`, the exact local-fit derivative changes by at most `e Σ |w_i|`. A separately declared derivative-model error `η` gives the conditional rate radius `e Σ |w_i| + η`.

This is sensitivity of an explicitly defined local fit. It is not evidence that a physical derivative lies in that interval. For example, adding a fast sinusoid that vanishes at every sampling time can change the actual derivative while leaving all sampled positions unchanged. A physical-rate conclusion needs the additional model-error assumption; reducing a reading radius alone cannot supply it. Timestamps are treated as exact.

The normalized endpoint kinetic loss is `(v_before² − v_after²)/2`. Squaring each conditional rate interval handles zero crossing explicitly. Equal reported coordinates can hide different true endpoint coordinates in `[q−e,q+e]`, so the frozen potential change is bounded separately by `2e M`, where `M` bounds the absolute restoring acceleration over that endpoint box. Gravity and bias use global unit feature bounds; spring and cubic terms use the largest absolute coordinate in the box. This bound belongs only to the supplied frozen gravity/spring/bias/cubic family. It is not a statement about every autonomous potential.

The resulting energy-loss enclosure is normalized rad²/s², not calibrated joules. A strictly negative upper endpoint means negative throughout these declared boxes, conditional on the chosen model and assumptions. A nonnegative lower endpoint does not validate a dissipative law. An enclosure crossing zero is unresolved; shared original sample dependencies are overbounded, so overlap does not construct an achievable joint trajectory. No probability, confidence level, causal mechanism or physical passivity certificate is asserted.

## Exact arithmetic and population custody

Every original return row remains present, including unsupported rows. The entire additional calculation is reserved before any exact window calculation, with limits of 512 unique endpoint windows, 2048 retained rows and four million arithmetic calls. Exceeding the complete reservation refuses the population without doing partial exact work. Original source replay has its own existing bounds. Exact arithmetic retains the shared 4096-bit capacity; rank, arithmetic-capacity or nonfinite display-enclosure failures remain explicit refusals. The operation count is not a universal runtime or bit-complexity guarantee.

The original floating-rate estimate stays visible beside the exact-local-fit value. Those are different numerical objects. On the retained measured source, one near-zero interval changes sign: original rows 207/209 of the selected 5–25 s window have maintained kinetic loss about +2.29e−16 and exact local-fit loss about −1.11e−15 rad²/s². No tolerance hides this difference, and neither sign is a calibrated physical threshold. Thus the zero-radius exact calculation has 50 negative rows while the unchanged original inspector has 49.

Endpoint boxes extending beyond the supplied model's training position domain are flagged. An inside-domain endpoint box is not proof that the full course or physical model is supported. Missing training-domain metadata remains unavailable.

## Executed evidence

The same attributed PASCO notebook and original row selections described in [Equal reported-coordinate returns](EQUAL_ANGLE_RETURNS.md) supply 123 overlapping intervals across 17 cycles. No new acquisition, interpolation or coefficient fit occurred. The measured course has 246 distinct nine-sample endpoint windows, with local reading gain approximately 92.08754 s⁻¹. Exact local derivatives differ from maintained floating derivatives by at most 1.155e−14 rad/s in the independent probe.

| Hypothetical position radius | Additional derivative-model error | Negative throughout | Unresolved |
|---:|---:|---:|---:|
| 0.0005 rad | 0 rad/s | 27 | 49 |
| 0.001 rad | 0 rad/s | 22 | 60 |
| 0.005 rad | 0 rad/s | 10 | 101 |
| 0.0005 rad | 0.1 rad/s | 20 | 68 |
| 0.005 rad | 0.5 rad/s | 0 | 123 |

These offered assumptions were retained rather than selected as calibrated thresholds. Seven reported endpoint levels are outside the recorded training position range at zero reading radius. The independent Python Fraction experiment treats offered decimal radii as exact fractions; the product treats typed numeric declarations as their supplied binary64 values. The matched numerical controls do not conflate those representations.

Five focused native groups passed: independent Fraction-result comparison on the complete source population, the tiny exact/floating sign difference, monotone widening and all-unresolved control, polynomial potential bounds, and whole-population refusal/raw-only replay. The actual sandboxed browser course passed 27 groups, including 861 displayed bound values, original return-marker retention, real raw download and fresh-page reopen, worker cancellation, declaration/source retirement and all previously exercised half/return seams.

The first full-course bound screenshots captured an in-progress smooth scroll and were not accepted as new-control visual evidence. Product source remained unchanged; a separate three-group sandboxed visual course used instant scrolling plus actual visible-rectangle checks and received the desktop/390 px controls and result. The final committed full receiver incorporates that capture correction; its earlier arithmetic/lifecycle run and final targeted visual run remain separately identified in the receipt. No new repository-wide native-suite or complete distribution-package claim is made.

## Reproduce

```sh
node --test --test-reporter=tap tests/equal-angle-bounds.test.mjs
CHROME=/path/to/sandbox-capable/chrome NODE_PATH=/path/to/playwright/node_modules node scripts/equal-angle-bounds-browser.mjs "$PWD" /path/to/new/output
```

Keep namespace/seccomp sandboxing active, including TSYNC, and use a fresh writable output directory under a suitable unprivileged account. Do not disable sandboxing. The wrapper schema is `worldlaw.equal-angle-bounds/v1`; its original return inputs and explicit declarations are the replay authority.

A later narrow worker-resource repair closes a newly created worker if message submission throws synchronously. The preserved original helper failed the dedicated failure control; the repaired helper passed three lifecycle controls. The final helper then passed a separate three-group actual source-reopen/desktop/narrow visual course. The scientific core and original 27-group stage remain separately pinned; no historical run was relabeled.
