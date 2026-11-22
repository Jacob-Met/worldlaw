# Can the Bilbao calibration support all 20 wave-height compensation tests?

The released calibration supports 19 of the 20 prespecified command pairs at the required gauge. For the remaining pair, the author workbook contains no generated-section height at that gauge for any of the five calibration amplitudes. The raw gauges recorded a signal. Two plausible choices for when the first reflected crest could return give materially different usable intervals. We closed the comparison before scoring any validation response.

The original question concerned the change in first-arrival height when a nominal wavemaker command increases. The frozen design required the candidate, all author controls and both empirical dose-response controls to forecast both commands at all 20 designs before reading the 40 responses. The empirical controls require bracketing measured heights. No fitted-model score, physical reflection time, or causal explanation of a missing table cell follows from this audit. The full design and prospective decision are in [nominal_contract.md](nominal_contract.md).

## Calibration and gauge identity

Peña Vega and colleagues released 390 calibration recordings at 199 distinct depth, period and nominal-height settings. Every raw recording has a common microsecond time column and eight simultaneous gauges at 8, 10, 12, 14, 16, 16.3, 18 and 20 m. Seven clocks cross the uint32 boundary once. All 390 are strictly increasing after correction. The median recording-average sample rate is 49.335 Hz, with a range of 36.525–53.187 Hz. The 16.3 m gauge supports the source's local reflection analysis and is omitted from its seven-station attenuation fit. P1 and P2 label separate physical repetitions.

The command workbook specifies 20 cases. There are 23 corrected/uncorrected pairs in the top-level validation directory and two additional designs repeated in a nested directory. The authors' file-discovery code uses the top-level directory. We kept the original 20 command matches. The roster contains input settings and file identities. Corrections increase nominal command height by 6.94–13.79%. No calibrated paddle displacement is available in this release.

Across the seven regular stations in order, 0, 2, 11, 55, 123, 205 and 319 of the 390 five-period generated-section heights are missing or unusable. The unsupported case is water depth 0.5 m, period 2 s, station 16 m, commanded heights 80 and 86.5464 mm. Both full-generated and five-period-generated heights are absent for both repeats at each calibration command of 20, 40, 60, 90 and 120 mm. Reflected- and absorbed-section values describe different intervals. For example, the 120 mm P1 raw gauge spans −50.499 to 69.528 mm over 2,945 finite rows; its reported reflected- and absorbed-section heights are 77.94642 and 75.03035 mm.

## Reconstructing the usable interval

We used the source geometry (beach at 24 m, generator at 1 m), gravity-wave dispersion relation and station-specific clock. The source chooses the first group of three sufficiently similar crests, backs up by a quarter-period, then projects a nominal return by subtracting two periods and adding the station-to-beach round-trip phase travel time. For the second construction, the same stable start is retained and the return is capped using the first crest that passes the same height/prominence filter. Either construction must retain at least 1.8 commanded periods, as required by the source height fitter. The same two constructions run on every gauge and every recording.

| Gauge position (m) | 8 | 10 | 12 | 14 | 16 | 16.3 | 18 | 20 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Stable-crest construction, qualifying recordings | 390 | 390 | 390 | 390 | 369 | 343 | 279 | 173 |
| Earlier return cap, qualifying recordings | 389 | 388 | 378 | 359 | 257 | 244 | 151 | 62 |

For the ten critical records, all stable-crest windows span 1.946–1.960 periods, with full-rank seven-coefficient harmonic fits. Only the 20 mm P2 record still qualifies after the earlier cap. At 20 mm P1, the first qualifying crest gives a nominal start of 10.719648 s and a return of 14.619312 s, while the stable-crest start is 26.681472 s. At 120 mm P1, both anchors yield positive intervals, of 1.946448 and 0.961632 periods. The difference in time anchors matters even with a complete raw trace and a numerically well-conditioned fit.

Under the stable-crest construction, lower and upper commands at every validation design have raw calibration support. Under the earlier cap, support fails at two designs, both in 0.5 m water at 16 m (period 1.5 s, 50 mm nominal and period 2 s, 80 mm nominal). Both return times are estimates. The publication supplies neither a synchronized incident/reflected timing label at each station nor an independent reflection clock. Selecting the anchor that alone retains all targets would redefine the prespecified endpoint.

The script approximates the MATLAB peak/zero-phase filter conventions in SciPy and uses a fixed three-harmonic least-squares fit on the raw signal to describe the available interval. Its fit requires a rank-seven design and computes peak to trough over 4,096 uniform phase samples. The authors fit Airy, Stokes or cnoidal models on filtered signals and also provide a best-five-period selection. Our raw height estimates have a distinct definition. The source workbook remains authoritative for the original endpoint. The return cap is a sensitivity analysis, not a measured bound on reflection arrival.

## Reproduce from the original release

Download the authors' **Data.zip** and **Results.zip**. The validation measurement archive is unnecessary. The data DOI is [10.5281/zenodo.24120974](https://doi.org/10.5281/zenodo.24120974). Source data are attributed to O. Peña Vega, U. Izquierdo, I. Albaina, G. A. Esteban, I. Bidaguren and J. M. Blanco under the release's CC BY 4.0 terms.

With Python 3.12, NumPy 2.2.6 and SciPy 1.15.3, run from this directory:

```bash
OPENBLAS_NUM_THREADS=1 python qualify_flume.py Data.zip Results.zip --all-windows all-windows.json > replay.json
python independent_windows.py --regenerated all-windows.json Results.zip qualification.json
```

The first command checks the SHA-256 of the complete raw training ZIP and original characterisation workbook. It checks all 390 record identities, reports both bracketing tests and writes every interval at a new path. Compare its numerical report with [qualification.json](qualification.json). The independent reader parses the original XLSX separately and recomputes all 6,240 duration/fit decisions. Original-compressed-registry mode additionally requires the exact archived SHA-256. Freshly regenerated heights may differ at roundoff level across BLAS and SciPy versions.

| Source or original | SHA-256 |
|---|---|
| Complete 319,888,188-byte Data.zip | `816cf4f7190c6f3ca9ce0aee51900fa003bcc625547135e3decf3dbcdb6b000e` |
| Original Results_characterisation.xlsx | `84975ab26fc024bb9f6e9ab092041227eb3c54d1c975689f468cc7650b1d7432` |
| Frozen command roster | `0d616da095048037ef22fc0a47209aad060d865a3f2dc9065c90ec8231718522` |
| Original compressed 3,120-window registry | `5bea65485f8c22e00c5674e52b51700d9468f9ae40b98e76eba2aced1002d783` |
| Original aggregate report | `4231c10ce54e425b24c4a6dd022f872276107cdf2aecbfc74d6e2a91cc962309` |
