# InTaSet: original quadruple-tank transfer — a real measured falsification

**Empirical outcome: the predeclared transferable physical-law criterion FAILED.** This experiment expands WORLDLAW from an unobserved two-tank state to a physical apparatus with **four simultaneously measured tank channels, two recorded pump commands, and distinct author-supplied M1/M2 training/testing workbooks**. It did **not** verify a physically transferable law. The source-authentic numerical result and entire discarded candidate search are retained; no original test result is used for new coefficient or candidate selection.

## Source, chronological roles, independently frozen evidence

Original source is Putri, Villacrés, Raza, Iwakin and Moazeni, InTaSet, DOI [10.5281/zenodo.17652851](https://doi.org/10.5281/zenodo.17652851), EWRI-2026 publication DOI 10.1061/9780784486931.058; original author GitHub Moazeni-s-Concise-Lab/InTaSet, **CC BY 4.0** confirmed by the Zenodo REST rights metadata. Exactly 6,107,043-byte InTaSet.zip, Zenodo MD5 **0fe80940a3c9520e665b769f4b8d5ab8**, source SHA-256 **a0aac3b0985bec232afa8f9e95cd87612515904f5e574bc483777e4d532e8c85**. Original source remains outside the repo; only hashes and derived scientific observations enter this document.

**Scientific preregistration BEFORE any original numerical XLSX cell was read:** HAMON t-mwn7gi0jrr9e post **156855**, committed [full frozen protocol](INTASET_QUADRUPLE_PREREG.md), plus two independent source-only CI inspections (source filenames and Excel first-row **string labels only**, no numerical observations): [Actions 44477228204](https://github.com/Jacob-Met/worldlaw/actions/runs/44477228204), [44477527045](https://github.com/Jacob-Met/worldlaw/actions/runs/44477527045).

For each original 4T mode, the ORIGINAL Training file is split chronologically into a 70%-fit prefix and 30%-development suffix. The numeric original Test file remains **unopened during fitting**; source and candidate hashes and selected model parameters are frozen on disk. A SECOND process checks source and code hashes then independently loads original M1 and M2 Test workbooks; every model sees the source-observed first 64 four-tank sensor readings for initialization, all later pump commands, and **none of the later measured sensor levels as recursive prediction inputs**.

| Original source | Fit valid rows | Development rows | Separate original Test valid rows | Scored after initial 64 |
| --- | ---: | ---: | ---: | ---: |
| Mode 4T-M1 | 14,540 | 6,232 | 3,000 | 2,936 |
| Mode 4T-M2 | 14,699 | 6,301 | 3,000 | 2,936 |

Actual clock interval was independently checked **0.1 seconds** in both original trains and tests. Each train has one contiguous valid segment and no invalid rows. Original M1 Test workbook has 3,113 worksheet rows after its header, including 113 nonnumeric rows excluded; all retained 3,000 measurements are consecutive, and the same original data import does not interpolate or invent readings. Original M2 Test has exactly 3,000 consecutive valid records. All four sensors (Tank1...Tank4) and both pumps (Pump1/Pump2) are original sensor/actuator spreadsheet fields. Source M1 Training A1 is unlabeled, so one original first row is consistently treated as header and discarded, rather than changing the channel alignment.

Distinct original author workbook identities:
- M1 Training SHA-256 **3db6894c66664f2d2b1db01054ba8e94d3bf1dea5849f41134fc17942da46fc2**; M1 Test SHA-256 **df3be7464e53d57a9d3d5fcf19fcf2d9a41e8d0676dc88bf30661fb867a0b0f4**.
- M2 Training SHA-256 **03152fb436bb5853c6f4afce4fe801553c97cfee43e4d9afa96775bc032d084a**; M2 Test SHA-256 **8b2ba05b0979a590bbf61bb2e94bb22a52ac381323d18790f7ba507ae70c980b**.

There are **two recorded configurations of one physical apparatus**, NOT two independently constructed experiments or a verified new pump/water topology. No information beyond the authored sensor labels licenses interpretation of the sensor values as calibrated water height in meters.

## Decisive prospective heldout scores — source-observed four-tank channels

All values are **four-channel macro normalized RMSE**: for each tank its 2,936 autonomously predicted future measurements' native RMSE divided by that target-mode's original **training-only** sensor standard deviation (floor max[1e-6, 5% training range]), then mean over Tank1–Tank4. Lower is better. Source and target columns name the *frozen model's fit mode* and *separately measured test workbook*.

| Frozen model fit → original Test | Persistence | Strong development-selected ARX | Constrained sqrt-flow physical | Physical/reference ratio |
| --- | ---: | ---: | ---: | ---: |
| M1 → M1 (primary in-mode) | 1.139174 | **0.922542** | 1.110353 | 1.2036 |
| M2 → M2 (primary in-mode) | 2.470577 | **0.534148** | 1.090082 | 2.0408 |
| M1 → M2 (independent source file, no refit) | 2.470577 | 1.954340 | **0.994043** | 0.5086 |
| M2 → M1 (independent source file, no refit) | 1.139174 | 1.645453 | **1.251767** | 0.7607 |

Original in-mode physical law is **20.36% worse than ARX** on M1 and **104.08% worse than ARX** on M2, rather than the prospectively required ≥10% better. Both original cross-mode physical forecasts are better than the matched source-trained ARX transfer forecasts and satisfy the generous prospective ≤1.5× cross-mode ceiling, **but** transfer can only qualify when **both** source-condition tests also improve and input controls support the same mechanism. They do not. **Final physical-transfer gate = FAIL**, no promotion of coefficients as a validated shared plant law.

The baseline is not a weak toy. Within each mode the complete original training-only candidate search evaluated **30 registered models**: 16 coupled multivariate ARX variants, 8 degree-two multivariate NARX variants, and 6 signed four-state square-root hydraulics including an explicit upper-to-lower crossflow ablation. The strongest **usable** development reference was ARX order8 (M1 ridge **1e-4**, M2 ridge **1e-2**); physical validation independently chose the **no_cross** ablation in **both** modes (M1 ridge **1e-3**, M2 ridge **1e-8**). That is concrete evidence that the preregistered simple tank3→tank1/tank4→tank2 crossflow structure was **not supported by the source's long-horizon development selection**. It does not establish the original apparatus lacks those water connections; model misspecification, sensor calibration and mode-dependent valve splits remain alternatives.

**All eight quadratic NARX candidates for each mode diverged during full free-running DEVELOPMENT** (e.g., M1 order2 ridge1e-6 at dev position907; M2 order2 ridge1e-6 at dev position4499). They were refused, not stabilized, clipped to look good, or scored as successful. Their original model coefficients and exact failures remain in the frozen JSON. A fit that looks good at teacher-forced one-step training is not accepted as a long-horizon strong model.

## Pump and sensor negatives: crucial mechanical qualification

All controls below were applied to already frozen model families and scored on the original separate **within-mode** Test; a changed-control forecast never uses future measured state as a rescue. Values are four-tank macro NRMSE:

| Frozen model and control | M1 | M2 |
| --- | ---: | ---: |
| Physical, actual aligned pumps | **1.110353** | **1.090082** |
| Physical, both pump sequences shifted +97 samples | 1.116614 | **1.047551** |
| Physical, pumps forced to zero | 2.694045 | 2.899404 |
| Physical, swap predicted Tank1/Tank2 at scoring | 2.099913 | 1.267771 |
| ARX, actual aligned pumps | **0.922542** | **0.534148** |
| ARX, shifted pumps +97 samples | 0.937954 | 0.552423 |
| ARX, pumps forced to zero | 5.477798 | 9.492454 |

**M2 shifted-pump input actually IMPROVES the physical score** from 1.090082 to 1.047551. This violates the predeclared causal-input response criterion and is not explainable away by citing improved cross-mode transfer. The 37-step-shifted-original-training-label ARX sham scores 0.962066 on M1 and 0.566896 on M2, slightly worse than real ARX but still competent on this highly correlated series; time-correlation and uncontrolled source confounding remain. Real pump commands vary, but observational predictive sensitivity is not a proof of causality, true tank hydraulic coefficients or safe intervention.

One native-unit example makes hidden aggregate effects visible: M1 Test Tank1 original RMSE ARX **2.005276** vs physical **2.278059** and Tank4 ARX **1.009498** vs physical **1.442193**; M2 Tank1 ARX **0.401357** vs physical **1.095367** and Tank2 ARX **0.745781** vs physical **2.034093**. Full per-tank/per-original-file values, first1/30/120 fixed-start horizons, source times, candidate errors and prediction hashes remain in the complete independent original report.

## Durable receiving and cold reproduction

**First source-authentic numerical run**, [GitHub Actions 44479926183](https://github.com/Jacob-Met/worldlaw/actions/runs/44479926183), source branch head **739ca64b8096b6958362328c170e2690aa90e76d**, completed **success** as a reproducible study with **7/7 source-free tests** (the *scientific law gate* in the report is a separate FAIL). Entire original train-only fit finished in **81.13s**, independent physical receiver in **7.88s** on GitHub Python 3.12.16, NumPy 2.1.3, SciPy 1.15.3, OpenPyXL 3.1.5 CPU, excluding install/download.

- Complete **frozen model** JSON SHA-256 **e0be09bb30d35ccfcc64b440155455c31c62e023d5a9c481c9e2c61ffc2e71a0**. All 30×2 original estimation-only attempts and exact selected model coefficients captured.
- Complete **original Test receiver** JSON SHA-256 **580cecae32d258e6708e88db60bfcdcfeb13ade28c80bb09b872ce2d68fd3a83**, with source workbook SHA, four original conditions, full native/normalized errors and all negatives.
- Archived first original GitHub Actions artifact ID **14507693766**, compressed ZIP SHA-256 **84bb5fbf843ea8cb3422c567bfd7c88cf4ee216d25a0f471d1696124af6530f4**. Artifacts may expire; the authored source archive and original science scripts are pinned for exact reproduction.
- Real source and script entrypoint: **experiments/intaset-quadruple-physical.py**, independent library **src/science/quadruple_tank_hydraulics.py**, source-free falsifying tests **tests/intaset-quadruple-physical.test.py**, continuous original physical CI **.github/workflows/intaset-source.yml**. [Run the two independent processes from the original source](INTASET_QUADRUPLE_REPRO.md).

**Decision:** publish the fully measured **negative** in main. Do NOT replace the live WORLDLAW default synthetic instrument with an unqualified hydraulic interpretation, silently suppress two failed in-mode tests, hide the M2 shifted-control counterexample, treat Excel rows as independent replications, or retune on the consumed original M1/M2 Testing workbooks. The next load-bearing scientific experiment is instrumented independent hardware with known state calibration and independently varied valve/pump plumbing across true physical rigs, or a separately acquired new protocol with time/frequency controlled interventions and a truly fresh test cohort.
