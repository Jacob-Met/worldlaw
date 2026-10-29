# Frozen joint-channel test on an unused measured repetition

The joint-channel method was tested on a nominal setup not previously used in this method's development: author length2 (0.330m), air only in EnzeXu/Damped_Pendulum_Dataset, immutable revision cbf82673641ecd65e902ad5c38a048387649a2a0. Repetitions1 and2 trained; repetition3 was acquired only after all models were fitted and frozen. Author metadata describes three repetitions per length/damping combination. Same nominal setup is not proof of unchanged physical parameters, and this was not externally administered blind validation.

## Before acquisition

Protocol SHA256063cfaf3f09b4bf295cb36daece4a5560c5c1a54d79b6817c5d9c7220ba4455c fixed the files, original5–25s inclusive window, rate+gravity family, original supplied initial rate, no preprocessing, position/rate scales0.1rad/0.1rad/s, three fitting iterations, coefficient bounds[-5,1]/[-100,-1], maximum step0.02s and both maximum numerical screens0.001 in their respective units. Three iterations respect complete doubled-residual work rather than changing the cap. The full-six predictive and maintained coordinate-refinement incumbents retained their usual comparisons. There was no result-based replacement or retuning.

All model coefficients were frozen at20:11:58UTC on2026-10-28 (file SHA256aad0f3389690e4cb3c559d6e15c1dc1d6628eeec50725729a02a270259e05816). Original repetition3 was acquired at20:13:01UTC,319364bytes, SHA256fedd381f9f7534fe639d1085fe7ae0b56637e01b8a5e191b07c89b821ddb9c06. Original bytes, acquisition URLs/checksums, complete protocol, adapter and evaluation code are retained under recovery/joint-measured. The source is Apache2.0; original repository README/license are already retained in recovery/held-condition.

## Held third-repetition outcome

| Frozen model | Position RMSE/rad | Supplied rate RMSE/rad/s | Both numerical screens |
| --- | ---: | ---: | --- |
| Weak full-six | 0.04583605 | 0.26314296 | Passed |
| Predictive full-six | 0.02410619 | 0.16241510 | Passed |
| Maintained coordinate refinement | **0.02341895** | **0.15704114** | Passed |
| Position-only sensitivity | 0.02396263 | 0.15961447 | Passed |
| Joint position/rate | 0.02410164 | 0.16017737 | Passed |

The joint fit is slightly worse than both the maintained refinement and position-only sensitivity fit on both observed channels. It supplies no demonstrated measured advantage over those stronger incumbents. The small differences should not be interpreted as a statistically established ranking: no sampling distribution or calibrated measurement-error model was supplied. Joint maximum position and rate resolution differences are7.38e−7rad and3.99e−6rad/s, so this adverse comparison is not a numerical-screen refusal.

Each added three-iteration training fit reserved233600integration steps and100050forecast rows; the joint objective used200100residual components. The complete five-model held comparison reserved23360steps and10005forecast rows. The ordinary source-only consumer recomputed exactly the frozen position-only and joint coefficient vectors, then reproduced the same held score. Actual browser import/download retains the held raw-file hash. No channel-independence or equal-input accuracy claim is made.

This experiment retains the authored angle-artifact benefit, biased-rate loss, older small-baffle transfer loss, and prefix-calibration failure. It does not tune a replacement method against this now-consumed third repetition. Future claims of an independently held course need new original data and a new prior freeze.
