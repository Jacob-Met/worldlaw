# Learn executable operator models from noisy states

Run the documented application with `npm start`. The maintained server accepts `POST /api/trajectory/operator-discovery` with JSON containing `training`, `selection`, optional `options`, and an optional finite `plans` menu. It performs numerical discovery in a bounded worker and returns a model compatible with the existing symbolic-evolution representation, separate selection diagnostics, and an optional proposed experiment.

Each recording has schema `worldlaw.state-trajectory/v1`, a distinct `id`, a `kind` of `oscillator` or `periodic`, and `samples`. A sample contains `time`, `state`, and `command`. Oscillator states contain position and rate, both observed state channels. Periodic states and commands are equal-length arrays, with positive `spacing` on the recording. Time grids are uniform. No acceleration or field-time-derivative labels are accepted. Known input histories are linearly interpolated during free forecasting.

The fitting recordings and the complete model-selection recordings must have different identities. Independently acquired recordings are required: different IDs alone cannot establish statistical independence. The caller retains a third, untouched test recording for final scoring. A forecast initializes from a local cubic fitted to its first eleven noisy samples and then evolves freely, without resetting from subsequent measured states.

## Numerical method

A declared, response-independent grammar contains polynomial products through degree three, sine/cosine/tanh/absolute-value atoms and their first interactions, positive-denominator rational atoms, and conservative first/second spatial derivatives of field-only expressions. The default grammar has 71 oscillator expressions and 60 periodic expressions. Supports have at most four weighted terms. These are bounded compositional searches, not unrestricted equation discovery.

The weak estimator multiplies state trajectories by compact polynomial test functions. Integration by parts replaces observed time derivatives with derivatives of the known test functions. For periodic conservative fluxes, exact adjoints of the central-difference stencils act on spatial test weights. The implemented discrete identity holds for arbitrary sampled arrays. It does not equate a finite difference of a nonlinear flux with a pointwise product through a continuum chain rule.

A common local cubic temporal denoiser is used by both weak and derivative comparators. For periodic fields, the same five-point linear observation filter is applied to the target and each complete right-hand-side feature, including command features. Nonlinear features are evaluated before that filter: H(f(u)), not f(H(u)). Selection and public forecasting use the same prefix initialization, without spatial smoothing. The primary sparse beam search and sequential-thresholded least squares use normalized, rank-aware QR fitting. The comparator also considers the conventional nested polynomial library, choosing on the same separate selection recording. Nonlinear feature bias from temporal denoising and noisy regressors remains possible; overlapping windows are not independent likelihood samples.

Returned models have `structuralIdentification: false`. A `predictive_candidate` passes a declared heuristic selection-residual screen: three estimated noise standard deviations plus three percent of signal RMS. This is not calibrated uncertainty, a unique equation certificate, or guaranteed out-of-grammar rejection. The complete benchmark reports the false predictive acceptances of this screen rather than treating the absence of a structural claim as a scientific success.

The optional experiment menu uses the existing observable-class rollout planner, with up to six ranked hypotheses and an explicit numerical comparison budget. Its noise resolution is an RMS estimate, not a probability. An inadmissible menu or unresolved candidates remain visible; no physical actuator is controlled.

## Verification and the frozen comparison

```sh
node --test tests/state-operator*.test.mjs
NULLGARDEN_SOURCE=/path/to/nullgarden node scripts/receive-state-operator-course.mjs
```

The producer must be Nullgarden commit `4af7717a866e0246e7c0bcd81977cea53cddbd8c`. Its independent midpoint simulator supplies twelve nonlinear ODE laws and eight periodic PDE laws at 40, 25 and 15 dB SNR. No evaluation trajectory has been used to tune the algorithm at the initial source freeze. The course is synthetic, and its family roster is public; withheld recordings and coefficient scales do not establish externally blind family discovery.

The comparison crosses weak beam search, weak STLSQ and denoised derivative STLSQ with active versus random acquisition. Each receives two fitting recordings, one selection recording and one extra experiment from the same three-plan menu. Random query indices are shared across estimators. Planning refusals use the preregistered first-menu fallback and consume the query. STLSQ evaluates twelve regularization/threshold choices in each of two nested libraries; the beam retains at most twenty-five candidates across support sizes. Selection uses no final-test errors.

Every method is scored on a different complete recording, initialized only by its observed prefix. The loss is state-vector relative L2 error against clean simulation reference, with a 1e-4 RMS denominator floor and a fixed cap/failure penalty of 10. Divergences and fitting failures remain in the attempted-run denominator. Time-permuted controls and four independently simulated omitted mechanisms are reported separately. The full course has 576 result rows: 360 genuine-law comparisons, 180 time-permutation controls and 36 omitted-mechanism comparisons. Two independent CPU shards each retain 288 rows.

Each artifact includes raw noisy observations, separate clean reference states, discovered models, free predictions, full failures and a summary. A completed integrity check means the registered course ran; it does not mean active acquisition beat random, the learned grammar was correct, or false acceptances vanished. Those outcomes must be read from the measured table.

Independent source review invalidated the first implementation at be964770 before any evaluation scores were used for tuning or promotion. It found inconsistent spatial observation operators, mismatched initialization between selection and public forecasts, and an epoch-scaled time check. Six separately authored counterexamples now guard those failures and masked undefined AST intermediates. Numerical results from that implementation are unqualified; the corrected source must complete its own frozen course. The source-distribution repair also includes the existing continuous-forecast-diameter protocol fixture without widening the release policy.

Method background: [Brunton, Proctor and Kutz (2016), sparse identification of nonlinear dynamics](https://doi.org/10.1073/pnas.1517384113), and [Messenger and Bortz (2021), Weak SINDy for partial differential equations](https://doi.org/10.1016/j.jcp.2021.110525). This implementation is a bounded product extension informed by those methods, not a reproduction of every algorithm or benchmark in either paper.

## Measured outcome

The [complete frozen result](STATE_OPERATOR_RESULTS.md) reports lower aggregate forecast error and a failed abstention screen. Weak beam active acquisition has mean error 0.055420590 versus 0.065704127 with random acquisition, but its periodic-field slice regresses and it accepts all 60 shuffled controls plus 6 of 12 omitted mechanisms. These observations do not qualify calibrated discovery. The independent Python recount verifies all 576 saved scores and nine malformed-result controls without importing the learner or production scorer.
