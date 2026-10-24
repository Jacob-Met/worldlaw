# Inspecting a preparation contrast under bounded periodic artifacts

UNKNOWN LAB can inspect its current recorded counterbalanced pairs against a
declared additive family of sinusoidal sensor offsets. The original paired
history result remains unchanged. This is a sensitivity calculation, not a fitted
sensor correction, calibrated confidence interval, or physical identification.

## Evidence and assumptions

Use **Could a periodic sensor offset explain this contrast?** after importing or
running paired evidence. Supply a source/basis for the assumptions and one to
sixteen components with periods in acquisition steps and nonnegative absolute
amplitude bounds in N·m. All components may coexist with independent phases.
One common additive sensor-offset process acts on both histories at the recorded
indices. Independent sensors or condition-specific amplitudes are outside this
model. Periods are not frequencies in seconds: acquisition indices do not authenticate
elapsed time. Repeated periods must be combined explicitly rather than counted
as independent declarations. Recorded balanced order needs at least four pairs
in each direction; no missing chronology or observations are invented.

For the maintained signed contrast weights w_i and origin s_0, a component has
C = Σ w_i cos(2π(s_i−s_0)/P) and S = Σ w_i sin(2π(s_i−s_0)/P).
Its maximum absolute contrast bias is A sqrt(C²+S²). The bounds sum because
each admitted component may choose its own phase. The same arithmetic is used
by the prospective acquisition-order comparison; this consumer applies it to
actual retained evidence without changing the planning results.

The expandable witness uses A cos(2π(s_i−s_0)/P + atan2(−S,C)) at each
original acquisition index. Its weighted sum attains the positive bound up to
roundoff; negating every offset attains the negative bound. This is a constructed
extremizer, not an observed or inferred sensor trace. A finite family excludes
neither other periods nor nonstationary drift, carryover, or incorrect bounds.

The instrument shows the observed contrast, the interval after allowing the
declared bias, and that interval expanded by the original descriptive
three-standard-error screen. The original empirical screen is not recomputed
after removing a fitted artifact. The combined interval has no calibrated
coverage claim. Zero inclusion means this screen cannot exclude zero under the
declared bound; it does not prove that an artifact caused the observations.
Numerical zero comparisons retain an explicit floating-point tolerance.

## Custody and interaction

Save exports only admitted raw paired evidence and explicit bounds under
`worldlaw.periodic-contrast/v1`; reopen recomputes the whole result. A reopened
snapshot is labelled separately and does not replace the main notebook.
Replacing the main evidence or editing any declaration retires the displayed
result and disables save. Late file reads cannot overwrite newer declarations.

The design compares an observed contrast directly with its explanatory interval
on one axis. An alternative full sensor timeline was rejected for this increment
because it would visually elevate the constructed extremizer into apparent
measurement. The explicit per-reading witness remains available for inspection.

## Verification

`node --test tests/periodic-contrast.test.mjs` covers six core groups: a
zero-memory phase-lock counterexample, independent direct-pair phase sweeps,
coexisting components and attaining witnesses, residual genuine contrast,
zero bounds, changed periods, translated/gapped acquisition indices, replay,
source preservation, unequal counterbalance/constant-offset cancellation and malformed/order/unit refusal. The authored amplitude
0.3 N·m period-four example gives a worst-case contrast bias approximately
0.424264 N·m. These are synthetic software controls, not sensor calibration.

`scripts/periodic-contrast-browser.mjs` is the actual browser receiving course
for source import, keyboard operation, witness inspection, download/reopen,
declaration/source invalidation, refusal and desktop/390px layouts. It uses the
existing running WORLDLAW URL (`WORLDLAW_URL`) and supplied Puppeteer/Chrome.
Run results, exact composed source and screenshots belong to the integration
receipt; authoring this script does not establish browser acceptance.

The receiver defaults to `/usr/bin/google-chrome-stable` and admits the actual
`chrome://sandbox` status before product navigation. Its `sandbox.json` records
browser version, raw status, PID/network namespaces, Seccomp-BPF and TSYNC
checks. A launcher path or absence of an explicit disabling argument is not
sandbox evidence; wrappers may inject options. Failed admission stops receiving.

## Received composition

Refreshed source base `9e2d48647595c9bbbaa91c09defc2d21d4c5f08b` preserves the independently merged full-pixel motion tracker. The complete native run reports 665 tests: 664 passed, zero failed, one existing optional live Node/Chromium exchange test skipped. All six actual UNKNOWN LAB browser groups and the launched product smoke pass on this composition. Desktop and 390px controls/result captures were inspected after moving this instrument into a full-width section. The installed Chrome binary reports active namespace, PID/network, seccomp and TSYNC protection; raw same-browser admission is retained. Ten full-JSON parity comparisons verify that the shared periodic-gain extraction preserves the existing prospective-order results, including large index translations and the prior v1 route. Independent Earth review also checked the bound with an unequal-order direct pair-sum oracle.

Earlier browser attempts used a convenience launcher later found to disable the sandbox; their functional observations are not sandbox qualification. The final evidence uses `/usr/bin/google-chrome-stable` and refuses inactive protection before product assertions. All controls are authored software experiments, not sensor calibration or acquired physical evidence. See `receipts/periodic-contrast-20261024`.
