# Challenge odd angle response

Launch the existing application with `npm start` from the extracted `worldlaw`
directory (Node.js 20 or newer; no npm install step). Open
**http://127.0.0.1:4193** in a current browser. See [distribution instructions](DISTRIBUTION.md)
for the maintained launch and port options.

In the Discovery Studio, open **Challenge odd angle response** beside the
original-reading diagnostics. This read-only instrument asks whether the current
fitting readings at one exactly fixed command and rate are compatible with

\[
\tau(\theta)=c+g(\theta),\qquad g(-\theta)=-g(\theta),
\]

about the existing declared angle origin, **0 rad**. The same constant torque
offset `c` must work for every available reflected pair and every zero-angle
reading in that slice. It is not independently fitted for each pair.

## Use the original readings

1. Import observations or open an existing Studio notebook through its ordinary
   controls. The default virtual source also remains available and labelled.
2. Choose an exact command/rate slice already present in the current fitting
   rows. The screen does not include held-out rows or model predictions.
3. Declare an absolute torque-reading error bound in N·m and explicitly assume
   that the declared input coordinates are exact. The bound starts blank. A
   fitted noise standard deviation or a dimensionless row noise ratio is not
   silently converted into an absolute bound.
4. Select **Inspect shared offset**. Inspect the resulting constraints and the
   original rows that support them. Human row numbers refer to the retained
   notebook; the programmatic certificates use zero-based source indices.
5. Switch between **Shared-offset intervals** and **Mirrored original readings**
   to inspect the same evidence in two different geometries. For an exclusion,
   **Inspect contradiction witnesses** exposes the decisive constraints and
   every contributing original reading.

Changing a declaration retires the conclusion immediately. Replacing the source,
reopening a notebook, or rerendering the model diagnostics recreates this screen
with its assumptions unset. It does not modify or persist a fitted result, alter
the scientific ranking, adopt a source, plan an experiment, or control hardware.
Save and reopen the original notebook using the existing Studio controls, then
declare the inspection assumptions again.

## Read the conclusion precisely

| Result | What was established |
| --- | --- |
| Declarations required | No scientific conclusion was calculated. |
| Repeated readings conflict | At least two readings at the same exact input state cannot share a deterministic torque within the declared bounds. This is distinct from an oddness exclusion. |
| Insufficient mirrored evidence | There is no nonzero exact `+a`/`−a` pair. A zero-angle reading may bound `c`, but it cannot establish reflected coverage. |
| No shared offset | Under these coordinate and reading-bound assumptions, no one `c` can satisfy all observed pair/zero constraints. Two exact conflicting constraints constitute the exclusion witness. |
| Finite compatibility | One exact assignment satisfies every admitted reading bound and every observed reflection identity. This does not identify a continuous law or establish physical validity. |

Unmatched angles remain visible. A nearby negative angle is not treated as an
exact opposite, and an unobserved counterpart is never presented as a reading.
Repeated rows are retained individually; their existence does not establish
independent acquisitions.

The default plot aligns all allowable `c` intervals on one torque axis. Its
common limits use every constraint, even when the visible lanes are paginated.
The alternate plot places original readings and their declared error intervals
at the observed angles. It contains no fitted curve or invented motion. Source
tables and finite-witness assignments are paginated with explicit range/total
counts; the calculations still use every admitted row.

## Exact finite-sample calculation

For each original reading `y` and declared radius `r`, form the closed interval
`[y − r, y + r]`. At a repeated input state, intersect every original interval,
yielding `[L, U]`. An empty intersection is a repeat conflict and stops the
reflection calculation before it could be labelled an oddness exclusion.

For an observed pair at `−a` and `+a`, the required offset interval is

\[
c\in\left[\frac{L_{-a}+L_{+a}}2,
            \frac{U_{-a}+U_{+a}}2\right].
\]

A zero-angle state contributes its own interval because oddness requires
`g(0)=0`. Intersect all pair and zero constraints. A strict gap between the
greatest lower bound and least upper bound excludes a common offset. Closed
intervals that only touch are compatible.

For a nonempty intersection, choose an exact `c` inside it. With `q=2c`, a paired
witness can use `t_plus=max(L_plus, q−U_minus)` and `t_minus=q−t_plus`. The interval
conditions ensure that both are admitted. A zero state receives torque `c`;
unmatched observed states receive a value within their own interval. The result
retains exact torque assignments for every observed state so that an independent
checker can verify them against **every original reading**, including repeats.
These witness values are mathematical assignments, not new observations.

All decisions use exact rational arithmetic on the admitted binary64 numbers
and declared radius. The existing bounded CHRONOS exact-arithmetic primitives
are reused unchanged. Exact certificates use reduced decimal integer strings:
`{"numerator":"1","denominator":"2"}` represents one half. No epsilon,
coordinate rounding, display rounding, or fitted-noise tolerance enters a
decision. The maintained observation limit is 4,096 rows; declared numeric
coordinates and radius follow the screen's explicit finite bounds.

Graphics use outward binary64 enclosures. Two distinct exact endpoints can occupy
the same pixel or share a rounded label; expandable exact rational text remains
authoritative. In particular, the average of zero and the smallest positive
binary64 value is a nonzero exact offset even though it has no exact binary64
representation. A second pair that forces zero excludes that first offset; the
screen must not average both pairs to zero and report compatibility.

## Authored controls and limits

The receiving course imports an explicitly authored nine-row source with
`torque = 3 + 2 × angle`, reflected angles 1 and 2 rad, repeats, and one zero
anchor. At radius zero its shared offset is exactly 3 N·m. A separate eight-row
control with `torque = angle²` forces offsets 1 and 4 N·m at the two reflected
magnitudes. Its exact 3 N·m gap excludes a common offset. These are numerical
software controls, not physical measurements.

The independent Python checker reconstructs source numbers with `Fraction`,
recomputes intervals and verifies source indices, exact certificates and each
original witness bound. Focused controls also retain touching intervals,
adjacent radii, incompatible repeats, missing partners, exact slice boundaries,
zero anchors, input preservation, and deliberately corrupted certificates that
the checker must reject. Run them with:

```sh
node --test tests/reflection-compatibility.test.mjs
```

This independent verification uses Python 3. The application itself retains its
existing Node.js launch with no npm runtime dependency installation. The actual
browser receiver is `scripts/reflection-browser.mjs`, using the same externally
supplied Playwright and Chrome conventions as the maintained Studio receivers.

Exclusion is conditional on the chosen origin, exact coordinates, fixed slice,
absolute bounds and deterministic response. An exclusion does not identify
which assumption or physical mechanism is wrong. Compatibility of finitely many
readings cannot prove a global odd law or predict unobserved behavior. The
default odd-position torque terms reduce to the inspected form at fixed command
and rate, while an optional even-angle term need not. This screen therefore
challenges the stated class, not every model available in WORLDLAW.

This capability complements the additive separability inspector and ongoing
model discovery. It leaves their algorithms and scientific claims unchanged.
