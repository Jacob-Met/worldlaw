# Declared sensor memory in prospective reading design

Candidate integration; full release receiving is outstanding.

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
