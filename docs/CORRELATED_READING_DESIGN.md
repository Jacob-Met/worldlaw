# Declared sensor memory in prospective reading design

Received through GitHub Actions `Worldlaw scientific verification` run `44574508172` on source `fe97826e024ac65e96a33263a158a711fa6a5690` (PR #641): 2/2 jobs green, 2317 test passes, zero failures, one existing skip; independent sampled-covariance oracle, launched product and real 1920×1080 / 390×844 browser, keyboard plan/acquire/export/reopen and changed-provenance refusal. These checks qualify a simulated instrument and browser experience, **not** an experimentally calibrated physical sensor. The original point-τ capability merged to main at 7e0305ccc570f5248189e65e7d06d6782dc8155d through PR #641.

Trajectory Challenge's existing noise-aware release planner accepts a sensor
memory time in seconds. Zero preserves the independent Gaussian planner. A
positive time declares the stationary covariance
`C[i,j] = sigma² exp(-abs(time[i]-time[j])/tau)` for measured post-initial
positions. The initial state remains externally controlled. The planner does
not infer the covariance from new readings or held-out observations.

Repeated nearby readings can contain much less information than the same
number of independent readings. Conversely, differences between highly
correlated readings can be informative. The planner scores a selected subset
by its worst model-pair Mahalanobis distance. Chronological Gaussian
innovations evaluate the exponential covariance without inverting a dense
matrix. A small-grid exhaustive search can certify the minimum cardinality;
larger-grid greedy results remain witnesses without a global-optimum claim.
The bounded search counts evaluated innovation terms and reports exhaustion
as unresolved, never as proof of an impossible measurement budget. A full-grid
covariance score provides a valid upper bound; independent top-k bounds are
not reused for correlated measurements.

The consumer path is the existing release proposal, two-step numerical
screen, selected-reading acquisition and portable experiment notebook. The
screen uses a covariance-norm triangle bound: replacing the old sqrt(k)
independent-noise factor is essential when adjacent errors are correlated.
The virtual instrument generates a stationary correlated error at the first
selected reading and subsequent conditional errors only when a selected
sensor timestamp is read. Unrequested positions never become observations.
The likelihood receiver requires the prospectively declared covariance to
match source provenance. Export/reopen must recompute that same protocol.

Two interface approaches were considered: a free-form covariance matrix
editor, and a sensor-memory instrument beside the existing noise and reading
budget controls. The latter directly connects temporal redundancy to the
existing predicted-motion experiment and keeps the covariance family explicit.
General covariance matrices, estimated sensor calibration, nonstationary
drift and physical acquisition remain outside this increment. Desktop and
narrow browser receiving is still required; this rationale is not visual
acceptance.

The fixed development controls compare innovation energy against independent
dense solves on irregular subsets, enumerate shared small-grid subsets,
reject equal-laws and unresolved covariance, preserve the zero-memory
instrument, and run the actual planner/screen/sparse receiver. A separately
preregistered course in
`experiments/correlated-intervention-comparison.mjs` freezes128 unfamiliar
authored ensembles and4096 paired realizations. Its independent dense-solve
receiver compares the covariance-aware schedule, maintained diagonal planner,
chronological and spread schedules under the same maximum reading budget.
Report counts, conditional accuracy, true-covariance separation and abstention
separately. No physical-law, sensor-calibration or confidence-coverage claim
follows from these controlled synthetic experiments.

## Frozen receiving findings (2026-11-19)

The held-out 128 originally authored ensembles and 4,096 paired Gaussian realizations used the same four-reading maximum; no sensor outcomes were available to the prospective planners. In 100 ensembles, the covariance-aware planner proved the target separation unreachable **even if all scheduled readings were observed**. It certified 24 separations without violating the independent true-covariance oracle; four additional ensembles exhausted the four-reading budget without certifying the target. The diagonal-independence incumbent claimed 16 separations, but 14 of those claims failed the true-covariance separation threshold. This makes false confidence, abstention and coverage the primary outcome, not just the accuracy of successful measurements.

Across its 28 actually measured ensembles, the covariance-aware planner produced 838/896 correct equal-prior classifications (93.53% conditional accuracy), mean 0.602 readings across **all** 128 ensembles. The diagonal incumbent produced 2983/4096 correct (72.83%) with mean 3.883 readings across all 128, spread produced 3223/4096 (78.69%) with four readings, chronological 2500/4096 (61.04%). **These aggregate accuracies are not matched-coverage comparisons.** Exploratory post-outcome stratification within the 24 certified, mutually measured ensembles yields 94.40% covariance-aware versus 85.29% diagonal and 95.18% spread; the covariance-aware selector used on average 2.542 readings there versus 3.5 diagonal and 4 spread. These post-hoc subsets are descriptive, not preregistered superiority claims. Frozen output is artifact `correlated-sensor-cold-44574508172` from Actions run `44574508172`.

The independently pinned Nullgarden consumer at commit `75527fb3934f65310b63d6ac9880394c5b98dc29` completed 64 exact within-pair label assignments across six prespecified matched pairs. The acquired opposed-sign design obtained AUC 1, exact p=0.03125 and leave-pair-out AUC 1; no-effect sham obtained exact p=0.9375 and constant negative p=1. Artifact `correlated-nullgarden-44574508172` preserves the source, CSVs, and full reports. All three are **authored** cohorts and do not establish measured real-world causal identification or sensor covariance calibration.

Native 1920×1080 and 390×844 screenshots in CI 44575883793 received the raised measurement labels, real predicted-motion chart, and source-locked sparse acquisition flow. These are browser accessibility checks, not physical calibration.


## Unknown stationary sensor-memory time in a declared closed interval

An additional **Uncertain memory upper τ** field permits the user to declare an unverified interval [τ_min, τ_max]. The preceding nominal sensor-memory τ becomes the interval's *lower bound* and the independent synthetic instrument uses exactly this nominal endpoint. Omitting the upper bound preserves the old point-memory planner unchanged; equal endpoints delegate exactly to the maintained point solver, including τ=0 independent Gaussian observations. A positive upper with lower zero means the virtual instrument is independent at its nominal endpoint, while the **prospective timestamps** must still separate the candidate laws for every τ in the declared range. No instrument measures or infers τ.

For ordered chosen times, write standardized pair difference \(d_i=(\mu_{a,i}-\mu_{b,i})/\sigma\), gap \(\Delta_i=t_i-t_{i-1}\), and adjacent correlation \(\rho_i(\tau)=\exp(-\Delta_i/\tau)\). Fixed-memory OU Mahalanobis separation is

\[
D^2(\tau)=d_1^2+\sum_{i=2}^{k}\frac{(d_i-\rho_i(\tau)d_{i-1})^2}{1-\rho_i(\tau)^2}.
\]

On any finite τ subinterval, each \(\rho_i\) is monotone. The minimum of each innovation as a function of its correlation lies at a range endpoint or at the interior stationary points \(\rho=d_i/d_{i-1}\) or \(\rho=d_{i-1}/d_i\), when defined and in range. Summing each separately minimized innovation conservatively *underestimates* the true minimum of their joint shared-τ total. Direct evaluation at endpoints and geometric midpoints provides authentic upper witnesses. Adaptive subdivision tightens these bounds with guarded double-precision arithmetic, using a strict positive threshold margin. A distinguishable declaration requires **every** candidate pair's lower bound to exceed the target; a failed full-grid pair at one explicit τ gives a valid impossibility witness for any selected subset of this finite schedule. These are independently tested numerical enclosures, **not formal real-number rounding proofs, sensor calibration, or identification of a true physical law**.

The bounded planner returns an explicit reading subset and its minimum pairwise lower-bound score. On a small enough grid, it can exclude every smaller subset using concrete within-interval counterexample τ values and certify minimum *finite-grid* reading cardinality. Incomplete subdivision, exhausted work, and unconstrained large-grid greedy plans never silently become global-optimality or impossibility claims. Existing RK4 coarse-versus-refined screening is retained; the variance-norm sensitivity guard evaluates the **largest declared τ** (the most adverse positive temporal correlation). Each eligible release must preserve its original interval, including when one selected reading happens to make the numeric covariance score insensitive to τ.

### Independent preregistered receiving and competing baseline decisions

F4 taskboard message **160666** fixed the evaluation before the new solver: exactly 96 unfamiliar authored ensembles from seed **0x6E502B71**, each with 9–12 irregular post-initial times, two–four executable predicted signals, sensor sigma in [.002,.05] radians, τ lower between zero and .5 seconds, τ upper no more than five seconds, target separation z=3.29, and at most four readings. The independent receiver performs a complete **dense Cholesky covariance solve** at 513 uniform and 32 separately seeded off-grid τ values per law pair; it does not call the candidate's chronological innovation routine. In 36 ensembles the robust planner certified an allowed schedule with **zero false positive certificates** under the independent receiver. For the other 60 ensembles, at least one model pair has an actual under-threshold τ witness even when *all* scheduled readings are measured. These are decisions about authored virtual laws, not a calibrated experiment.

Source **30ebbdd6fcf3d732980e897c814900fe992773c5**, GitHub Actions CI **44582238284**, independently received the complete 96-case comparison alongside real browser controls. All methods saw identical signals, intervals, target and four-reading ceiling:

| Prospective selection rule | Claimed separations / 96 | Falsely robust claims | Mean readings across *all* 96 | Mean readings among claimed |
|---|---:|---:|---:|---:|
| Unknown-τ robust interval | 36 | **0** | 0.479 | 1.278 |
| Midpoint point-τ model | 42 | **11** | 0.656 | 1.405 |
| IID diagonal-noise model | 53 | **21** | 2.781 | 1.792 |

Abstaining cases contribute **zero** to the mean across all 96; these are *not matched-coverage accuracy claims*. Within the same 36 cases where the robust method certifies, it remains robust in 36, versus 31 for midpoint (five false confidence claims) and 32 for IID (four false). Mean reading counts on those same 36 are 1.278 robust, 1.222 midpoint and 1.167 IID: the shorter comparator schedules are invalid for some allowed τ values. The incidence of false declarations is the scientifically relevant difference; no claim of improved downstream real-world law accuracy follows.

### Cold product and negative-control receiver

The original Worldlaw Studio remains one cohesive experience: same finite-law predictions and physical release, new uncertainty interval in its sensor instrument controls, bounded covariance plan, two-step numerical screen, selected-only virtual sensor acquisition, portable notebook export, and source-only recomputed reopen. The independent virtual instrument records the **nominal/lower τ**, not an estimated physical τ. Its sparse receiver's equal-prior likelihoods condition on that particular simulated value; they **do not marginalize over the uncertain interval**. Both the visible Studio and machine result say this explicitly. Changing the interval on an acquired notebook is refused even if a one-reading score would be numerically identical.

Full receiving in run **44582238284**: 2323 component tests passed, zero failed, one inherited skipped; 2/2 CI jobs succeeded. Real 1920×1080 and 390×844 Chrome exercised keyboard planning, actual selected-read acquisition, export/reload, forged nominal covariance refusal, forged upper-bound refusal, and native screenshots, with no externally fetched UI dependencies. Artifacts include **correlated-sensor-cold-44582238284** with the untouched 96-case JSON, source-bound portable notebook and both viewport images; the independently pinned Nullgarden 64-permutation receiving remained green in **correlated-nullgarden-44582238284**. The confirmed limits are an authored stationary Gaussian simulator, numerical rather than formal interval arithmetic, and a declared finite law shortlist. Unmeasured sensor drift, correlated *model error* mistaken for measurement error, uncertain sigma, hardware source custody and true physical causal identification remain open problems; none is passed off as qualified.

Implementation: **src/trajectory/bounded-correlated-discriminator.mjs**, **tests/trajectory-bounded-correlated.test.mjs**, **tests/trajectory-bounded-session.test.mjs**, **experiments/bounded-ou-comparison.mjs** and the existing planner, numerical qualification, sparse receiver, virtual instrument, UI and real Chrome acceptance harness in [PR #642](https://github.com/Jacob-Met/worldlaw/pull/642). Merge provenance must name the verified final head and CI, not infer authority from a staged branch.


## Physical covariance identification boundary

The [MAGF-ID physical receiving course](PHYSICAL_SENSOR_COVARIANCE.md) tests the
missing calibration premise on 17 real four-gyroscope recordings with a frozen
9/4/4 split. White-plus-OU predicts unseen contrast covariances better than IID
and single OU, yet every simultaneous covariance qualification fails. Identical
colored error added to all sensors cancels in every contrast. These measured
findings keep `absolute_sensor_calibration` and `planner_input_eligible` false;
no fitted angular-rate parameter is imported into this synthetic position
instrument. The complete source receiver, negative controls and exact external
Nullgarden receiving path are documented with their failures.
