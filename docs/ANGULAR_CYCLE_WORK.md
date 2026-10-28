# Cycle-work investigation

The existing angular trajectory workbench offers a declared cycle-work investigation. Load angular observations, choose a restoring-only model, and select **Compare cycle-work laws**. The selected law stays frozen. Complete training cycles fit three nonnegative dissipative families; the restoring-only baseline and every admitted family execute on the supplied receiving recordings. Receiving performance never selects a family or replaces the main discovery selection.

For the included known PASCO source, load **Measured** and apply the maintained **Window / weak** fitting method first. A selected law already containing drag refuses explicitly; this instrument never silently removes drag or refits restoring terms. It preserves the separate structure-selection and shared-condition scopes.

## Observation and fitting contract

Supported restoring terms are gravity, spring, bias and cubic. For angular acceleration `a*sin(q) + b*q + c + d*q³`, normalized potential is `a*cos(q) - b*q²/2 - c*q - d*q⁴/4`. Physical inertia stays unknown; normalized potential and loss are not calibrated joules.

Declare an upward-crossing angle and an odd centered derivative window of5–31 samples. Between consecutive upward crossings, the highest sampled position marks a peak. A contiguous maximum plateau uses its middle sample (earlier for even width) and retains its full index interval. Separated equal maxima refuse the endpoint. No interpolation claim is made about the true continuous turning time.

Complete cycles join consecutive such peaks. Prefix/suffix coverage and every admitted/refused complete pair remain visible. Missing centered windows, undersampling relative to the derivative window, ambiguous peaks and nonfinite work refuse. At least three admitted cycles are required for fitting. Rates reuse the maintained local cubic derivative.

Observed loss includes estimated endpoint kinetic change:

`loss = V(q_start) - V(q_end) + (rate_start² - rate_end²)/2`.

This avoids pretending that sampled maxima have exactly zero velocity. The viscous feature is trapezoidal integrated squared rate; the Coulomb feature is discrete total angular travel. Sensor noise, aliasing, peak selection, derivative smoothing and quadrature can bias these estimates. Adjacent cycles share observations and are not independent replicates.

Viscous, Coulomb and joint families remain in a fixed order. The maintained column-normalized QR solver evaluates every feasible nonnegative active set, including zero. Negative unconstrained coefficients remain disclosed. A constrained boundary is labeled as a simpler active solution, not evidence identifying both effects. Rank deficiency refuses; normalized QR pivot ratio above1000 refuses the corresponding family. This ratio is a numerical diagnostic, not a spectral condition number or calibrated uncertainty bound.

Positive loss magnitudes become negative `rate`/`coulomb` acceleration terms in the maintained executable model. Existing angular rollout and two-resolution comparison supply all dynamics. The full coarse-plus-refined model/run step population is reserved before execution. Insufficient budget refuses the whole receiving population; every numerical failure remains visible. Resolution agreement does not prove physical correctness, especially across Coulomb sign changes.

## Consumer and replay

Two visual concepts were compared: phase-space loop area and a paired work/trajectory instrument. The paired instrument was chosen because the measured quantities here are cycle losses and angular trajectories; a loop-area composition could imply an independent force measurement that is absent. The upper trace compares training-cycle losses with all fitted candidates. The lower trace shows actual receiving motion against every executable law. The joint boundary trace remains dashed when coincident with a simpler family. Tables disclose both objectives without a winner badge; coverage and every refusal remain inspectable.

Changing the main workbench model/source or a declaration clears stale results and export. An input notebook contains the source bundle, frozen restoring law and declarations, not trusted conclusions. Reopening recomputes the investigation and shows its source label and law identity. It remains local to this instrument; the next main workbench selection clears it. New drafts invalidate delayed notebook reads.

## Reused physical evidence

Run `node experiments/cycle-work.mjs`. Existing PASCO training recordings1/2 produce35 admitted cycle pairs with nine-sample derivatives and zero-radian crossing. Compared with the earlier research probe, production uses an explicit plateau midpoint and endpoint kinetic correction.

| Candidate | Training work RMSE | Receiving angle RMSE (rad) | Qualification |
|---|---:|---:|---|
| Restoring only | — | 0.322969 | Frozen baseline |
| Viscous | 0.0591425 | 0.0817604 | Nonnegative single-family fit |
| Coulomb | 0.0704632 | 0.0616503 | Nonnegative single-family fit |
| Joint | 0.0591425 | 0.0817604 | Viscous boundary; unconstrained Coulomb negative |

