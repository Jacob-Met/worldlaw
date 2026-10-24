# Periodic sensor-artifact susceptibility

UNKNOWN LAB accepts `worldlaw.serial-orders/v2` alongside unchanged v1 noise-only inputs. Version 2 adds `periodic: {sourceNote, periods}`. The source note declares why these hypothetical periods are offered; it does not authenticate frequency calibration. Open examples/periodic-orders.json in the existing acquisition-order instrument. Earlier v1 readers reject v2 rather than silently ignoring its periodic modality.

For the maintained signed counterbalanced reading weights w, an additive artifact A sin(2πk/P+φ) contributes A times [C sinφ + S cosφ], with C=sum(w cos(2πk/P)) and S=sum(w sin(2πk/P)). Its maximum absolute contrast over arbitrary phase is |A| hypot(C,S). The displayed dimensionless gain uses unit amplitude; no amplitude or phase is estimated. Shift all indices by a common origin without changing this maximum. Actual gaps remain preserved.

The implementation evaluates each supplied plan and period, keeping noise variance and artifact gain in separate quantities. Noise minimax and dominance labels refer only to noise. There is no scalar combined score or assertion that a low-noise schedule resists artifacts. Exact same finite reading-count budget is retained; it does not establish equal elapsed cost.

The authored mask85 schedule has period4 gain sqrt(2), while mask90 has near cancellation and the same worst noise variance over the offered rho course. At period4.2, mask90's gain is about .395381709. A canceled offered harmonic therefore does not imply cancellation between periods, for changing frequencies, or under carryover and nonstationary effects. Period1 gives constant sampled phase, canceled by zero-sum contrast weights.

Admit 1–16 distinct finite periods from1 through1000000 acquisition-index steps, and acquisition span at most1000000 steps for periodic evaluation. The existing complete covariance budget remains active. Index-origin subtraction and modular phase reduction reduce argument size. Floating-point trigonometry is not a rigorous enclosure; gain<=1e-10 is labeled near cancellation, never certified zero. Period bounds and index gaps are caller declarations, not a physical clock.

Tests compare analytic controls with an independent direct8192phase sweep, changed period, constant-phase cancellation, large common index shifts, v1 exact parity, old-reader refusal, input replay and malformed/sparse/bounded input refusal. Actual browser receiving and full latest-main regression remain pending.
