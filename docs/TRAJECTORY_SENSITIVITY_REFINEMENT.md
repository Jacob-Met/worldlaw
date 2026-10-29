# Optional trajectory-sensitivity refinement

In the maintained Trajectory Challenge, load an angular source and choose **Compare trajectory-sensitivity refinement**. The optional investigation retains the full-six predictive comparison and its existing coordinate refinement. Its output never adopts a new law into the parent investigation.

The default action explicitly offers the rate + sine-position family, bounds rate coefficients to [-5, 1] per second and sine coefficients to [-100, -1] rad/s², and runs eight damped Gauss–Newton iterations. A source-only notebook may declare other supported smooth families and bounds. These are caller assumptions, not estimated physical parameter intervals.

The fitter uses central finite differences of complete original-course predictions to form a trajectory residual Jacobian. The maintained normalized QR solver solves the negative-residual linear problem with diagonal damping rows scaled by column norms. At most four damping attempts are made per iteration. The complete maximum evaluation count, integration steps and prediction rows are reserved before fitting. All first samples, initial rates, timestamps and original positions remain unchanged. Failed or numerically unresolved perturbations cannot define a Jacobian; an incomplete candidate cannot replace the incumbent.

The numerical screen is a maximum-absolute difference between coarse and half-step trajectories, fixed at 0.001 rad in the default action. This is not a convergence proof. Smooth terms only are supported; Coulomb and quadratic-rate terms are refused by this optional mechanism. Parameter boxes, finite-difference step size and damping are bounded local-search choices, not evidence of global optimality.

## Measured comparison and limitations

Both original PASCO training courses retain 2,001 rows. With the declared settings, the smooth seed has training RMSE 0.099908 rad and reused-challenge RMSE 0.091503 rad. Under matched 65-maximum-evaluation reservations, the maintained 16-sweep coordinate search reaches training 0.047835 rad and challenge 0.068781 rad; the new eight-iteration fit reaches training 0.036796 rad and challenge 0.048113 rad. It uses 43 actual trials, with a complete reservation of 607,360 integration steps and 260,130 prediction rows.

The ordinary full-six predictive consumer is independently retained. Its eight-sweep maintained refinement has challenge RMSE 0.061483 rad in this configured comparison; the original weak leader remains visible at 0.760077 rad. These comparison choices and every numerical receipt remain inspectable. This is exploratory work on a reused measured challenge, not newly independent measured validation.

An independent analytic damped-oscillator control recovers its coefficients. A separate apparatus-change control deliberately makes the original seed correct for the new apparatus: the training-refined model then has worse held-out error despite improved training fit. The negative remains a native control. Original Giessler and bounded-start non-gain results are unchanged.

## Source and execution custody

The versioned `worldlaw.trajectory-lm-inputs/v1` notebook saves the original bundle, declared family, fit settings and refinement settings. Reopening recomputes; cached refined models are ignored. Training fitting receives only training runs. New challenge predictions are separately reserved and evaluated after the coefficients are frozen, without selecting or changing them. Budgets are explicit per stage; no single combined whole-session cap is claimed.

A refused optional refinement retains the completed original consumer result. Parent source intent immediately retires child computations and disables intake. Frame and File.text completions check the current generation before computing or adopting a result. There is no parent-law apply action.

## Receiving

Six actual native core/session tests pass. Served and standalone browser courses each exercise the full measured comparison, actual source download/reopen, forged cached result, narrow layout, busy intake, a held file read superseded by parent refit, and optional-budget refusal retaining the original. Linux browser admission uses the maintained sandbox helper with namespace and seccomp enabled. See `docs/receipts/trajectory-lm` for exact receipts and build hashes. UI inspection retained an original-observation / maintained-refinement / new-refinement trajectory overlay, with distinct source and prediction labels.

## Newly held-back measured condition: negative transfer

Before acquiring any new course values, the method, four executable models, original training-source hash, implementation hashes, evaluation settings, target filename and adaptation rule were frozen in `recovery/held-condition/frozen-method.json` (SHA256 `93bfb8ec0f2d7853c24bbb1f105b6d94e52313957038ebf809fb299235ea9c01`). The predeclared target was `raw_data/len1_cond2_1.csv` at original dataset revision `cbf82673641ecd65e902ad5c38a048387649a2a0`. No target replacement based on error was permitted.

The original author README identifies condition 2 as air plus a small paper baffle, at the same 0.236 m length; training used air-only condition 1. The original CSV is 317,192 bytes, Git blob `795d0b31b09f1ba03d3182081938118e31727145`, SHA256 `66fbcd1cf50c3778e836a2479319e4f3192548a8989f7e1b398cb21ee1be7082`. Exact original bytes, README and Apache 2.0 license are retained. The existing fixed 5–25 second adaptation keeps 2,001 original rows and the first selected sensor angular velocity; no smoothing, interpolation, recentering or inferred challenge state is introduced.

| Frozen alternative | New-condition RMSE / rad | Maximum coarse/fine difference / rad |
| --- | ---: | ---: |
| Original full-six weak leader | 0.642466 | 0.0991054 — unresolved |
| Full-six predictive selection | 0.0481452 | 0.000002094 — screened |
| Maintained coordinate refinement | **0.0359673** | 0.000001999 — screened |
| New trajectory-sensitivity refinement | 0.0678674 | 0.000002103 — screened |

The complete four-model forward reservation is 18,688 integration steps and 8,004 prediction rows. The evaluator imports no fitting module. The new fitter loses to both screened incumbents on this newly held-back changed condition. No bounds, coefficients, method settings or thresholds were tuned after this result. It is new held-back evidence relative to this worker's method development, not independently administered blind validation or authenticated acquisition independence. Changed damping is a substantive transfer test, not a claim that the physical mechanism was unchanged.

The ordinary source-only consumer replays this new-condition notebook with bit-identical frozen fitted coefficients and the same error. Both served and offline browser courses display the loss, retain the original weak model's numerical-unresolved status, and download the exact original source identity. This negative narrows the earlier reused-challenge improvement claim.