Training work favors viscous while receiving trajectory favors Coulomb. Both remain visible. All recordings, including receiving, were previously used in development. This is exploratory evidence, not blind validation, identification of friction, or transfer to another mechanism.

## Verification

`node --test tests/angular-cycle-work.test.mjs` checks analytic viscous/Coulomb/conservative motion, quantized peaks, refusal accounting, input/unit rejection, training isolation, exact notebook replay, full step reservation and physical disagreement retention.

`node scripts/angular-cycle-work-browser.mjs <repository-root> <fresh-output-directory>` receives the actual original torque journey, measured keyboard comparison, downloaded notebook/reopen, declaration and source invalidation, delayed reads, desktop/narrow layout and network/exception boundaries. Screenshots require independent visual review; a prepared receiver is not browser qualification.

## Optional quadratic speed loss

Enable **Also compare quadratic speed loss** in the same cycle-work instrument to retain a fourth, separately fitted family. It uses the original accepted cycles and the same centered local-rate estimates. For a declared acceleration term `−c ω|ω|`, normalized lost work is `c ∫|ω|³ dt`; the implementation applies trapezoidal quadrature to those estimated rate magnitudes. The coefficient is constrained nonnegative and has units `1/rad`. The frozen restoring model is unchanged. Viscous, Coulomb and their joint family retain their original fitting population and objectives; the added family does not automatically replace them or select a receiving winner.

The fourth law executes through the maintained angular solver and two-resolution receiver. Complete-population reservation includes its additional work, so the previous budget may now refuse every receiving prediction. Coarse rate estimates, noise, missed reversals and cubic amplification of estimated rate can bias quadratic work; no physical cause or calibrated uncertainty follows from a smaller residual.

Default inputs remain `worldlaw.cycle-work-inputs/v1`. Explicit quadratic admission exports v2 and is restored on reopen. A v1 notebook carrying quadratic admission refuses rather than silently omitting the new family. Export retains original source, frozen law and declarations only. Editing the admission clears stale results.

The focused authored controls are `node --test tests/angular-cycle-work-quadratic.test.mjs`: an independent fine-step oscillator with quadratic acceleration, held-out-value noninterference, whole-population refusal, v2 replay and retained measured PASCO comparison. These commands specify intended verification; executed values and browser receiving belong in the actual release receipt.

If cubic-rate work exceeds numerical range on any original admitted cycle, that feature is retained as unavailable and the entire quadratic family refuses; original cycles and three existing families remain intact.

## Optional simultaneous viscous and quadratic loss

**Also combine viscous + quadratic loss** explicitly admits one additional law with two nonnegative dissipative coefficients. It includes the standalone quadratic comparison. The fit uses the same complete original admitted cycles and the existing work features `∫ω²dt` and `∫|ω|³dt`, giving the conditional loss equation `loss = c_v ∫ω²dt + c_q ∫|ω|³dt`. Its executable acceleration adds `−c_v ω − c_q ω|ω|` to the frozen restoring law. Coefficient units remain `1/s` and `1/rad`; no physical inertia or energy calibration is introduced.

The maintained normalized QR fit and complete nonnegative active-set search compare the two-term solution, either single-term boundary and zero. Rank deficiency or the existing pivot-ratio limit refuses the mixed family. A boundary is explicitly a simpler active law, not evidence that two effects have been separately identified. Repeating effectively the same amplitude/speed profile can leave the two work columns inseparable. A small residual does not certify the restoring law, derivative estimate or physical mechanism.

The original three families and optional quadratic family remain unchanged. If cubic work is unavailable on any original admitted cycle, both dependent families refuse without discarding that cycle or changing the original families. All admitted laws enter the complete receiving-step reservation; no law wins by dropping failed receiving runs or inspecting challenge error.

Mixed admission exports `worldlaw.cycle-work-inputs/v3`, with both quadratic and mixed options explicit. Prior v1/v2 notebooks remain supported and restore their original offered populations. Changing admission invalidates the displayed comparison and export. Source-only reopen recomputes every coefficient and forecast.

