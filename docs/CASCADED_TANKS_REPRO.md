# Reproduce original 4TU Cascaded Tanks physical law benchmark

This is a real-source, original-data, two-process numerical identification and falsification route in WORLDLAW. No proxy-generated source samples, frontend screenshots, hardware actuation or hidden output lookahead. It independently reproduces the **first untouched original multisine test** recorded and numerically received in [CASCADED_TANKS_ORIGINAL_RECEIVING.md](CASCADED_TANKS_ORIGINAL_RECEIVING.md). Re-running after the first official test has been consumed verifies reproducibility only; **never claim a revised model was blindly evaluated using the same source test**.

## Requirements and exact primary source

Python **3.12**, NumPy **2.1.3**, SciPy **1.15.3**, curl and unzip are sufficient. Node is not needed for the scientific Python script; npm-native production regression tests remain separate. Source and scientific code are original; the 4TU source archive is CC BY-SA 4.0 and must not be checked into git.

Source: Schoukens, Mattsson, Wigren and Noël, *Cascaded Tanks With Overflow*, DOI 10.4121/12960104. The original author's canonical nonlinear benchmark reader names MATLAB variables uEst/yEst/Ts versus uVal/yVal/Ts. Original archive SHA-256:
**eb0fa05851e8a7136846c2e3b61fbef87def78d0852c86ab91b02ac5db541b51** (exactly **7,520,592 bytes**).

On a connected workstation or verified fleet worker, run from a clean checkout:

~~~sh
python3 -m pip install numpy==2.1.3 scipy==1.15.3
mkdir -p /workspace/tmp/worldlaw-cascaded /workspace/receipts/cascaded
curl --fail --location --retry 5 --retry-all-errors \
  'https://data.4tu.nl/file/d4810b78-6cdd-48fe-8950-9bd601e5f47f/3b697e42-01a4-4979-a370-813a456c36f5' \
  --output /workspace/tmp/worldlaw-cascaded/CascadedTanksFiles.zip
printf '%s  %s\n' \
  eb0fa05851e8a7136846c2e3b61fbef87def78d0852c86ab91b02ac5db541b51 \
  /workspace/tmp/worldlaw-cascaded/CascadedTanksFiles.zip | sha256sum --check

python3 tests/cascaded-tanks-physical.test.py

# PROCESS ONE: separate estimation-only fit (MAT reader loads uEst/yEst/Ts).
python3 experiments/cascaded-tanks-physical.py fit \
  /workspace/tmp/worldlaw-cascaded/CascadedTanksFiles.zip \
  /workspace/receipts/cascaded/frozen-fit.json

# PROCESS TWO: verify frozen hashes, then load uVal/yVal/Ts, with yVal[0:50]
# permitted only for hidden-state initialization; score forecast[50:].
python3 experiments/cascaded-tanks-physical.py evaluate \
  /workspace/tmp/worldlaw-cascaded/CascadedTanksFiles.zip \
  /workspace/receipts/cascaded/frozen-fit.json \
  /workspace/receipts/cascaded/original-test.json

sha256sum /workspace/receipts/cascaded/*.json
~~~

The /workspace paths follow HAMON native fleet scratch conventions; a local machine without /workspace can substitute another writable scratch/receipts directory, but must leave source, training, development and heldout roles unchanged. The scripts never commit any raw measured source bytes.

A complete, independently executed original-data regression with pinned Python toolchain is [the GitHub Actions physical workflow](../.github/workflows/cascaded-tanks-source.yml). It automatically downloads/validates the source archive, runs source-free negative tests, then executes separate fit/test processes, and uploads full JSON reports. No separate frontend dependency is needed.

## What should a cold scientist inspect?

- Source ZIP and MAT SHA-256, original uEst/uVal count 1,024 each, Ts exactly 4 seconds; fit metadata explicitly documents 716 train and 308 development samples. The source MAT intake refuses missing fields, changed original SHA or sample timing.
- Frozen-fit JSON includes full model coefficients and all **17** estimation-only development candidates, 15 ridge/order ARX and two hydraulics, source and solver hashes, and selected ARX/hydraulic models. Running evaluate with changed solver code or source archive **fails loudly** rather than silently accepting the old frozen fit.
- Source-free tests cover no heldout output influence on forecast, original MAT selective variables, registered ARX hyperparameters, bounded hidden physical state/overflow and the 50-point output-prefix rule.
- Final test JSON reports 974 fully recursively predicted values' aggregate RMSE without retaining raw original output, source-model prediction SHA, 1/30/120 fixed-start windows, +97-command-shift/zero-input/shuffled-output shams, and which predicted hidden capacity actually saturates.
- A historical original blind receiving is pinned at [Actions 44474700378](https://github.com/Jacob-Met/worldlaw/actions/runs/44474700378) (fit SHA 4059ec080a4e43dec0f10af38854bc9ad32e8314e3b193d9b06431065ea98d7e, test receipt SHA 2e13a7285882e4eae53c6f8165724f152618e1aecd1c2339ba7ed0730763979c); the later extended original numerical course at [44475419418](https://github.com/Jacob-Met/worldlaw/actions/runs/44475419418) has SHA 5404d790586063b137c2896e4e5f08fd9e109c7e129cbcd20fd384841d859035 for fit and 5fdbd42d170beb80c57ab500c673f2e2da80ea2247bddefc5eac7abb9d47e5ab for receiving. Tiny numerical variation is possible when Python/BLAS numerical versions or source code change: compare the pinned models and source version, never hide differences.

## Interpretation and refusal states

The original official test is a **single** sensor-voltage trajectory (not 974 independent trials), and input pump voltage is a commanded open-loop signal. The hidden upper tank's water height is not independently measured; nonnegative flow coefficients and predicted overflow clips do not imply absolute physical identification. Model test score cannot justify unsafe physical actuation. If a changed archive, original sample count, wrong Ts, missing CSV/MAT variable or model code hash is detected, do **not** bypass the source refusal. If the candidate fails to improve the heldout metric or a negative control looks better, preserve that failure and do not retune on the now-consumed test. For genuine further discovery, obtain a fresh apparatus or independent real-world multi-regime course with actual upper water-height measurements and controlled safe interventions.
