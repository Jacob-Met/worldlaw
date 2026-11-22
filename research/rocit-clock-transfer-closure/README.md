# Comparing fibre and satellite optical-clock ratios in the 2022 ROCIT campaign

For the five clock pairs reported through both transfer methods, equality of the two routes fails the stated five-dimensional uncertainty test. Two independent cycle coordinates give a different result: the differences around the network are small compared with their measured uncertainties. These observations are compatible with constant offsets attached to the four clock endpoints. The measurements cannot tell which clock, link, analysis interval or unmodelled error produced the differences.

## Measurements and information available

The authors compared ten optical clocks during February–April 2022. They selected 38 ratios to illustrate consistency and discrepancies. We used the ten measured Table 2 entries forming **every** same-direction fibre/GNSS pair in that table. Their covariance matters because the techniques share clocks and systematic corrections, and GNSS comparisons can share masers and satellite data. The 2021 reference ratios used in the original figure come from a least-squares adjustment and do not enter this analysis. We also excluded ratios obtained by algebraic reconstruction of the reported table. [Campaign paper, Table 2](https://doi.org/10.1364/OPTICA.561754) · [Final supplement, Table S3](https://doi.org/10.6084/m9.figshare.29041466.v3)

The fibre and satellite inputs come from physically different measurement chains. Fibre ratios use simultaneous optical uptime. The GNSS estimates rely on local clock–maser measurements, satellite transfer and extrapolation over selected intervals; the two methods need not describe identical times. The campaign data release supplies fibre time series, with no matched GNSS records. We verified its archive digest and inspected its member inventory and acquisition-metadata files. No one-second measurement values entered this study. Neither absolute UTC error nor a common-window offset can be inferred from these aggregates. [Campaign data release](https://doi.org/10.5281/zenodo.17107693)

The clock identities, graph, both tests, thresholds and treatment of printed precision were fixed before reading the ten tested measurements. Previously visible information included the authors' qualitative discussion of INRIM and other discrepancies, the uncertainty columns and the full correlation table. A source-inspection error also displayed Table 2 estimates 1 and 2, involving LUH In⁺. Neither is used here. This is a descriptive reanalysis of selected published results. The two 95% cutoffs are individual Gaussian-model references without a joint familywise claim. The authors explicitly warn that actual uncertainties could exceed the estimates.

## Five method differences

Entries use the printed frequency ratios in their reported direction. The first number in each pair identifies the fibre measurement. Values and standard uncertainties are in units of 10⁻¹⁸ for the logarithmic GNSS-minus-fibre difference. Standardized differences use the nominal reported covariance.

| Table 2 pair | Clock 1 / clock 2 | Difference | Standard uncertainty | Standardized |
|---|---|---:|---:|---:|
| 6 / 16 | PTB Yb⁺ (E3) / INRIM Yb | +380.173 | 90.471 | +4.202 |
| 9 / 23 | PTB Yb⁺ (E3) / SYRTE Sr | +28.743 | 102.181 | +0.281 |
| 10 / 28 | INRIM Yb / PTB Sr | −383.435 | 112.178 | −3.418 |
| 11 / 29 | INRIM Yb / SYRTE Sr | −381.778 | 133.195 | −2.866 |
| 12 / 38 | PTB Sr / SYRTE Sr | −6.000 | 121.824 | −0.049 |

The largest standardized difference uses published fibre ratio 1.238909231832259569(26) and satellite ratio 1.23890923183226004(11). The last displayed digit has different precision on the two routes. The three edges involving INRIM have consistent signs after accounting for the direction in which the authors reported them. The other two edges are smaller.

## What the network resolves

Write the four endpoints as A = PTB Yb⁺ (E3), B = INRIM Yb, C = PTB Sr and D = SYRTE Sr. An additive endpoint field has edge differences of the form θᵢ − θⱼ. Its sums around both independent graph cycles vanish. The cycles share an edge and their estimated errors can be correlated. We evaluated the two-dimensional joint statistic with the full projected covariance.

| Null model | Observed coordinates (10⁻¹⁸) | Nominal joint Q | Q enclosure over stated rounding model | Individual 95% cutoff |
|---|---|---:|---:|---:|
| Equal route estimates on all five edges | Five differences above | 20.28962 | [12.07760, 41.29714] | 11.07050 (5 df) |
| Differences explained by a constant endpoint field | AB + BD − AD = −30.349 ± 93.937; BC + CD − BD = −7.656 ± 106.744 | 0.16371 | [0.02367, 0.66144] | 5.99146 (2 df) |

The endpoint-field model imposes two measurable restrictions after allowing three free endpoint differences. Both projected covariance matrices stay positive definite over the entire published-precision sensitivity model. Thus the small cycle statistic does not arise from a covariance-imposed zero direction. Many time-dependent or route-dependent mechanisms could produce these aggregate differences, and this test has limited sensitivity to their cycle components.

## Printed precision and covariance

We treated every central ratio and fractional standard uncertainty as rounded to the nearest last printed digit. The parenthesized figure is the authors' uncertainty in final digits; its value is distinct from the half-digit quantization width. Of the 45 distinct off-diagonal entries of the ten-measurement covariance, all 20 within-technique correlations appear in Table S3 with three decimals. We allowed ±0.0005 on those entries and ±0.01 on the 25 unreported cross-technique correlations, following the paper's magnitude bound. Estimates of previously unknown systematic uncertainties lie outside this sensitivity model.

With fractional uncertainties in units of 10⁻¹⁸, form S = D R D from the diagonal scale matrix D and the estimated correlation matrix R. Apply the signed contrast matrix T for each question. The nominal quadratic form uses T S Tᵀ. A first conservative calculation that perturbed every covariance entry independently could not certify either rank. Its relative operator bounds were 1.4612 and 1.1741. Reusing each physical row's same uncertain scale across its covariances then certified both.

Specifically, the exact rational LDL decomposition changes coordinates so the nominal covariance is a positive diagonal P. Write A for the corresponding transformed contrast and normalize by P to compare quadratic forms. Let γ bound the largest singular value of P⁻¹ᐟ² A ΔD R¹ᐟ², and β bound the normalized covariance change from ΔR at every admissible D. For any unit direction, the nominal response norm is one. Changing D can reduce or increase that norm by at most γ. Including ΔR gives covariance factors [(1−γ)²−β, (1+γ)²+β] here, where both γ are less than one. The program bounds these norms using elementwise absolute envelopes and a rational positive-weight row-sum test, checks nominal positivity exactly, and rounds its square-root bounds upward. The lower factors exceed 0.542 and 0.587, respectively. It then propagates each ratio's half-digit log displacement separately through the whitened contrast. Decimal logarithms use 85-digit working precision. The resulting enclosures describe reporting precision and stated cross-method covariance alone.

## Replay

From the repository root, with Python 3.11+ and Poppler's pdftotext installed:

```sh
python3 research/rocit-clock-transfer-closure/replay.py /tmp/rocit-sources
```

The replay obtains three hash-pinned originals: the author TeX archive, final article PDF, and version-3 supplement PDF. A prepopulated directory with the expected filenames and SHA-256 digests works offline. It reproduces the complete frozen result in `measured.json`. A second parser reads the two final PDFs, checks all 242 coefficient index/sign/value triples, compares all ten central ratios, uncertainty strings and endpoint names, forms the 25 edge covariance entries from the four physical terms each, and independently solves both nominal systems. Gradient, single-edge fault and direction-reversal controls exercise the cycle signs. This replay needs no campaign time-series archive. [Author source archive](https://arxiv.org/src/2505.06763v1)
