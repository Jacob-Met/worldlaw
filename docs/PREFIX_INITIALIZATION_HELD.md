# Prefix initialization on a previously unused measured setup

The original author describes three repetitions for each nominal length/damping combination. All three length2 air-only courses had already been consumed. This test therefore used the previously unused length3 (0.426m), air-only setup, training shared laws on repetitions1/2 and receiving repetition3.

Before acquiring any new course, frozen-protocol.json fixed the original5–25s window, no smoothing/recentering/resampling, first1s receiving prefix, ±0.1rad/±0.5rad/s computational start bounds,9×9 grid plus8local sweeps, .02s solver step, .001 position and rate numerical screens, complete4M-step cap, fixed five-law order and primary metric. The primary comparison was the training-selected predictive law's suffix position RMSE with observed initialization versus prefix-estimated model initialization. Other laws were retained; no receiving winner was selected.

Protocol SHA256:133587e55bf60bb920304c5f480a2c62a10ed90cd23eef71f77b2bd63868c283. Shared coefficients froze at2026-10-28T20:51:10.908Z (model file SHA256e8031684b1d4eb2bab7285443cab9123636cf00f22aa8cf86582875ad89876c3). Third repetition was acquired at20:51:25.472323Z, exact raw SHA25614efc743342fe152cafa1ccb12243dde14fdafe177445d68f0a6112cff8b12fb. Author source is EnzeXu/Damped_Pendulum_Dataset, immutable cbf82673641ecd65e902ad5c38a048387649a2a0, Apache-2.0; original acquisition and adaptation receipts retain bytes, selected columns, timestamps and row identities.

| Frozen law | Observed-start suffix RMSE/rad | Prefix-estimated suffix RMSE/rad | Both numerical screens |
|---|---:|---:|---|
| Primary predictive-selected |0.07768332|0.01200673|pass|
| Maintained coordinate refinement |0.07274649|0.01492957|pass|
| Position-only sensitivity |0.07376498|0.01574136|pass|
| Joint position/rate |0.07399648|0.01545716|pass|
| Weak selected |0.30150063|0.28352175|both unresolved|

The receiving prefix consists of101original rows from5–6s; the1900later rows through25s only score the forecast. The original first position remains an observation in fitting and output. Estimated initial states are model parameters, not measurements or calibrated corrections. The forecast starts at original5s and never resets at6s.

This is one predeclared measured receiving course with a new nominal setup, not externally administered blind validation or a statistical population claim. Initialization can absorb model errors. No sensor cause, global optimum, measurement uncertainty or correct physical law is identified. Weak-law numerical refusal and earlier consumed-course losses remain explicit. Ordinary source-only session replay reproduced the frozen coefficients and all forecasts exactly; saved derived results are ignored.
