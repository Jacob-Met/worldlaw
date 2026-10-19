# Measured PASCO pendulum: provenance and receiving instructions

These are real recorded sensor data from the author-maintained [Damped Pendulum Dataset](https://github.com/EnzeXu/Damped_Pendulum_Dataset), pinned at revision [`cbf82673641ecd65e902ad5c38a048387649a2a0`](https://github.com/EnzeXu/Damped_Pendulum_Dataset/tree/cbf82673641ecd65e902ad5c38a048387649a2a0). They are provided by Enze Xu and collaborators for *Identifying Invariant Physical Dynamics Across Multiple Environments* (Xu, Tran, Zhao, Wang, Huai, Shao; TMLR 2026; [primary paper record](https://openreview.net/forum?id=xvQYvYEGhj)). The repository identifies experimental collection at William & Mary with a PASCO PS-3220 rotary motion sensor and explicitly licenses the dataset under Apache License 2.0.

The three files in `raw/` are **unchanged copies** of the original `raw_data/len1_cond1_1.csv`, `_2.csv`, and `_3.csv`. Their original byte-order marker, column headers, precision, unused sensor columns, and blank starting rate cells are preserved. The original [LICENSE](LICENSE) is copied unchanged. No source code from the author repository is executed. This README, the extraction script, receiving script, and extracted bundle are WORLDLAW additions. The bundle is a modified selection of the source, with an audit trail in every run's `source` field.

The selected group is the author's length 1 (0.236 m), condition 1 (air), repetitions 1, 2, and 3. The length is context, **not** a replacement for missing mass distribution or absolute inertia. These are separate recordings of the same apparatus. They do not qualify transfer to an unseen mechanism.

## Reproduce

From the repository root:

```sh
python examples/physical-pasco-92be/build-bundle.py
node examples/physical-pasco-92be/receive.mjs
node tests/trajectory-angular-92be.test.mjs
```

`build-bundle.py` first verifies every original SHA-256, then extracts exactly original seconds 5 through 25 inclusive (zero-based rows 500–2500, 2001 samples per run). The start follows the author's processing script; the fixed 20-second length and role allocation were chosen before fitting. Recordings 1 and 2 train; recording 3 is reserved for forward challenge. Angles and timestamps are preserved: no recentering, unwrapping, resampling, smoothing, or time-origin shift. The starting rate comes directly from the raw sensor rate at time 5: respectively 0.681, **recorded zero**, and 0.785 rad/s. Blank sensor values are never replaced by zero.

The bundle `../physical-pasco-92be.json` has schema `worldlaw.angular-bundle/v1`. It contains no torque commands and requires `inertia: null`. The experimental adapter reports angular acceleration coefficients with `scaleMeaning: angular_acceleration_only_absolute_torque_unknown`; absolute torque remains unidentified. Passive/unforced dynamics are an explicit assumption based on the damped-pendulum experiment, since no actuator channel independently verifies zero applied torque. Sensor calibration uncertainty and rate-estimation details are not established by this ingestion.

The receiving script searches the finite autonomous library using only the first two recordings. It then runs the first eight **training-ranked** candidates against recording 3, without reordering candidates or using challenge errors to choose a replacement. `noiseSigma: 0.01` rad is an assumed displacement-error scale, not an independently calibrated sensor error. Full source reasoning and retained failures are in [PHYSICAL_TELEMETRY_92be.md](../../research/PHYSICAL_TELEMETRY_92be.md).

## Exact source identities

| File | Original bytes | SHA-256 |
|---|---:|---|
| `raw/len1_cond1_1.csv` | 329379 | `3d407510fd2c0fcbca7f7b3a223f34f0788821f3a21b6b94ccd24a087b6a19be` |
| `raw/len1_cond1_2.csv` | 325260 | `7004af991027cf58c2eb59b924e344a203277fb47c453ecbd026e06e8cf71824` |
| `raw/len1_cond1_3.csv` | 319138 | `f034b8900c7b78f0dbe46805c2d5faa41bb1e238558302156d4965cfc1b4603c` |
| `LICENSE` | 11357 | `c71d239df91726fc519c6eb72d318ec65820627232b2f796219e87dcf35d0ab4` |

Original URL pattern: `https://raw.githubusercontent.com/EnzeXu/Damped_Pendulum_Dataset/cbf82673641ecd65e902ad5c38a048387649a2a0/raw_data/len1_cond1_N.csv`.

## Observed first receipt

The default cumulative integral method **fails this measured challenge**. Its selected `coulomb+spring+gravity+bias` model has 0.353936 rad whitened training displacement RMSE, 35.4 times the assumed noise scale, and a typed `runaway_state` during the 20-second reserved recording. Six of the first eight training-ranked models exceed the executable state bound; the two remaining ones are finite but inaccurate (19.6812 and 5.73774 rad RMSE). The source is suitable for testing an unknown-torque-scale consumer; this receipt does not establish an adequate physical law.

## Compact-window refinement receipt

`node experiments/angular-weak-92be.mjs measured` reproduces a separate weak-method experiment. Its one-second window and half-second stride were frozen using analytic development and the measured training recordings before receiving the reserved recording. Initial rate is eliminated from fitting, while the original recorded sensor rate still initializes forward prediction. The selected `gravity+bias` model remains flagged for training mismatch (7.55 assumed noise units), but its reserved 20-second prediction is finite: 0.322968 rad RMSE and 0.943687 rad maximum error. Lower challenge error from another candidate does not change the training ranking. This is a reused held-out benchmark after the first cumulative failure; new independent recordings remain necessary for confirmatory validation. No physical inertia or absolute torque is identified.
