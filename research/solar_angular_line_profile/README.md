# Solar line profiles from fourteen viewing angles

Both models that assigned rotation independently of the local line profile beat the angularly coupled model in **all 24 line/date records**. The coupled model beat the no-rotation control 24 times and the released IAG23 disk atlas 9 times. The comparison includes every delivered sample in the registered windows. All 754 target flags contained the undocumented logical byte 0x01, so their quality interpretation and primary certification remain unresolved.

## Measured disk profiles

The table gives the equally weighted mean over eight Fe I absorption-density RMSEs, in inverse km/s, on the recentered interval from −3 to +3 km/s. Each date is one independently acquired PEPSI disk coadd. These three consecutive dates share a star and spectrograph.

| Date in 2016 | Coupled | EW-independent | Continuum-independent | No rotation | Released IAG23 disk |
| --- | ---: | ---: | ---: | ---: | ---: |
| Nov 15 | 0.00565336 | 0.00544840 | 0.00545184 | 0.00818475 | 0.00577776 |
| Nov 16 | 0.00557451 | 0.00536723 | 0.00537005 | 0.00812540 | 0.00566875 |
| Nov 17 | 0.00561896 | 0.00541280 | 0.00541552 | 0.00816359 | 0.00570726 |

The largest coupled residual occurred on November 15 in Fe I 5576.0881 Å at +1.9 km/s. Observed density was 0.10481333. The coupled prediction was 0.11463378, EW-independent 0.11442692, continuum-independent 0.11440934, no rotation 0.11637544 and released disk 0.11302444. The coupled model beat the released disk in all three daily means, despite losing to it on 15 individual records. Complete native wavelengths, normalized intensities, variances, flag bytes and processed target fields are retained.

## Source and model

The eight Fe I entries in Löhner-Böttcher et al. Table 1 fixed the roster. Ellwarth et al. recorded the quiet Sun at fourteen viewing angles during 2020–21. Their team excluded HITRAN2020 H₂O and O₂ regions before velocity shifting, and separately removed filter artifacts. Finite delivered spectra can still contain weak atmosphere or calibration residuals. The author viewer and serialized wavelength plane establish 4200+i×0.001 vacuum Å despite the FITS wavenumber label. PEPSI provides standard-air wavelengths. Conversion was fixed by the Edlén relation; each spectrum retained its own published continuum normalization. Activity, instrument response and air mass differ across the acquisitions.

Projected annular area and the wavelength-dependent Neckel–Labs continuum weight determine each local profile's contribution. For the independent control, the rotation kernel is averaged with weights proportional to annular continuum weight times local compact-line equivalent width. With symmetric zero-mean kernels, coupled and independent mixtures have identical first and second moments. Their third central moment difference before final taper and instrumental response is three times the weighted covariance between local centroid and annular velocity variance. All 24 source cases verify the identity. Source sensitivity to limb extrapolation, rotation convention and time of day is retained.

- [Ellwarth et al. 2023, angular source](https://doi.org/10.1051/0004-6361/202245612)
- [Official IAG spectral library](https://www.astro.physik.uni-goettingen.de/research/solar-lib/)
- [Hanassi-Savari et al. 2025, released disk control](https://doi.org/10.1051/0004-6361/202451874)
- [Löhner-Böttcher et al. 2019, line roster](https://doi.org/10.1051/0004-6361/201834925)
- [Strassmeier et al. 2018, independent disk acquisition](https://doi.org/10.1051/0004-6361/201731631)
- [Official PEPSI date products](https://pepsi.aip.de/cms/data/paper-1/)

## Source coverage and truncation

The initial producer at 4d75f022 required complete ±22 km/s source windows and stopped at μ=0.20 with 22 nonfinite samples around Fe I 6301.5008. No forecast was produced. A separate IEEE-exponent census of all 112 slices showed that the excision around 6302.4932 also reaches +8.932649 km/s at μ=0.97, overlapping the old continuum sideband. This census never decoded finite intensities. The 2025 untreated local spectra would place terrestrial absorption inside the rotational convolution; they were excluded. The authentic 2025 integrated atlas is a separately delivered same-window control.

The successor was frozen at 82c2099a66c79de340fdd7d4dba914fd868e20fc. Every measurement bracket lies inside the common ±8 km/s interval. Positive local absorption is multiplied by a compact raised cosine, flat to ±5 and zero by ±7.3 km/s. The resulting mathematical field is rotated and convolved with a Gaussian for the nominal 700,000 to 250,000 resolving-power change. Its zero exterior defines the observable and supplies no missing measured intensity. Every predicted and observed disk profile receives the same **final** taper, centroid removal and unit-area normalization. In contrast, the initial local taper precedes rotation, while the observed disk line is already physically blurred and rotated. These operations generally do not commute.

With exterior depth bounded by one, |v|>8 contributes at most 8.17×10⁻¹⁴ to the modeled raw ±3 core and 1.09×10⁻⁴ to the raw ±5 core. These conditional figures exclude changes to normalization and centering. Narrowing the source taper changed the final coupled profiles by 0.002727–0.006964 RMS, exceeding the 0.000149–0.001089 coupled-versus-EW-independent differences throughout. The largest narrow-taper change was 0.006964 for Fe I 5434.5232 on November 15, where coupling changed the forecast by just 0.000149. These measurements cannot establish unrestricted stellar skewness.

## Forecast custody and replay

The complete 267,637-byte forecast archive has SHA-256 03cfb447e6cc9897e7c38d622dbff6127c8a14866acf5fc4afafdb3e13e31556. Its lock and receiver at 36646eba2c6040df70fbd70c98cf7927c1f9e748 preceded access to PEPSI scientific columns. The first receiver read the first compressed date product, transformed the first target, then refused 31 binary 01 values in a FITS 1L logical field. Its output contains the flag counts and no scores. The supplementary receiver reported every flag as a literal hex byte and kept all rows. No forecast, score definition, parameter, date, line or horizon changed. The complete date file hashes, original request receipts and scores are preserved.

Run `python3 replay.py` for an independent standard-library reconstruction from the stored cuts. It checks 10,584 observed profile samples, 52,920 residuals, 480 window-specific scores, 15 daily means and the worst measured case. Maximum metric discrepancy was 2.61×10⁻¹⁷. Maximum observed curve/area/center discrepancy was 1.78×10⁻¹⁵. The replay reads the original forecast bytes and native observation rows. It does not refit an angular model or reacquire telescope data.
