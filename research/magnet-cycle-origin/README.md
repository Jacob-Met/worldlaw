# MagNet 2023 cycle-origin robustness

Anchoring each flux-density cycle at its maximum centered difference reduced the submitted Paderborn model’s mean material P95 relative error from **8.2051%** under coordinate rotation to **7.8455%**. It beat both rotated inputs and the maximum-field anchor on materials A, B, C and E. Performance on the original acquisition convention was **7.8421%**, so the prospective joint gate failed. The strongest saved pure-error entrant among 23 teams was Bristol at **7.7682%**. Paderborn won the historical composite competition, which also scored model size.

| Material | Measured cycles | Original submitted | Hash-rotated | Centered-difference anchor | Maximum-field anchor | Bristol archive |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 7,651 | 4.7745% | 5.3554% | 4.7498% | 5.4478% | 8.5308% |
| B | 3,172 | 2.1751% | 2.3901% | 2.1496% | 2.4149% | 1.9501% |
| C | 5,357 | 3.4158% | 4.0212% | 3.4290% | 4.1366% | 4.5029% |
| D | 7,299 | 22.2011% | 22.0082% | 22.2604% | 22.2266% | 15.8913% |
| E | 3,738 | 6.6437% | 7.2504% | 6.6385% | 7.2967% | 7.9661% |

The largest absolute candidate error was **105.59%** on D row 6579, 199,180 Hz, 90°C. This cycle’s designated anchor was already at sample zero. The measured loss was 19,199.99 W/m³ and the prediction was 39,472.62 W/m³. D row 6921 illustrates a separate coordinate failure. Moving the inferred origin forward by one of 1,024 samples changed the original 67,475.33 W/m³ prediction to 33,552.32 W/m³ against a 61,288.92 W/m³ measurement. That increased its relative error by 35.16 percentage points. All row indices are zero-based and material-local.

The maintained training-weight Paderborn baseline scored 7.8683% on original cycles and 8.2089% on rotated cycles. The Sydney innovation model scored 13.8569% and 32.8516%. All four source-defined waveform classes were present on all twenty Paderborn batches. On A alone, the native rule classified 959 original cycles as square, 546 under rotation, 959 under the centered-difference anchor and 490 under the maximum-field anchor. Its explicit square rule inspects the final 200 samples. These counts do not distinguish which individual classifications changed.

The Paderborn CPU rerun agreed with its historical archived P95 within 0.00371 percentage points on every material, but C, D and E exceeded the prespecified 0.2% maximum per-forecast discrepancy. D row 7255 gave 759.63 W/m³ on CPU and 755.65 W/m³ in the archived file, against 165,342.32 W/m³ measured. Both numerical histories are retained, and the observed discrepancy’s implementation-level cause remains unresolved. Sydney met both archive-agreement tolerances on all materials.

The frozen order-insensitive descriptor had **zero exact duplicate groups** across the observed original cycles. It yields no positive empirical error floor on this cohort. The circular-shift comparisons reuse the same 27,217 physical measurements. They establish coordinate sensitivity under the stated test and do not identify a new material law.

## Cost and verification

The five original CPU inference jobs took 96.534 seconds of summed running wall time and 124.894 seconds of measured user plus system CPU time. Peak single-process RSS was 2,511,380,480 bytes. The eight instrumented forward/preprocessing arm times summed to 76.326 seconds; job totals also include archive checks, CSV reading, anchor canonicalization, and receipt writes. Each job requested two CPU cores and 6.2 GB of RAM. Downloading the 1,214,118,890-byte official distribution and obtaining model weights, calibration, historical scoring and publication are separate costs.

The unmodified organizer entry reproduced all **620** printed metrics across 155 model-material groups. An independent sorted-order recount checked 160 unrounded native metrics and 40 worst row indices, with maximum difference 3.56×10⁻¹⁵ percentage points. Run `python verify_receipts.py` from this directory for the standard-library receipt check. The numbered registry messages, exact model/input scope, archived comparison tolerances and interpretation appear in [protocol.md](protocol.md). Original material IDs, input digests, output digests and timing are in [receipts](receipts).

## Reproducing a separate numeric run

Use Python 3.10.22, torch 2.0.1+cpu, NumPy 1.26.4, pandas 2.0.3, joblib 1.3.2, torchinfo 1.8.0 and tqdm 4.67.1. The commands assume this source directory and an empty absolute working directory in the shell variable `work`.

1. Run `python official_share.py "$work"` to obtain the source distribution, then `python receive_sources.py "$work" "$(cat source_files.json)"` to acquire the pinned inference code/configuration/weights. The source manifest deliberately excludes the historical predictions and measured test vectors.
2. Run `python driver.py "$work" qualify`. For each material A through E, run `python driver.py "$work" forecast A` with the corresponding material letter. Capture the five NPZ and JSON SHA-256 digests in a mapping with the same schema as the stored prediction lock. Keep a new run’s own lock: receipt times and native floating-point behavior may differ across hosts. The published lock remains the identity of the original forecasts.
3. Run `python score.py "$work" historical_sources.json path/to/new-lock.json` to fetch the pinned measured losses and historical submissions and to score only the verified forecasts. Then run `python recount.py "$work" historical_sources.json path/to/new-lock.json`, `python literal_gate.py "$work" historical_sources.json`, and `python archive_parity.py "$work" historical_sources.json`.

Eventual public exposure of these final values and the original estimation labels does not create a new blind test for future hypotheses. A new physical measurement set would be needed to support an independent replication.
