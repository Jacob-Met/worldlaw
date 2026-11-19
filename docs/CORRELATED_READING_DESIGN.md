# Declared sensor memory in prospective reading design

Received through GitHub Actions `Worldlaw scientific verification` run `44574508172` on source `fe97826e024ac65e96a33263a158a711fa6a5690` (PR #641): 2/2 jobs green, 2317 test passes, zero failures, one existing skip; independent sampled-covariance oracle, launched product and real 1920×1080 / 390×844 browser, keyboard plan/acquire/export/reopen and changed-provenance refusal. These checks qualify a simulated instrument and browser experience, **not** an experimentally calibrated physical sensor. The product release to `main` is gated on merging that PR.

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

Cold visual review identified inherited sub-11px measurement labels and legends as the main remaining accessibility defect on narrow screens; this update raises the shared experiment panel typography and control touch sizes for both desktop and mobile. Recheck the changed native screenshots in the next CI course before promoting that visual acceptance.
