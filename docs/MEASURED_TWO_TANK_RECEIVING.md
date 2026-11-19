# Original measured 25-run two-tank falsification: retained negative result

**Observation date:** 2026-11-19 UTC. **Status: real measured study executed, hydraulic law hypothesis FAILED its preregistered improvement threshold.** This scientific finding is not a claim of causal plant identification, a real intervention experiment, or improved control capability.

## Pinning and test custody

- Prospective protocol registered before inspecting measured CSV values in task t-mwn55jc2ouav, thread post 155623.
- Original author source: Gómez-González et al., Scientific Data (2026), DOI 10.1038/s41597-026-07686-2; dataset corrected Zenodo v2 DOI 10.5281/zenodo.23529910, CC BY 4.0.
- Unmodified downloaded ZIP: 35,517,324 bytes, MD5 3a70e0b3b9d14b4c0520110963c3d33e, SHA-256 e31b41da2376d885774891606d346b26926d93db8483d9d7ac6bfcc23e24128e.
- **25 independently named author files, 765,000 original sample rows, 749,236 valid measured observations** after the published version-two dropout flag and independent numerical checks. All original file SHA-256 identities are retained in the complete measured study output; no raw source recordings committed.
- Whole-recording assignment: 19 training (all 10 Baseline and 9 sorted PassiveOutflow), 2 PassiveOutflow development (20pct and 60pct), and **all four Disturbance** files heldout externally from tuning. No rowwise cross-recording leakage.
- First full physical source receipt: [Actions 44470842741](https://github.com/Jacob-Met/worldlaw/actions/runs/44470842741), head 110bbce0e100b1aa69b363d4633e7a03a27beaf4, six source-free negatives green, all original 25 runs scored. Its artifact upload initially skipped a hidden directory and is **not** used for durable scientific custody.
- Corrected original-data receiving: [Actions 44471138449](https://github.com/Jacob-Met/worldlaw/actions/runs/44471138449), head fd63db99d364443458a985f1eafcf58418644520, green. Report artifact 14503948571 (two-tank-measured-receipt), artifact ZIP SHA-256 2c5d08554aef36c06bfc453eceac0419e1f02c2cfb1691f1b56b434c8efa7ef5, full uncompressed report SHA-256 **e0db1e8ba8d2b0f6a460810bcd0d393308868a619e9700a260ed78059f6bc28f**. The workflow artifact expires on 2026-12-04; identities and this factual summary remain source-pinned.
- Native source itself was tested under Node v22.23.4; measured numerical study wall 3.1201 seconds excluding network and unzip, 391.6 MB peak reported RSS. This is not a cluster or physical actuator throughput claim.

## Frozen heldout results

Macro average over the **four distinct measured disturbance recordings**, in tank level percentage-point RMSE. Long predictions use two observed initial levels and the source-logged future pump/valve sequence; no later observed tank level enters forecast recurrence.

| Fitted family | One step | 30 seconds | 120 seconds |
| --- | ---: | ---: | ---: |
| Persistence, no fitted coefficients | 0.9772 | **2.4305** | **3.2424** |
| Published-delay AR2 + pump, ridge on development | **0.8675** | 2.4519 | 3.4157 |
| Rich lagged ARX | 0.8682 | 2.5414 | 4.6501 |
| Constrained pump + square-root hydraulic drainage | 0.9772 | 2.4251 | 4.0290 |
| Sparse finite-dictionary SINDy-style regression | 0.9765 | 2.5606 | 5.0866 |

At 120 seconds, the physically signed hydraulic candidate is **17.96% worse** than AR2, not 10% better; the exact prospective hydraulic gate rejected. The per-file 120-second AR2/hydraulic pairs are:

| Original heldout file | AR2 | Hydraulic |
| --- | ---: | ---: |
| Disturbance_HighOutflow_100pct | 4.0741 | 4.3037 |
| Disturbance_HighOutflow_10pct | 4.6095 | 4.6295 |
| Disturbance_LowOutflow_40pct | 2.9059 | 3.8109 |
| Disturbance_LowOutflow_50pct | 2.0732 | 3.3718 |

The worst individual hydraulic/AR2 ratio is 1.6263; the headline failure is macro-mean quality, not that per-run ratio. A single dataset with only four independently named heldout disturbance runs does not establish a general model-family ranking; this particular observational domain has slow, feedback-controlled dynamics, unknown/excluded hidden state, and changing exogenous conditions.

## Falsification diagnostics

The model predictions are **largely insensitive to the offered input interventions**. Hydraulic 120-second RMSE becomes 4.0413 with +97-second shifted logged controls, compared with 4.0290 unshifted, and **improves** to 3.9985 when valve opening is set to zero at receiving. Strong ARX changes only 4.6501 to 4.6550 under shifted control. These tiny/mixed changes fail to support reliable causal pump/valve effect identification, even though absolute predictions are finite. An independently refitted 37-second label-shifted ARX reaches a much worse 18.9076 120-second RMSE, rejecting a trivial arbitrary-label fitting explanation but not proving hydraulic causation.

Sign-constrained coefficients for the selected hydraulic term order (constant, pump, negative sqrt(level), negative valve × sqrt(level)) are 0.0007753361, 0.0002468518, 0.0013206407, 0.0000348474 in normalized level units. All are finite and physically signed; positivity alone does not make them true.

**Decision:** Preserve the measured negative in the same code path; do not tune or re-rank using these consumed four disturbance recordings, and do not replace the maintained WORLDLAW live law with the weak hydraulic model. The next genuine leap needs an independently recorded, independently perturbed apparatus with directly measured actuator and valve response, or an explicitly identified hidden-state model evaluated on a fresh, source-disjoint intervention course. This benchmark is a reproducible high-value rejection and an extensible measured-data falsification harness, not a verified physical law.

## Re-run

Use the first-party source-pinned script and complete cold instructions in [MEASURED_TWO_TANK.md](MEASURED_TWO_TANK.md); the original study is executed in .github/workflows/two-tank-measured.yml. All original source hashes, every development-model score, negative-control comparison, complete per-file RMSE/counts, and runtime can be inspected in the Actions artifact. Avoid shipping raw source CSVs into git or rewriting previously consumed heldouts into "fresh" tests.
