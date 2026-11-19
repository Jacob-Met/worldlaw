# Cold original four-tank InTaSet source-only reproduction

This is the exact reproducible original-hardware scientific receiver behind [the original source-negative four-sensor mode-transfer finding](INTASET_QUADRUPLE_ORIGINAL_RECEIVING.md). It is NOT the synthetic browser sensor and it does not control any apparatus. A second receiving on already-consumed M1/M2 official Testing workbooks verifies reproducibility only; it is **not** a new independent blind test of a model changed after first receiving.

## Independent source and environment

Primary InTaSet source: Putri, Villacrés, Raza, Iwakin and Moazeni, DOI 10.5281/zenodo.17652851, article DOI 10.1061/9780784486931.058, **CC BY 4.0** confirmed with the original Zenodo rights metadata. Exact author ZIP source InTaSet.zip **6,107,043 bytes**, Zenodo-published MD5 **0fe80940a3c9520e665b769f4b8d5ab8**, independent SHA-256 **a0aac3b0985bec232afa8f9e95cd87612515904f5e574bc483777e4d532e8c85**. The raw original ZIP/Excel files remain external, do not commit to source.

Environment used for original first blind receiving on GitHub Actions: Python3.12.16, NumPy2.1.3, SciPy1.15.3, OpenPyXL3.1.5. Use a real terminal, original native fleet worker or original GitHub Actions workflow (source-only Python code does not require a GPU):

~~~sh
python3 -m pip install numpy==2.1.3 scipy==1.15.3 openpyxl==3.1.5
mkdir -p /workspace/tmp/original-intaset /workspace/receipts/intaset
curl --fail --location --retry 5 --retry-all-errors \
  'https://raw.githubusercontent.com/Moazeni-s-Concise-Lab/InTaSet/main/InTaSet.zip' \
  -o /workspace/tmp/original-intaset/InTaSet.zip
printf '%s  %s\n' \
  'a0aac3b0985bec232afa8f9e95cd87612515904f5e574bc483777e4d532e8c85' \
  '/workspace/tmp/original-intaset/InTaSet.zip' | sha256sum --check

# Seven source-FREE physically falsifying controls BEFORE touching measured rows
python3 tests/intaset-quadruple-physical.test.py

# PROCESS 1: only original M1/M2 TRAINING Excel workbooks are loaded. The
# original independent M1/M2 TEST Excel binary and numeric cells are NEVER
# opened here; one SHA-pinned source ZIP contains both roles.
python3 experiments/intaset-quadruple-physical.py fit \
  /workspace/tmp/original-intaset/InTaSet.zip \
  /workspace/receipts/intaset/original-frozen.json

# PROCESS 2: verify frozen source/model code and selected candidate before
# opening original M1/M2 separate TEST workbooks. Each test segment permits
# only first64 actual four-tank sensor readings for initialization, then
# autogenerates every future level using the recorded pumps and frozen model.
python3 experiments/intaset-quadruple-physical.py evaluate \
  /workspace/tmp/original-intaset/InTaSet.zip \
  /workspace/receipts/intaset/original-frozen.json \
  /workspace/receipts/intaset/original-receiver.json
sha256sum /workspace/receipts/intaset/original-*.json
~~~

The HAMON native workers use /workspace scratch by convention; on a separate local computer substitute another writable scratch/receipts folder. Never put raw author source in git. The first original test was independently received in [GitHub Actions 44479926183](https://github.com/Jacob-Met/worldlaw/actions/runs/44479926183), which carries the source-pinned first fit and actual receiving with immutable results under artifact14507693766. This can be rerun in [the repo's source-original CI workflow](../.github/workflows/intaset-source.yml).

## Scientific contract and expected refusals

Before first measured numeric original source observation, [the prospective original protocol](INTASET_QUADRUPLE_PREREG.md) and taskboard message156855 fixed:
- M1 original Training first70% fit/last30% development; independently M2 same. M1 original Test and M2 original Test are separate author workbooks/heldout roles, not rows mixed with training.
- Four real original sensor channels Tank1–Tank4, two pump channels Pump1/Pump2, original Time column, one-tenth-second sampling. Unexpected original source ZIP byte count, SHA, MD5, workbook/sheet/column names, missing channels, out-of-sequence timestamps, false source clocks, nonfinite values or source code drift must NOT silently be accepted.
- Drop invalid rows/windows and do not bridge source-record gaps. The original M1 test has 113 nonnumeric rows in the workbook and 3,000 valid consecutive source records; this is not proof that actual hydraulic sensor measurements dropped out.
- Actual observed first64 test sensor vectors may initialize state. Every further measured level is withheld from forecast and used for scoring only; future recorded pump commands are provided as a known external forcing sequence.
- Fit 16 fully cross-coupled four-output ARX, 8 quadratic NARX and 6 signed four-state square-root-flow variants per original mode on that mode's estimation fit, select the strongest viable data-driven model and each physics family using only original validation. No future original Testing output may select a model or repair divergence.
- On original two Test workbooks evaluate within-mode M1→M1, M2→M2 and source-frozen cross-mode M1→M2, M2→M1 without adapting to the target. Predeclared full remaining 2,936-step macro four-channel NRMSE normalized by target **training-only** native channel std. Record per-channel native RMSE, first1/30/120-starter windows, all source workbook hashes and full timestamp coverage.
- Negative controls: +97-step pump time shift, forced zero pumps, Tank1/2 predicted-output swap at scorer, and +37-step shifted training-label ARX sham. Physical source mechanism succeeds only if ≥10% improvement versus development-best ARX/NARX on BOTH within modes, cross-mode physical ≤1.5× same source-frozen data-driven transfer counterpart, and both pump shams worsen.

**Observed first original result:** gate **FAILED**, despite physically signed model having lower error in both no-refit cross-configuration transfers. M1 original in-mode ARX0.922542 vs physics1.110353; M2 ARX0.534148 vs physics1.090082. In mode M2, +97 pump shift actually **improves** physical1.090082 to1.047551. All eight quadratic NARX original validation candidates per mode had divergent free-runs and were properly refused. Do not retune model families/regularization after this first original receiving or claim independent hardware replication. More complete original per-tank evidence and unidentifiable causal boundary are in the [receiving document](INTASET_QUADRUPLE_ORIGINAL_RECEIVING.md).

Expected first numeric original source receiving artifacts SHA-256: frozen original mode models **e0be09bb30d35ccfcc64b440155455c31c62e023d5a9c481c9e2c61ffc2e71a0**, original external test receiver **580cecae32d258e6708e88db60bfcdcfeb13ade28c80bb09b872ce2d68fd3a83** (exact original code/provenance/run). Artifact ZIP SHA-256 **84bb5fbf843ea8cb3422c567bfd7c88cf4ee216d25a0f471d1696124af6530f4**. Machine-level tiny floating-point differences may change hashes across versions, but source/parameters/model family/out-of-sample score differences must be reported, never waived.