Run `node --test tests/angular-cycle-work-mixed.test.mjs` for independent sampled-position mixed damping, zero-component/zero-solution boundaries, repeated-amplitude rank refusal, cubic-overflow preservation, complete receiving limits and source replay. Actual executed numbers and consumer qualification belong in the release receipt; retained PASCO challenge data are exploratory reused evidence.

### Executed mixed-law receiving

On the authorized Node 22.23.4 receiving host, the five focused mixed-law groups passed. Independently integrated motion with viscous coefficient 0.04 and quadratic coefficient 0.08, supplied only as sampled positions, recovered 0.0400000255912227 and 0.0800000115621537. Work RMSE was 1.9232452326106085e-8; separate-start receiving position RMSE was 3.4171187153167445e-8 rad. Repeating the same amplitude profile refused the two-column family. These are authored numerical controls.

The retained PASCO runs supplied 35 admitted cycles. Mixed coefficients were 0.008668878313165955 1/s and 0.0024797592895214574 1/rad, with normalized QR pivot ratio 9.970767601877842 and work RMSE 0.05738338835623262. Later-motion RMSE was 0.08980568925553244 rad: below quadratic-only 0.09462658250386549, but above viscous 0.08176042580434437 and Coulomb 0.06165031295966927. These reused recordings are exploratory evidence; no receiving winner is selected.

The initial mixed candidate passed 859 native tests and one existing skip. After composing the independently owned saturated-probe change from main `222b821ccbec62ae77898c812a9e4f1a0eb00800`, the integrated source passed 864 native tests, one existing skip, and both maintained smokes; all 602 included source, test, and guide blobs matched their canonical Git objects. The additive `scripts/angular-cycle-work-mixed-browser.mjs` passed 11 sandboxed Chrome receiving groups, including actual v3/v2/v1 downloads and reopening, admission dependency, source replacement, stale input, budget refusal, keyboard and narrow views. Existing source and independent review details are retained in the native #206 delivery record and its pull request.

## Inspect observed receiving half-cycles

A complete-cycle work fit can hide opposite errors within that cycle. After the original comparison, **Inspect receiving half-cycles** evaluates the separately supplied receiving positions under the same frozen training laws. It adds an observed angle-versus-time trace and a signed ledger, while preserving the original comparison, its forward-rollout refusals, every offered law, and its v1/v2/v3 source export.

Each original maximum-to-maximum receiving cycle is partitioned at its contiguous interior global minimum; an even-width minimum plateau uses its earlier middle sample. Both halves must span at least the declared `windowSize` adjacent sample intervals (`windowSize + 1` inclusive samples). Separated equal minima or inadequate support refuse that partition. A refusal keeps the original complete cycle and its source trace; it does not select a different minimum or omit an unfavorable cycle.

Observed half-cycle loss is the frozen potential difference plus the endpoint kinetic correction, `V(q_start) - V(q_end) + (rate_start^2 - rate_end^2)/2`. Rates reuse the maintained centered local cubic fit. Predicted loss uses the already fitted nonnegative dissipative coefficients and the same squared-rate, absolute-travel and optional cubed-rate features. The signed residual is observed loss minus predicted loss. The two residuals, their sum, and observed endpoint closure remain explicit. All values use normalized units; they are not calibrated joules.

The added diagnostic pass has shared limits of 8,192 rate-window evaluations and 8,192 integration intervals. Its counters exclude the original bounded replay and extraction passes. Nonfinite results and exhausted support produce refusals; unavailable cubic work only refuses dependent laws. Observed-half support remains separate from the original forward-solver budget.

The source-only wrapper `worldlaw.cycle-work-halves/v1` contains the original cycle-work notebook. Reopening recomputes the original investigation and the diagnostic; supplied derived results cannot replace either calculation. Source or declaration changes retire the diagnostic and its export, including pending file reads.

Opposing residuals are correlated because the halves share their measured minimum and derivative windows. The display is a diagnostic of a declared explanation, not independent replication, a calibrated rejection threshold, or an identified missing force. Endpoint selection, sampled derivatives, reference error, quadrature and the frozen restoring law remain possible contributors. Receiving data never refit or select a law.

See [Observed receiving half-cycle work](CYCLE_WORK_HALVES.md) for the control cases, retained measured disagreement, current executed receiving evidence and reproduction commands.
