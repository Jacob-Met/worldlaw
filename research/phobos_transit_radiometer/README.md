# Observed-current transfer of Phobos eclipse cooling at InSight

The absolute-current halfspace model lowered mean error from 0.301395 K for the pre-event trend to 0.186168 K across two archival transits. It beat instantaneous, integral, exponential and source-template controls on both dates. **The registered joint gate failed.** The source-selected fractional exponent was exactly one half, producing identical predictions, and a prespecified illumination control reached 0.094274 K. The three events come from the same week, instrument and far footprint on Mars.

## Which measurements resolve a transit?

The public engineering tables timestamp many spacecraft channels asynchronously. Two hardwired solar-array strings, E-0771 and E-0791, supply simultaneous current samples in amperes. Each has a 9999.900-A missing code. SCET_UTC dates spacecraft acquisition, whereas ERT_UTC is the later Earth reception time. The derived HP³ radiometer product reports temperature in kelvins at the far spot, FoV 2. All six transits had 172 or 173 radiometer rows in the ±180-s window, about 2.09 s apart.

| Sol | Geometric duration (s) | Current samples per string within transit | Study role |
|---:|---:|---:|---|
| 96 | 26 | 1 | Waveform unresolved |
| 97 | 28 | 1 | Waveform unresolved |
| 99 | 23 | 1 | Waveform unresolved |
| 498 | 36 | 9 | Evaluation |
| 499 | 28 | 7 | Evaluation |
| 501 | 27 | 7 | Calibration |

The lone early-season samples fell −2.392, −5.477 and +10.916 s from the corresponding minimum-angular-separation UTC. The later four-second sampling of the two strings constrains the illumination waveform only at the recorded instants. The two strings and viewing apertures provide no independent event replication.

## Frozen predictions

All nine roles use sol 501 for calibration, equal-weight string currents and independent pre-event linear baselines for current and far-temperature on −90 to −25 s. The extractor reads the original PDS file, then permits only baseline temperatures from evaluation events during prediction. Contemporary event currents supply the observed driver. The 27 forecast arrays, including calibration, were locked as 21,799 bytes at SHA-256 `d17bf0f730396e757f0111e8a747b3a5004dd36c9b9d81919b68f9be9ff49fe6` before either evaluation suffix was scored.

The halfspace feature integrates zero-order-held current cooling deficits with an inverse-square-root elapsed-time kernel. It has a single nonnegative source-fitted gain. The fractional bank contains the same kernel. The elevation control divides each current deficit by its own pre-event current and multiplies by the sine of published solar elevation. Scores below are RMSE in kelvins from first contact through +60 s. The final column weights the two evaluation dates equally.

| Model | Sol 501 calibration | Sol 498 | Sol 499 | Evaluation mean |
|---|---:|---:|---:|---:|
| zero | 1.458355 | 0.131311 | 0.471480 | 0.301395 |
| instantaneous | 0.971121 | 0.115757 | 0.393554 | 0.254655 |
| integral | 0.794170 | 0.094579 | 0.341693 | 0.218136 |
| halfspace | 0.257193 | 0.084801 | 0.287535 | 0.186168 |
| fractional_selected | 0.257193 | 0.084801 | 0.287535 | 0.186168 |
| exponential_selected | 0.525623 | 0.085650 | 0.304563 | 0.195106 |
| phase_template | 0.000000 | 0.095347 | 0.290348 | 0.192848 |
| normalized_halfspace | 0.257193 | 1.142479 | 0.271650 | 0.707064 |
| solar_elevation_halfspace | 0.257193 | 0.087229 | 0.101319 | 0.094274 |

The largest evaluation error for the absolute-current halfspace was on sol 499, +0.224 s: 267.15 K measured and 267.610866 K predicted. At that instant the elevation arm gave 267.372600 K, the phase template 267.543498 K and the pre-event trend 267.816048 K. Sol 498 slightly favored the absolute-current model over the elevation arm. Its worst miss occurred at +18.882 s, where 236.58 K was measured and 236.732319 K predicted. The larger sol 501 calibration miss at −4.167 s was +0.651321 K, with 291.14 K measured. Both whole held episodes and calibration are included in `forecast.json` and `score.json`.

Pre-event currents at sols 498/499/501 were 0.007500/0.048927/0.186771 A and elevations 9°/34°/81°. The large change in amplitude supports evaluating how the proxy is normalized. Absorbed ground flux, true between-sample illumination, atmospheric scattering, terrain incidence and radiative losses remain uncertain. This comparison does not identify a unique subsurface structure.

## Reproduction and literature scope

Published temperature extrema and aggregate fitted results were exposed before this archival comparison. Mueller et al. fitted sol 501 using modeled SPICE light curves, scattering, diurnal boundary conditions and a layered subsurface model. No freshly executed score relative to that richer-input model is claimed. The present models are offline predictions conditional on contemporaneous observed current.

Run `python3 replay.py .` for the independent decimal recount of stored predictions and targets. Add `--source` to independently reread and authenticate the original PDS quarter. That read recovered all 107 temperatures, 963 residuals, 81 per-role metrics, 27 worst rows and nine evaluation means. Max decimal/float difference was 4.58e−14 K. The earlier per-URL DNS diagnostic, first timing-reader DNS failure and JHU catalog API HTTP 403 remain in source custody.

[Transit timing and currents](https://doi.org/10.1029/2020GL089099) · [Layered thermal model](https://doi.org/10.1029/2021GL093542) · [Radiometer calibration](https://doi.org/10.1029/2020EA001086) · [NASA radiometer archive](https://pds-geosciences.wustl.edu/missions/insight/hp3rad.htm) · [NASA engineering archive](https://pds-ppi.igpp.ucla.edu/data/insight-ifg-mars/data-sc-engineering/)
