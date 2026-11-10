# Read the local response of an executed law

The Discovery Studio places a local-response readout beneath the actual
predicted mechanism. It explains how the inspected scalar torque law responds
to a small angle or angular-rate perturbation at the **displayed solver sample**.
The mechanism and readout use the same executed trajectory and sample index.
The readout has no separate solver, animation timer or fitted model.

## Use it in the Studio

1. Import observations or reopen a notebook, then inspect a fitted law.
2. In **Let the model move**, declare the starting angle, rate, inertia, duration
   and fixed command. Select **Run dynamics**.
3. Watch **LOCAL MOTION RESPONSE** under the mechanism. Open **Inspect this
   local calculation** to see the numerical state, perturbation equations,
   declarations, sample counts and interpretation limits.

The initial sample is immediately available with reduced motion enabled.
Ordinary playback updates the readout at the mechanism's existing sample index;
it does not repeatedly announce an unchanged status sentence to assistive
technology. The disclosure uses native keyboard interaction and a visible focus
indicator.

Changing a dynamics input clears the earlier values until another execution.
A refused trajectory leaves an explicit unavailable readout. Selecting a new
input source also retires the earlier calculation while the replacement is
pending. An invalid replacement preserves the accepted notebook; running its
dynamics again computes a fresh readout. A superseded asynchronous file read
cannot revive a retired course.

Current or historical competitive-law motion retires the inspected-law
readout. **Return to inspected law** executes that law again. This version does
not attach one inspected law's derivatives to a competing or historical path.

## What the three fields mean

For the declared fixed command `u`, inertia `I`, angle `θ` and rate `ω`, the
executed scalar equations are

$$
\dot{\theta}=\omega, \qquad
\dot{\omega}=\frac{\tau(u,\theta,\omega)}{I}.
$$

At one displayed sample, the readout computes the torque partial derivatives
and the ordinary perturbation matrix

$$
A(\theta,\omega;u,I)=
\begin{pmatrix}
0 & 1 \\
\frac{1}{I}\frac{\partial\tau}{\partial\theta} &
\frac{1}{I}\frac{\partial\tau}{\partial\omega}
\end{pmatrix}.
$$

| Readout | Numerical meaning | Interpretation boundary |
| --- | --- | --- |
| Angle perturbation | Sign and value of `∂τ/∂θ` at the current sample. A negative value is labelled restoring; a positive value is amplifying. | A local response to an infinitesimal coordinate perturbation, not a claim about a finite displacement or the true physical mechanism. |
| Rate perturbation | Sign and value of `∂τ/∂ω`. A negative value opposes a rate perturbation; a positive value reinforces it. | The derivative of the fitted law under the declared fixed command. It need not identify the physical cause of dissipation or gain. |
| Frozen modes | The two eigenvalues of this instantaneous `2 × 2` matrix, with their real/complex form and growing, decaying or neutral pattern. | The matrix is held fixed for this calculation. Its eigenvalues alone do not describe finite-time perturbation growth along a moving trajectory. |

The calculation distinguishes neutral position with decaying or growing rate
from the two-zero-mode case. Two zero eigenvalues can still permit position
drift. A repeated or nearly repeated pair is not silently turned into a claim
of asymptotic stability.

The details say whether the supplied scalar equations are stationary at this
floating-point sample: both `ω` and recomputed `τ` must be zero. This observation
does not certify a root, nonlinear stability, contact behaviour or physical
equilibrium. The separate [notebook balance reader](BALANCE_CANDIDATES.md)
inspects numerical zero-rate torque candidates under a specified command.

## Numerical and source contract

[`local-motion-response.mjs`](../src/science/local-motion-response.mjs) uses
analytic partial derivatives for the eleven maintained scalar-library terms:
command, rate, Coulomb sign friction, spring, gravity, quadratic drag, bias,
cubic position, cosine position, even rate and command × position. The command
is held fixed; inertia is an explicit positive finite declaration.

A nonzero Coulomb sign term at zero rate is nonsmooth. The readout retains that
state and its reason instead of inventing an ordinary rate derivative or frozen
modes. Unsupported terms, invalid rows and invalid declarations are refused.
Unrepresentable products, derivative scaling or mode calculations remain
numerically unresolved. They are not relabelled as exact zero or neutral motion.

