# Cascaded Tanks With Overflow — independent real physical receiving

**Empirical result:** a prospectively selected latent two-tank, square-root-flow + upper-overflow model predicts the original independent **974-sample** official hardware test at **0.579578 V RMSE**, against **0.690812 V** for a development-selected order-8 ARX and **2.873609 V** for an untrained persistence null. The model improves the designated long-run ARX score by **16.10%**, satisfying the frozen ≥10% criterion; input-shift and zero-input negatives both worsen substantially. This is predictive success on ONE separate measured test trajectory, **not** proof of a uniquely identified physical law, calibrated tank volume, universal controller or safety under new actuators.

## Original source and prospective scientific contract

Schoukens, Mattsson, Wigren and Noël, *Cascaded Tanks With Overflow*, DOI [10.4121/12960104](https://doi.org/10.4121/12960104), original 4TU lab measurements licensed **CC BY-SA 4.0**. The author's benchmark loader (MaartenSchoukens/nonlinear_benchmarks) has two disjoint multisine runs, each exactly 1,024 samples at a 4 s sampling interval: pump command voltage u and measured lower-tank sensor voltage y. The upper tank is **not** observed. Original source is the [4TU archived ZIP](https://data.4tu.nl/file/d4810b78-6cdd-48fe-8950-9bd601e5f47f/3b697e42-01a4-4979-a370-813a456c36f5).

- Original CascadedTanksFiles.zip: **7,520,592 bytes**, SHA-256 **eb0fa05851e8a7136846c2e3b61fbef87def78d0852c86ab91b02ac5db541b51**.
- Original CascadedTanksFiles/dataBenchmark.mat: **24,401 bytes**, SHA-256 **cb2f88d4388be4d3f2a24c6402fba804976aac5f2e1f26cda59ea0a38d016eab**.
- Full prospective split/metric/model/negative/control criteria frozen in HAMON task t-mwn6ceogovzg, message **156260**, **before any estimation or test numerical source values were read**.
- Exact source ZIP authenticated and CRC verified without inspecting measurement values in [source-only Actions 44473434246](https://github.com/Jacob-Met/worldlaw/actions/runs/44473434246), recorded in task message **156323**.
- ORIGINAL estimation trajectory is divided into first **716 training samples**, last **308 validation samples**. The original, entirely separate **1024-sample test trajectory** is never loaded during model selection. The **first 50 output samples** of validation/test are admissible only for hidden-state initialization. All later measured output samples are **heldout**, never used as predictors/parameter-fitting inputs.
- Actual fit loads only uEst, yEst, Ts fields through SciPy MAT selective reader in one process, writes frozen candidate selection with SHA-256 and code/source hashes; a second process verifies the frozen file and original archive before first loading uVal, yVal, Ts. The test receives the full future supplied pump input as an explanatory forcing, not the future target output. No original source ZIP, MAT, CSV or videos are committed.
- Candidate families: untrained last-value persistence, **15 regularized ARX** (orders 2,4,8 × five ridge strengths), constrained **two-state square-root hydraulics** with and without hard tank capacities. Development alone chooses family variants/hyperparameters. Full model candidate table, all rejected attempts and exact source identities survive in the receipt.

## Untouched original test result and short-horizon boundary

Every metric is **sensor-output voltage RMSE**. Secondary first 1, 30 and 120 columns score the first h points of the SAME initial 50-sample-bound autonomous rollout, never refit/reinitialized against later test observations. The primary metric covers all 974 future points after initial 50.

| Frozen candidate | First 1 step | First 30 | First 120 | Full 974 steps |
| --- | ---: | ---: | ---: | ---: |
| Persistence, no fitting | **0.031434** | **0.018171** | 2.817337 | 2.873609 |
| ARX, order 8, ridge 1e-9 | 0.040198 | 0.085074 | **0.748570** | 0.690812 |
| Latent hydraulic + upper overflow | 0.115325 | 0.085106 | 0.751017 | **0.579578** |

**16.10196% improvement over ARX** on the source-declared **full-974** prediction horizon (prospective threshold ≥10%). Physical model performs **worse at the first 1 and first 120 steps**, and persistence is strongest in smooth early 1/30-step portions. Do **not** mislabel this as uniformly better near-term forecasting. Original independent validation (308 points) selected ARX **0.800033 V** and upper-overflow hydraulic **0.545643 V**; the alternative hydraulic without overflow scored **0.882899 V**. The physical candidate has **7 parameters**, the chosen order-8 ARX has **17 coefficients including intercept**. These are pseudo-voltage variables, not independently calibrated SI depth/flow coefficients.

## Falsification and physical observability

The original separate multisine test command changes on **1023/1023** transitions, ranging **0.5051–6.3500 V**, std **0.9995 V**. This source has genuine designed pump excitation, unlike the previously studied 2026 closed-loop original two-tank recordings where the valve was fixed within every run.

| Input/control intervention at scoring | ARX RMSE (V) | Hydraulic RMSE (V) |
| --- | ---: | ---: |
| Original, correctly aligned command | 0.690812 | **0.579578** |
| Shift whole command by +97 samples | 3.015542 | 3.155305 |
| Zero command | 5.448121 | 7.847934 |
| Estimation-only output shifted by 37 for ARX refit | 2.286142 | Not a physical candidate |

Both input shams degrade the frozen model's predictions; the training-label sham also degrades. The controls demonstrate that commanded input timing and real estimation data matter for these **predictions**; they do not identify one unique physical mechanism, establish actuator safety or prove every latent model state is true.

**Posthoc, no refitting:** fitted hydraulic upper capacity clips its **predicted** upper-tank state on **59 of 4092** test integration substeps and **80 of 2860** training substeps. Fitted lower-tank capacity never clips. The hard-overflow model actually uses its **upper** capacity under original inputs; these are **model-internal saturated numerical states, not instrument-observed upper-tank overflow events**. Predicted latent upper state ranges **7.852–39.158** pseudo-voltage units on test; lower **2.949–11.176**. Upper water height was not independently measured. Sensor bias and signed water transfer do not imply unique calibrated physical coefficients.

## Source-authentic execution and exact evidence

First official **blind receiving** succeeded at [Actions 44474700378](https://github.com/Jacob-Met/worldlaw/actions/runs/44474700378), original source branch commit **dbc53e7ff40220c90a168995b4f78aa7f48df467**. It selected and froze all models on the real source estimation before a **separate process** loaded official test outputs:
- Frozen fit JSON SHA-256 **4059ec080a4e43dec0f10af38854bc9ad32e8314e3b193d9b06431065ea98d7e**.
- Complete original test receipt SHA-256 **2e13a7285882e4eae53c6f8165724f152618e1aecd1c2339ba7ed0730763979c**. Original blind scores ARX **0.6908118633 V**, hydraulic **0.5795777615 V**, persistence **2.8736088305 V**. Original artifact ID **14504659807**, ZIP SHA-256 **75e633fe47f9678942465d62ab3ee8b2c690fc9b2b42b7dbaf9c09e373ef2ec9**.
- Later independent diagnostic receiving at [Actions 44475419418](https://github.com/Jacob-Met/worldlaw/actions/runs/44475419418) added short fixed-start horizons and capacity event counts without changing source-trained model families or search settings. **8/8** source-free tests and original source fit+receiver passed at commit **2579e043ba792e4905c8b47b62e22e9f0a9a111f**.
- Later frozen model JSON **16,583 bytes**, SHA-256 **5404d790586063b137c2896e4e5f08fd9e109c7e129cbcd20fd384841d859035**; full diagnostic receiving JSON **23,445 bytes**, SHA-256 **5fdbd42d170beb80c57ab500c673f2e2da80ea2247bddefc5eac7abb9d47e5ab**. Original Actions artifact ID **14506291435**, ZIP SHA-256 **50d5e92d35a0e3559c7daee71c7c0e367d029d0fcf504fbfd62c49b4456773b5**, retains coefficients, all source-fit development attempts, latent capacity traces, original test errors, shams and prediction hashes. GitHub Actions artifact expires under retention; source/CLI are re-runnable from pinned original bytes.
- Fit wall ~**3.50 seconds**, independent receiver ~**0.12 seconds** on original GitHub Actions Python 3.12/NumPy2.1.3/SciPy1.15.3 CPU, excluding download/installation. This is not real actuator throughput.

The preregistered benchmark criterion is met, but one recorded apparatus/test series provides no valid independent-sample confidence interval across 974 temporally correlated output points. Sensor voltage is not calibrated water depth; noise and latent variables may trade off parameters. We have **not** proven causal identifiability, verified direct upper-tank overflow ground truth, transferred to independent hardware, or validated safe control.

**Next proper test:** fresh apparatus and separate pump/flow regimes with measured upper and lower water levels, independent calibration and safe active actuator design. Official uVal/yVal test has been **consumed** and must never be used to tune a new claimed-blind structural candidate. See [cold reproduction guide](CASCADED_TANKS_REPRO.md) for original source-only fit/evaluate commands.
