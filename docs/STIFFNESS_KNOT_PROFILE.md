# Change angles between the declared grid points

Stiffness Lab can now propose a one-hinge change angle inside the observed
training range, including an angle absent from the declared grid. This is an
optional investigation of the existing response family. It keeps the original
grid, nuisance terms, numerical fitter, separately supplied checks and saved
experiment behavior.

## Use the actual response apparatus

Open `/stiffness.html`, load a source or saved experiment, and choose **Search
between grid points**. A better-scoring computed candidate is inspected on the
existing torque/angle plot. The declared-grid winner remains visible as a green
dashed curve; the orange curve is the inspected candidate. The original study
verdict and experiment are unchanged during inspection. The comparison table
shows the candidate's training and separate-check error beside the original
models. Gauge view remains the existing two-response instrument.

**Inspect declared grid** and **Inspect computed candidate** switch the inspected
law. **Add angle to editable grid** appends the computed angle without refitting
or erasing an acquisition history. The ordinary **Fit declared explanations**
action explicitly starts a revised study, as it already does for any settings
change. Save the prior experiment first when its pending request or acquisition
history must be retained. The resulting angle and original input evidence
survive the maintained experiment save/reopen path; no cached fitted result is
trusted. The optional search itself is rerun from those inputs.

Separate checks never generate angles, fit coefficients, choose a winner or
change the search workload. A lower fitting score may coexist with worse check
error. Supplied source labels and independence remain declarations.

## Mechanism and qualification

For a declared knot `k`, the existing law is linear in its nuisance/position
coefficients and the hinge `max(0, position - k)`. Between two neighboring
distinct observed angles, the active hinge rows do not change. Using interval
coordinate `t`, the hinge column can be written `u - t*v`.

The implementation uses the maintained `fitLinearColumns` QR primitive to
project the target and both columns away from the unchanged nuisance/position
columns. For projected vectors `r`, `u`, `v`, set:

```
a = r·u       b = r·v
c = u·u       d = u·v       e = v·v
residual reduction(t) = (a - t*b)^2 / (c - 2*t*d + t*t*e)
stationary candidate(t) = (b*c - a*d) / (b*d - a*e)
```

The nonzero stationary candidate is proposed when it lies strictly inside its
interval. Interval endpoints, their adjacent representable interior values and
a representative midpoint are also retained. The interior neighbors capture
finite candidates next to an open side-support boundary without admitting the
unsupported endpoint itself.
Near-zero denominators, rounded endpoints, projection failure and nonfinite
arithmetic are recorded. The module uses normalized projected vectors and
compensated dot products for this proposal calculation; it never constructs an
executable model from these coefficients.

Every proposed angle, together with every original grid angle, is passed back
through `investigateStiffness`. Its column rank, bounded coefficients, three
distinct positions on each side, noise floor, cubic alternative and searched
knot parameter count remain authoritative. More than 101 angle proposals are
processed in successive native calls and all results retained. This batching
does not truncate the candidate population.

The ordinary finite-grid winner is retained unless a newly computed one-hinge
candidate improves its score beyond a small floating-point comparison margin.
The margin is `512*EPSILON*(1+abs(oldScore)+abs(newScore))`; it is neither a
scientific discrepancy tolerance nor a probability. When a declared cubic or
global law remains preferable, no new angle is recommended.

### Limits that remain visible

- This is a floating-point candidate search, **not a certified continuous
  global minimum**. Numerical rank changes can affect admission. A stationary
  calculation can remain unresolved. Returned interval records preserve that
  distinction.
- Strict side support leaves the extreme eligible intervals open at one end.
  Unsupported endpoints appear as refused native candidates. An unattained
  boundary infimum is not claimed to be an admissible solution.
- The bounded arithmetic-work estimate is checked before interval work. Above
  16,000,000 declared units, the whole optional search is refused and no partial
  winner is emitted. Units are a conservative loop/fit accounting device, not
  milliseconds, operations measured on hardware or a proof of latency.
- If the baseline nuisance/position columns are rank deficient, adding a hinge
  does not repair their linear dependence; the optional search refuses. Terms
  are never silently removed.
- A single hinge cannot represent arbitrary smooth response, several changes,
  state dependence, instrument effects or mechanism topology. A fitted angle
  does not establish a physical cause, passive restoring behavior, calibration
  or permission to actuate.
- The original declaration still admits at most 101 angles. A full grid must
  be explicitly changed before adding another candidate.

## Reproducible receiving

Run `node tests/stiffness-knot-profile.test.mjs` for authored analytic controls,
nuisance/row-order checks, a separate dense-grid comparison, omitted-family
counterexamples, coordinate transformations, multi-batch completeness, rank and
work refusals, check independence and actual notebook replay. The nonlinear
truth used in these development controls is independently authored; it is not a
physical measurement or a blind external dataset.

Run the launched browser course with a compatible installed Chrome:

```
BROWSER_EXECUTABLE_PATH=/absolute/path/to/chrome \
BROWSER_ARTIFACT_DIR=/absolute/path/to/receipts \
node scripts/stiffness-knot-profile-browser.mjs
```

It uses an isolated temporary browser profile and localhost application. It
does not add a sandbox-disabling flag. It checks actual file import, curve
comparison, native keyboard activation, explicit revision, actual download and
reopen, contradictory checks, rank/work/capacity refusal, stale-read fencing,
desktop/narrow layout, reduced-motion mode and browser errors. Runtime sandbox
attestation and physical validation are separate claims.

The first development control has a true angle of 0.137 rad. The offered grid
selects 0.25 rad with about 0.09838576 N·m training RMSE. The profile proposes
0.13700000000000007 rad with about 4.02e-16 N·m training RMSE. The maintained
noisy example retains its original grid winner because the computed alternative
does not improve the declared noise-floor score. These results establish a
useful numerical capability within the stated family, not universal discovery.