Derivative sums retain small contributions when large signed terms cancel.
The eigenvalue calculation scales its arithmetic and preserves a slow root
when a direct subtractive expression would lose it. These are floating-point
techniques, not interval bounds or a certification of conditioning. The course
reports admitted, nonsmooth and unresolved sample counts.

The component owns a numerical snapshot of the law and trajectory. Installing
a new course returns a new opaque handle. Retired handles and late callbacks
cannot replace the active result. The browser wiring retires the handle on
source changes, input edits, refused execution, competing-law playback and
page departure. It never appends observations, changes model ranking or writes
derived answers into a notebook.

## Experience and receiving

Two actual rendered compositions were compared: a separate ruled diagnostic
report below the mechanism, and a compact readout inside the mechanism
instrument. The integrated composition keeps the numerical time, executed
object and local response together. The three fields become aligned rows on
narrow screens. The decorative coordinate footer is removed at those widths
so the prediction/source labels remain readable.

The preserved captures show the [complete separate-report exploration](receipts/local-motion-response-20261028/concept-a-separate-readout.png),
[chosen integrated desktop instrument](receipts/local-motion-response-20261028/concept-b-integrated.png),
[keyboard calculation disclosure](receipts/local-motion-response-20261028/desktop-keyboard.png)
and [integrated instrument at 390 px](receipts/local-motion-response-20261028/narrow-instrument.png).
Both compositions were rendered from the actual same executed notebook. The
final browser course also checked 320, 768 and 1440 px layouts without document
overflow. The integrated instrument keeps the moving object, source identity,
solver time and local calculation together; the separate report creates a
longer visual scan between the mechanism and its response.

Fresh receiving on canonical main `440591a3a60719a1d356054e7da162ba252f8700`
plus this increment ran all 230 composed test files: **1,622 passed, zero
failed, zero skipped**. The standard `npm run verify` also passed both launched
application smokes. The current-main reference-request course passed separately.
The optional live Node/Chromium notebook interoperability test was enabled and
passed all three source-preservation controls. Its launch now explicitly enables
Chromium's sandbox; the entire suite ran as a non-root account. An earlier
sandbox-admission failure is retained in the verification record.

All eight actual local-response browser groups passed on Chrome 156.0.8078.73.
The final alternate-design capture uses full-page clipping so the complete
mechanism and all three diagnostic rows are visible. That capture-only change
was followed by another complete browser course; production and native-test
bytes are unchanged from the passing full run.

Run the native numerical and lifetime controls with:

```sh
node --test tests/local-motion-response.test.mjs tests/local-motion-response-panel.test.mjs tests/local-motion-response-app-lifetime.test.mjs
npm run verify
```

The maintained actual-browser course is
`scripts/local-motion-response-browser.mjs`. Supply the existing
`PLAYWRIGHT_MODULE`, `BROWSER_EXECUTABLE_PATH` and optional
`BROWSER_ARTIFACT_DIR` environment variables. Run Chrome as a non-root account
with its sandbox enabled. The recorded receiving environment is Linux; that
course checks the browser's active namespace and Seccomp sandbox status.

The browser course exports and replays actual notebooks, compares the readout
to the executed law, exercises evidence revision and changed declarations,
refuses invalid inertia, crosses current and earlier competitive-law views,
supersedes a delayed source read, imports independent analytic sign-torque
observations, and checks keyboard/reduced-motion behaviour and 320–1440 px
layouts. [The verification record](receipts/local-motion-response-20261028/verification.json)
retains exact source, commands, source-notebook hashes, results and limits.

All recorded observations here are declared synthetic controls. This increment
does not establish a physical law, calibrated uncertainty, nonlinear stability,
continuous agreement between samples, or an error enclosure.

## Further outcomes

The queued response comparison across every law on the existing shared
competitive-motion clock is a separate consumer increment. Finite-time
perturbation propagation requires actual variational integration and numerical
receiving, not an inference from instantaneous eigenvalues. Existing finite-time,
stiffness-probe and balance-view work retains its separate ownership.
