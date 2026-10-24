# Coupled circulation with bounded coordinate readings

Coupling Lab's **Take the response around a closed path** retains its original
exact-coordinate fitted-law comparison. After comparing a loop, open **Does
circulation survive coordinate measurement uncertainty?** to investigate how
declared angular reading uncertainty changes the observed polygon's signed work.
Edit the paired angular radii and their source declaration, then inspect. The
original torque radii and integration allowance are retained. The default zero
angular radii are copied assumptions, not estimated sensor precision.

## Computation and custody

The input schema is `worldlaw.coupling-circulation-angle-boxes/v1`. It contains the
original normalized paired-coordinate path, one paired angular radius per row,
and the explicit dependence assumption
`independent-coordinate-row-boxes-with-shared-first-last-angles`.

Each coordinate uses the maintained scalar `analyzeAngleBoxes` mechanism from
`src/cycle-work/angle-boxes.mjs`. That mechanism computes exact polygon extrema
over the scalar angle/torque boxes using dynamic programming on four endpoint
states per acquisition row. Its BigInt dyadic arithmetic retains the exact
binary64 input values and exact center-plus/minus-radius endpoints.

The two coordinate-variable sets are independent under the declared model.
Therefore the joint minimum is the sum of the two minima, and likewise for the
maximum. Both coordinate witnesses are simultaneously attainable. The adapter
aligns their dyadic exponents and sums integers; it never sums rounded decimal
displays. The supplied integration allowance is attached to the first varying
axis once before combining interval bounds. It is not applied twice.

First and last angles are one shared variable on each coordinate. Their nominal
values and radii must agree. The final torque remains a separate reading. All
interior acquisition rows remain independent even when their nominal coordinates
repeat. Other correlation structures are unsupported.

The existing 4–1024 paired-row admission cap is retained. Two scalar solves cost
at most 128 state transitions per segment in total. An exactly constant axis with
zero angular radii contributes exactly zero. A constant nominal axis with any
nonzero angular radius explicitly refuses because the maintained scalar solver
does not admit a constant nominal path. No artificial coordinate movement or
closing segment is inserted to bypass this limitation.

The witness inspector shows original row numbers, exact angle and torque endpoint
assignments, and exact joint work. These are mathematical witnesses, not acquired
measurements. Saved files contain only input declarations and original rows;
reopening recomputes. Changing text clears derived claims. Replacing the original
circulation comparison removes the entire subordinate inspector, and a late
detached file read cannot restore it. Reopening an independent bounded-loop file
does not replace the nominal fitted-law comparison or training notebook above it.

## Interpretation

Positive or negative work means zero is excluded by the polygonal work interval
under the declared boxes and integration allowance. A zero-compatible interval
does not identify a conservative physical mechanism. No physical full-state
closure, continuous-path work, passivity, dissipation, probability coverage or
measurement calibration follows. The nominal fitted-law comparison remains
conditional on exact nominal coordinates; this inspector does not extend that
comparison to uncertain coordinates or refit any law.

An authored directional square has nominal work 2 J. Zero coordinate radii and
zero torque radii preserve exactly 2 J; a supplied 0.25 J integration allowance
gives [1.75, 2.25] J. Independent one-radian coordinate radii admit zero. These
are software controls, not observations of a physical apparatus.

A more sensitive authored square uses torque `[theta2, 1.02 * theta1]` with zero
torque radii. Its nominal circulation is approximately 0.02 J. Angular radii of
0.001 rad retain [0.01596, 0.02404] J, while 0.005 rad admits
[-0.0002, 0.0402] J. Every scenario is retained: even small declared coordinate
uncertainty can erase the sign of a weak directional signal without changing the
nominal observations or choosing a different fitted law. These illustrative
radii are not sensor calibration.

## Receiving

Run `node tests/circulation-angle-boxes.test.mjs`. The native course checks six
independent complete paired endpoint enumerations, simultaneous witness
attainment, zero/wide bounds, one-time allowance, reversal, coordinate translation,
exact constant axes, unsupported cases, source immutability and input-only replay.

Actual browser receiving extends the maintained circulation course:

```sh
WORLDLAW_CIRCULATION_BOX_RECEIVING=1 \
BROWSER_EXECUTABLE_PATH=/path/to/chrome \
BROWSER_ARTIFACT_DIR=/path/to/receipts \
node scripts/coupling-circulation-browser.mjs
```

The receiver exercises actual controls, keyboard execution, original-row witnesses,
download/fresh reopen, malformed bounds and retry, source invalidation, delayed
detached reads, and desktop/390px layouts. Browser execution and captured evidence
must be reported separately from passing native tests.

The interface extends the existing observed-path apparatus instead of adding a
second application. A separate full-page coordinate laboratory was considered;
the attached inspector keeps the source loop, original law comparison and bounded
work interpretation visible together. The JSON editor follows the existing
circulation and scalar angle-box controls; a future direct coordinate-box editor
could improve authoring without changing these scientific semantics.
