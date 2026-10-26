# Sliding and sticking as a separate executable hypothesis

Trajectory Challenge can compare the ordinary fitted sign-rate law with an
explicit **equal static/kinetic Coulomb** interpretation. The original law,
coefficient ranking, numerical forecast and training mismatch stay available.
The comparison does not infer a static friction threshold from moving data.

## Mechanical assumption

For negative fitted Coulomb coefficient −c, c > 0, write the remaining fitted
torque as F(q,v,u). During sliding, I v′ = F − c sign(v). At exactly zero rate,
the comparison holds position if |F(q,0,u)| ≤ c; otherwise it restarts in the
force direction with acceleration (F − c sign(F))/I. Inertia and command units
remain the original supplied kg·m² and N·m. Positive fitted sign-rate
coefficients refuse this interpretation. A model without that term has no
friction threshold. Distinct static and kinetic magnitudes, contact geometry,
variable normal load and presliding displacement remain outside this model.

The ordinary sign-rate model is not silently redefined. In particular,
sign(0) = 0 does not supply a balancing contact force, and its fixed-step RK4
approximation can creep near rest. These are two explicitly different
executable hypotheses. No change in challenge error promotes either model or
changes the coefficients fitted on training observations.

## Numerical mechanism and work

Each sliding branch uses the maintained RK4 force calculation with friction
direction fixed through the smooth stages. An endpoint whose velocity changes
sign brackets a zero as before. If the endpoint retains its initial sign,
the solver now also evaluates the half-duration sliding state: an opposing
velocity there exposes an internal zero that the endpoint concealed. The
first observed bracket is bisected, velocity resets to exactly zero under
the contact hypothesis, and remaining time is integrated or held at rest.
The original left-held command changes can initiate motion again. The first
increment refuses combined delayed/gradual command timing rather than
silently reinterpreting that separate apparatus.

Every smooth RK4 evaluation, including an optional half-duration probe and
at most 48 bisections per event, counts against the existing maximum-step
budget. A continuing sliding step now normally costs two RK4 evaluations
rather than one. At most eight events are processed inside one nominal step.
Resource excess, nonrepresentable event advancement,
runaway and nonfinite states refuse complete output. Two-resolution receiving
shares the original combined budget and retains unavailable refinements.

A single internal midpoint check detects some same-sign endpoint reversals,
not every possible pair of internal velocity zeros. On an independent exact
harmonic sliding branch with stiffness 100, friction 10, unit inertia and one
0.7-second nominal step, the original source missed two events and ended at
q=0.778512; the new check recovers two events and q=0.476951, matching a
separately subdivided exact-branch control. In the actual maintained RK4
consumer, a deliberately coarse 0.35-second step also reveals previously
missed events, but its position still differs materially from a 0.01-second
reference: locating events does not make coarse RK4 accurate.

Finite-step event bracketing can still miss internal zeros. Two-step agreement
is not a certified error bound, global event-resolution guarantee, physical validity check or
proof of contact behavior. Inspect step sensitivity and original evidence.

## Actual consumer and persistence

Enable **Compare sliding and sticking friction** beside the existing fit
controls. The orange dotted course is drawn on the same observation plot as
the retained dashed sign-rate prediction, with separate error and held-rest
duration. An unavailable comparison states its refusal. The selected-law
metrics and diagnostics retain the incumbent and every training mismatch.

A separate contact-only panel was considered; a second forecast on the same
original timestamps makes the precise stopping difference easier to inspect
without splitting one experiment across unrelated charts. This extends the
maintained moving apparatus rather than adding a detached summary dashboard.

Opted-in notebooks use `worldlaw.trajectory-notebook/v4` with an explicit
`compareCoulombContact: true` declaration. They save original inputs and
settings, not trusted cached contact results. Reopening recomputes both
forecasts. Existing v1–v3 inputs retain their original meaning; older readers
refuse v4. This first comparison requires known-inertia torque recordings;
unknown-inertia angular evidence does not acquire an invented torque scale.

## Executed mathematical controls and limits

