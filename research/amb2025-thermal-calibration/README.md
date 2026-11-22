# Single-track fusion geometry and surface-temperature identifiability

Six cross sections from three repeated bare IN718 calibration tracks at NIST rule out a common surface-flux model before any AMB2025-07 pad temperature is used. The published mean fusion zone was **137.8 µm wide and 125.1 µm deep** below the original plate surface. An isotropic, constant-property half-space heated by a straight, circular Gaussian surface source must produce a zone at least twice as wide as it is deep. The largest published width including expanded uncertainty is 143.7 µm. Twice the smallest depth including expanded uncertainty is 225.0 µm.

Two physically admissible fits to the measured width and depth gave different predictions for surface time above melting. A separate area measurement on the same sections distinguished the fits. A model with a Gaussian distribution of heat deposited below the surface predicted **12,413.69 µm²** of fused material below the plate surface, consistent with all six conservative area intervals. A model with increased normal thermal diffusivity predicted **13,517.82 µm²**, exceeding even the total segmented area in every section. These shapes were checked against the same six exposed calibration sections. Their surface cooling rates and melt times are model predictions. **No held pad temperature, answer table, or entrant array was scored.**

## What the official task measures

The 2025 FLaMI experiment uses 285 W, 960 mm/s and a Gaussian spot diameter of 72 ± 3.5 µm, equivalent to four standard deviations for an ideal Gaussian. Bare ground IN718 starts at 22 °C. The calibration track is approximately 8 mm long and sectioned near its middle. Separate 5 × 5 mm and 1 × 5 mm bare pads use alternating scan directions, 110 µm hatch spacing, 80 µm beam offset and 0.75 or 5 ms laser turnaround. NIST measured the non-melting scan paths independently.

The camera sampled 640 × 480 pixels at 48 kHz with a 19 µs exposure and 14.3 µm/pixel. The organizer adopts emissivity 0.5 and the 1260–1336 °C solidus–liquidus range. For each eligible surface point, the organizer takes the **longest contiguous interval above 1298 °C**. It evaluates the falling 1260-to-1150 °C crossings on that same peak. We report positive cooling-rate magnitudes `110/(t1150−t1260)`; with cooling times in ascending order, the literal written subtraction in §3.1.2 gives the opposite sign. Our single-track receiver records the four crossing times so either convention can be read back. It does not purport to resolve the sign convention of an unavailable winning entry.

The challenge asks participants to provide the full spatial TAM and solid cooling rate arrays on a uniform surface grid with at most one million locations, alongside the valid counts, means, medians and standard deviations. §4.3 describes additional distributional comparisons and leaves awards to the committee. Its public text supplies no unique formula for calculating a historical rank. These derived maps, the calibration data manifest, and an authenticated 2025 winner configuration are distinct requirements for a matched full-panel comparison.

## The geometric limit

Assume a flat surface, uniform initial temperature, homogeneous constant properties, and an otherwise insulated half-space. Let the scanning circular Gaussian surface source have nonnegative power and its centre remain on the longitudinal axis. The melt boundary is the same temperature level everywhere. At any given longitudinal position, each source contribution of age `s>0` is positive. Its transverse spatial factor at the surface a distance `r` off the centreline is `exp[−r²/(4αs+2σ²)]`. Its centreline depth factor at `z=r` is `exp[−r²/(4αs)]`. The transverse term is at least the depth term at every age, including changing laser power or longitudinal speed. The result survives integration, reflection about the centreline, taking a maximum over time, and measuring the transverse bounding box. Thus `W ≥ 2D`.

In Table 5 the observed values of `2D−W` were 113.0, 113.6, 114.4, 108.0, 109.2 and **115.8 µm**. The sixth section was 137.6 µm wide and 126.7 µm deep. The quoted uncertainties of 5.9 µm for mean width and 12.6 µm for mean depth have coverage factor two. The interval comparison above is an arithmetic statement about the reported marginal uncertainty bounds. It does not assign a joint coverage probability.

For a diagonal surface-source model with different normal and transverse diffusivities, the same ordering gives `W ≥ 2D√(α_y/α_z)`. The mean shape would require `α_z/α_y ≥ 3.297` within that model family, or at least 2.452 at the conservative interval extremes. The data alone do not identify an anisotropic material property.

The surface-temperature limitation is exact. For any prescribed surface flux history, hold the volumetric heat capacity and lateral diffusivities fixed, replace `α_z` by `λ²α_z`, and multiply the absorbed fraction by `λ`. The new field is `T_new(x,y,z,t)=T_old(x,y,z/λ,t)` whenever the adjusted absorbed fraction is admissible. This follows from the normal heat-kernel factor `exp(−z²/(4α_zs))/√α_z`, or by direct substitution into the heat equation and Neumann boundary condition. Every surface temperature and surface-derived crossing time stays identical. A change of depth-dependent deposition can alter those observables.

## Prospective models and independent numerical receiver

Task post 178209 fixed the three model families and the permitted calibration data before fitting. Posts 178145 and 178238 retain the access boundary and additional area/temporal checks. We used the external 1400 K IN718 thermophysical-property values `α = 5.19 mm²/s` and `k = 25.32 W/(m·K)` from Agazhanov et al., with effective constant volumetric heat capacity `C = k/α`. These are external specimen measurements, not a determination of the specific FLaMI plate's thermal properties. All three models use the same Gaussian in-plane standard deviation of 18 µm. The full width and original-plane depth were fitted at 1260 °C. The dimensions below use µm or µm² as indicated.

