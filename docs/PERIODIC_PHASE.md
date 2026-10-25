# Continuous periodic phase in original angle coordinates

The existing angle-reference apparatus searches an explicitly declared finite offset grid. The optional periodic comparison fits the additional cosine feature at the original recorded coordinates, so an off-grid periodic response can be represented without moving any observation or choosing a finer coordinate grid. Both the grid winner and the new comparison are frozen on training recordings before their separate challenge trajectories are executed.

Select **Compare continuous periodic phase in original coordinates** in Trajectory Challenge's angle-reference apparatus. The yellow curve comes from the same maintained forward solver as the other predictions. The switch resets on new source intake, changing settings invalidates the result, and the reference notebook stores only original input and declarations for recomputation.

## Model and comparison

The offered original-coordinate library is the declared grid library plus `gravity` (sin θ) and `cosine` (cos θ), without duplicates. It retains the same effective maximum number of terms, assumed noise and weak-window settings as the grid fit. Both sine and cosine are ordinary counted coefficients. No extra offset parameter is fitted in this comparison. All candidates and competitive alternatives are retained; adding terms does not force their selection. The ordinary angular and torque libraries remain unchanged by default.

For coefficients a and b, the periodic component is a sin θ + b cos θ = −A sin(θ−δ), where A = hypot(a,b) and δ = atan2(b,−a), modulo 2π. Angular coefficients and A have units rad/s²; physical inertia and absolute torque remain unknown. Other restoring or bias terms change the total equilibria, so δ is only the periodic component's phase. It does not identify a sensor correction, gravity direction, physical mechanism or uniquely determined equilibrium.

The reported numeric phase is withheld if the full offered design lacks numerical excitation, the selected law retains a training mismatch, or there is no selected periodic component. Coefficients, alternatives and refusals remain inspectable. A surviving phase remains a conditional finite-library description, with heuristic model scores and no calibrated uncertainty. Small-angle cosine can be nearly confounded with a bias; insufficient excitation is not repaired by adding a feature.

Cosine is supported through maintained torque evaluation, integral and compact weak fitting, angular validation, forward execution and bounded-input inspection. Other specialized consumers that explicitly restrict their model libraries continue to refuse cosine rather than invent an energy or passivity result.

## Evidence and limits

`node --test --test-isolation=none tests/periodic-phase.test.mjs tests/cubic-restoring.test.mjs` exercises the independent explicit-equation fine-step pendulum oracle already maintained in `experiments/integral-discovery-92be.mjs`. Its dynamics code does not call the fitted feature library. Two training releases and a separate larger-amplitude release have a declared reference displacement between offered grid points. This is authored numerical evidence, not new physical acquisition.

For phase .237 rad, grid [−.3,−.15,0,.15,.3], training releases 1.5/−1.3 and challenge 2.1 rad, the original grid selects offset .3 and rate+sine+bias, with challenge RMSE .05827299 rad. The original-coordinate rate+sine+cosine comparison gives 5.87208e−8 rad, recovering coefficients approximately −.27500002, −2.67312838 and +.64566574. This specific comparison shows the finite-grid limitation, not universal superiority: adding the actual phase to the old grid can also represent this truth. The extension avoids needing that coordinate-grid resolution and preserves the original source coordinates.

Negative controls retain omitted cubic dynamics as a residual mismatch and large prediction error, withhold phase on constant training positions, and retain solver refusals. A zero-phase control selects no needless cosine term. Mutating challenge positions leaves both trained selections unchanged. Input-only export/reopen recomputes the comparison, and cosine interval controls check the shared bounded-input consumer.

The already reused measured PASCO bundle supplies an informative negative. With the default six angular terms, assumed noise .01 rad and grid −.5 through .5 at .1 steps, the grid chooses gravity+bias at −.1 rad. Its separate-recording RMSE is .31638176 rad. The new original-coordinate gravity+bias+cosine model has a periodic-component phase −.12738715 rad and improves the training adequacy classification, but its separate-recording RMSE is worse: .31870011 rad. No alternative is promoted on that receiving error. These recordings were repeatedly used during development; this is exploratory reuse, not blind validation. Lower training residual does not establish a better predictive law or a physical angle correction.

The existing apparatus was chosen over a separate phase page because both source-grounded predictions belong on the same observation plot. The unchanged grid audit remains separate from the periodic comparison. Actual browser receiving is run by `scripts/periodic-phase-browser.mjs`; receiving status belongs to the integration receipt rather than being inferred from these native tests.