The independently evaluated harmonic half-cycle oracle uses stiffness 4 and
friction 0.6. Its 1 rad release stops at −0.1 rad after three half-cycles. The
development solver achieved 1.34e−9 rad RMSE versus 0.002856 rad for the
ordinary sign-rate solver. The maintained production contact solver and
two-resolution comparison pass the same exact oracle. Independent constant
force courses cover subthreshold hold, restart, reversal and stopping.

The actual maintained weak fitter uses two separately authored sliding
training starts (1 and −1.3 rad) and recovers approximately −3.99441 for the
spring term and −0.598916 for the Coulomb term. On a separate 0.8 rad release,
the actual session preserves original RMSE 0.00392817 rad and produces a
contact comparison RMSE 0.000456676 rad. The training result remains
**residual_mismatch**. Better receiving error does not turn that inadequate
training law into an accepted physical explanation. The initial position is
excluded from both actual session RMSE calculations.

A deliberately different true static threshold remains a failure: a 0.5 N·m
command holds under static threshold 1 but moves under the offered equal
threshold 0.2. The retained test requires material forecast error. A
no-stopping course retains exactly the same smooth forecast, and changing
future observed positions cannot change either predicted course.

Independent source review additionally checked 12 pure-friction stop cases,
covering both velocity signs, inertias 0.1/1/10 and maxStep 0.007/0.2. Stopping
position 1 + sign(v) v² I/(2c), terminal zero rate and held duration
T − |v|I/c agreed within 1e−11 rad and 1e−10 s. These are numerical controls,
not physical measurements or formal proofs.

The exact original PASCO training `len1_cond1_1.csv` was inspected beyond the
shipped 25 s window (SHA256
`3d407510fd2c0fcbca7f7b3a223f34f0788821f3a21b6b94ccd24a087b6a19be`).
It still oscillates at 68.95 s. It therefore does **not** qualify stopping or
stiction, and no measured gain is claimed. Its source and reuse attribution
remain in `research/PHYSICAL_TELEMETRY_92be.md`; no separate physical challenge
was opened for this increment.

## Actual current-source receiving

The lead received this candidate with current-main dependencies from
`ff566099deb38095d3bd0ef20d13792aa8a647c2`. The focused remote native command
passed **73/73 tests**, with zero failures, skips or cancellations, in
**13566.067033 ms** on Node 22.23.4 / Linux. This includes the incoming angular
forward-refinement tests and existing command-timing, forward, resolution and
session regressions. It is a focused suite, not a full-repository test claim.
See [the native command and receipt](receipts/coulomb-contact-1d6c/native.json).

The actual browser course completed in **2.368610073 s** using normally
sandboxed Chrome at widths 1440 and 390. Original RMSE remained 0.003928 rad;
the separately displayed contact result was 0.000457 rad with 5.284 s at rest.
The original training mismatch stayed visible. Keyboard toggling, comparison
plot, actual exported Blob/file-input reopening under v4, and recomputation
passed with no page exceptions. Both widths retained checkbox focus, fully
visible help and document scroll width equal to viewport width. This tests
the actual exported Blob, not completion of a native browser download.

The lead visually inspected all four current screenshots and found controls,
help, focus and forecast comparison legible. See the
[desktop control](receipts/coulomb-contact-1d6c/contact-control-1440.png),
[desktop forecast](receipts/coulomb-contact-1d6c/contact-forecast-1440.png),
[narrow control](receipts/coulomb-contact-1d6c/contact-control-390.png),
[narrow forecast](receipts/coulomb-contact-1d6c/contact-forecast-390.png), and
[machine-readable browser results](receipts/coulomb-contact-1d6c/browser.json).
Independent review found no remaining core or v4/session compatibility
blocker. A nine-case direct comparison retained complete legacy rollout
outputs exactly after the shared-kernel refactor.

These receipts qualify this bounded mathematical mechanism and its actual
consumer. They do not establish physical stopping behavior, calibrated
uncertainty, globally resolved contacts, deployment or full product completion.