| Model | Absorbed fraction | Depth parameter | Width, µm | Depth, µm | Below-surface area, µm² |
| --- | ---: | --- | ---: | ---: | ---: |
| Isotropic Gaussian surface flux | 0.391510 | Isotropic | 137.80 | 63.86 | 6,900.30 |
| Depth-stretched surface flux | 0.766975 | Normal stretch 1.959018 | 137.80 | 125.10 | 13,517.82 |
| Gaussian volume deposition | 0.647985 | Normal standard deviation 64.814 µm | 137.80 | 125.10 | 12,413.69 |

The volume deposition has a nonnegative half-Gaussian normal profile and the same lateral beam. With Neumann reflection, its normal kernel has variance `h² + 2α_zs`. The producer fitted absorbed fraction and normal scale to the two specified geometry numbers. Area, temperature extrema, and crossing times played no part in selection. A second implementation used composite Simpson integration in square-root lag and polar integration of the fused cross section. On increasing its last two resolutions, the maximum area change was 0.0165 µm². The earlier area check failed its 3 µm² tolerance, with a 3.4292 µm² change for the volume model. Its native receipt is preserved.

The segmented area includes the bead above the original plate. If `A` is total segmented area, `W_s` is its bounding width and `H_b` is measured height above the surface, the below-surface fusion area lies in `[A−W_s H_b,A]`. All six measured intervals and the original six total areas are retained in the receiver. The volume model passes this necessary test on the published numbers. NIST gives no segmentation-area uncertainty budget, so we attach no statistical rejection level to the observed misses. Direct integration of a verified section mask could give a more precise below-surface estimate. Matching the bound does not establish a physical normal deposition profile.

| Distance from centreline, µm | Surface / stretched TAM, µs | Volume TAM, µs | Surface / stretched cooling, MK/s | Volume cooling, MK/s |
| ---: | ---: | ---: | ---: | ---: |
| 0 | 601.234 | 772.369 | 1.9130 | 1.1726 |
| 17.225 | 583.565 | 750.407 | 1.9129 | 1.1690 |
| 34.450 | 526.660 | 678.181 | 1.9052 | 1.1526 |
| 51.675 | 408.790 | 516.907 | 1.8429 | 1.0922 |

The most extreme raw prediction is at the single-track centre. The unclipped surface model peaks at **25,835.4 °C**, and the volume model peaks at **6,907.6 °C**. These simple constant-property models omit vaporization, flow, surface deformation, temperature-dependent properties and latent heat. The peaks expose that limitation directly. The timer differences demonstrate distinguishable model predictions given equal fitted width and depth. They supply no measured temporal winner.

## Why the held comparison stopped

NIST names the first-place team as Vijaya Holla, Philipp Kopp and Stefan Kollmannsberger and reports seven entries. The public GitLab project pinned at `9a754a717b43309b83561da72fd1d29ac61d17da` contains four scan files from the team's separate published EOS/IN625 experiment. Its drivers use an 85 µm spot, and its thermal class fixes 8440 kg/m³ density, 280 kJ/kg latent heat, 1290/1350 °C phase thresholds, 0.54 absorptivity and 20 °C initial temperature. The paper reports cumulative time above melt. The 2025 FLaMI target, its alloy, paths, beam diameter and longest-excursion definition differ. No authenticated 2025-07 submission deck or associated forecast array was found in the screened public releases. This is bounded by the checked sources and commits. We did not build the IN625 code or present it as an IN718 winner replay.

NIST's DataCite record for `10.18434/mds2-3707`, version 1.1.1, combines calibration and answers. The nominal challenge documentation identifies allowable single-track material and nonmelting scan data. The two original native source reads returned HTTP 502 and 503 for the PDR catalogue and landing service. The official distribution listing timed out. This prevented a verified separation of actual trajectory/template files and full eligible measurement arrays from the combined release. The indexed organizer description supplied the six calibration rows. A direct binary read of that design PDF returned HTTP 403, so an independent binary hash of the organizer PDF is unavailable. The published summary of the challenge results is explicitly partial.

## Reproduce the bounded result

Run `python3 verify_receipts.py` for an offline source-identity, geometry, gauge, temporal-crossing and scope check. To recompute the three fits use `python3 fit_calibration.py` with NumPy. For the independent numerical method use `python3 calibration_receiver.py` with the JSON value of `convergence["384"]` from `calibration-fit.json` as its sole argument. All six native original jobs, both failed attempts, and their resource receipts are retained. Total process wall time was 46.432 s, CPU time 37.784 s, and peak largest waited process 200,753,152 bytes. These exclude queueing and publication.

The calibration geometry and scoring definitions come from NIST Sections 2.2–2.3, 3.1 and 4.3. Property values and historical solver provenance are independently traceable.

- [NIST benchmark design and Table 5](https://www.nist.gov/system/files/documents/2025/12/18/AMB2024-06%20and%2007%20challenge%20descriptions_v3.pdf)
- [NIST challenge data and DOI catalogue](https://www.nist.gov/ambench/direct-am-bench-data-links-and-referencing-guidance)
- [NIST benchmark submissions and awards](https://www.nist.gov/ambench/am-bench-2025-challenge-submissions-and-awards)
- [Independent measured IN718 properties](https://doi.org/10.1088/1742-6596/1382/1/012175)
- [Earlier published team solver](https://gitlab.com/hpfem/publications/2025_laser_turnaround_simulation_AM/-/tree/9a754a717b43309b83561da72fd1d29ac61d17da)
- [Thermal-model paper for the earlier IN625 experiment](https://doi.org/10.1007/s40964-025-01147-9)
