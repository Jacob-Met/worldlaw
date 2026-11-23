# Can angular motion predict the signed voltage of an unloaded electromagnetic harvester?

A periodic magnetic-flux model calibrated on 31 resistively loaded trajectories predicted open-circuit coil voltage with **54.41 mV** mean session RMS error. Ignoring the change in electrical load gave **58.89 mV**. A model with the same shared blade coefficients plus five path-dependent terms gave **55.44 mV**. The flux model beat this last control in **three of five** complete open-circuit experiments. The registered requirement was four, so the joint gate failed.

The target was signed voltage integrated over short windows at each of 24 coils. The one missing reference window was retained in the mask. All 108,000 predictions had already been locked before the five electrical files were opened.

## Measurement and source split

The Plaza/Bacaicoa apparatus mounts three moving Halbach magnet assemblies inside a stationary ring of 24 coils. An LED synchronized a housing-mounted camera to electrical recording. Sticker positions give three angular trajectories in the housing frame. Each electrical sample reports the loaded or open terminal voltage. The published power channel is derived from the same terminal voltages and load resistances.

The paper describes 41 runs. The versioned data deposit supplies matched motion and measurement files for 36. Experiment IDs 19, 25, 29, 31 and 34 are absent from both CSV folders. The split at `8b6abafc` used the 31 available loaded runs from IDs 1–36 for development and reserved all five documented open-circuit IDs 37–41. All 62 development files, totaling 18,057,239 bytes, matched the publisher's digests. The five held sessions share one apparatus and three drive frequencies.

The ADC clock in every run has 1,000 rows from 0 to 9.99 s in 10 ms steps. The 31 loaded camera clocks have about 2,400 frames each. The first prospective producer expected 240 Hz and stopped before publishing any prediction. A timestamp-only examination of its retained motion files found 240 Hz for run 37 and 120 Hz for runs 38–41. All five measured camera clocks span the same complete ADC interval. Source `46a28f39` admitted these two uniform grids and retained interpolation against actual timestamps, all coefficients, all five sessions and every registered window. It reproduced 352 legacy feature arrays exactly across 31 loaded trajectories and run 37. The held terminal files remained unopened through this correction.

Nine loaded sessions contained 1,791 of 744,000 released voltage samples at or beyond the methods paper's nominal ±1.65 V converter range. The largest was +2.19 V at t=3.67 s, run 22, coil 13. Run 28 had two NaNs and run 33 one NaN. The initial source fit stopped on these three entries. The subsequent fit omitted three incomplete training windows from the multichannel normal equations. Source validation and held scoring use each available physical interval and coil independently. An unobserved interval never propagates missingness into later integrals.

## Physical model and controls

Let each coil have its own Fourier flux profile for a single magnet assembly. The shared-blade model sums the same profile over the three observed blade angles. Coefficients through harmonic 24 permit spatial variation across the finite coil and magnet apertures. Only a difference between endpoints enters a window forecast. Flux coefficients absorb the winding sign. A separate constant voltage per coil handles steady offset. A closed modeled path has zero integrated flux change **after subtracting** the fitted offset contribution. The experiment does not separately identify magnetic flux constants or the origin of the offset.

With winding resistance Rᶜ, external resistance R, inductance L and load voltage v, integrating the series circuit gives the learned response (up to the calibrated sign)

\[
(1+R^c/R)\int v\,dt + (L/R)\,[v(t_1)-v(t_0)].
\]

The inverse fit uses that loaded expression. In source validation, a forward circuit calculation starts from zero current and uses only motion and the declared load. Validation voltages do not initialize it. At nominal open circuit, the external-current correction vanishes. Finite ADC impedance and any unmodeled electronics still belong to the real terminal measurement. Every final fitted inductance reached the nonnegative boundary at zero. The data therefore support the reported prediction under this calibration but do not provide an independent winding-inductance measurement.

The source distinguishes nominal 100/666/1000 Ω loads from apparatus values of 100/677/993 Ω and reports winding resistance around 100 Ω. We ran both conventions. Three source-only folds rotated whole experiment indices through validation. Every nontrivial model selected ridge 0.01 from the same three candidates and then refit on all 31 loaded runs. The magnet geometry and the paper motivate harmonic 12 for the local field. The published model describes summed squared power. Our seven-parameter signed harmonic-12 extension gives it independent sine/cosine coefficients for each blade and coil. This comparison does not reexecute an author-supplied signed-voltage fit.

The strongest structural control, “shared path,” contains every shared-flux feature plus five permutation-symmetric features for signed winding and cross-angle motion. Its integral can depend on the path. Other controls separate angular-profile complexity, sharing across blades, load conversion, constant voltage and zero voltage. In source validation, the shared-flux and shared-path fits reached 56.47 and 56.78 mV respectively. At the worst shared-flux source cell, run 18 coil 9 from 6.30–6.40 s, measured impulse was −0.04245 V·s and prediction +0.03945 V·s.

## Five open-circuit recordings

Each 9.99 s trajectory contributes 99 windows of 0.10 s and a final 0.09 s window. Raw terminal voltages are integrated by the trapezoid rule at the logged times. For scoring we divide each signed impulse error by its own duration, compute RMS over available coils and windows, and average the five session scores equally. These are offline trajectory-conditioned predictions. The angular observations include future motion within each scored window.

| Model | Run 37 | Run 38 | Run 39 | Run 40 | Run 41 | Mean RMS, mV |
|---|---:|---:|---:|---:|---:|---:|
| Shared periodic flux | 4.91 | 29.27 | 21.10 | 119.53 | 97.21 | **54.41** |
| Shared flux, nominal loads | 4.91 | 29.28 | 21.10 | 119.56 | 97.24 | 54.42 |
| Shared path, five extra terms | 4.86 | 29.08 | 21.18 | 122.71 | 99.38 | 55.44 |
| Independent per-blade flux | 5.16 | 20.54 | 24.19 | 126.36 | 112.41 | 57.73 |
| Shared flux, load change ignored | 6.05 | 33.46 | 26.96 | 123.63 | 104.35 | 58.89 |
| Independent blades and cross-angle path | 5.17 | 20.50 | 25.18 | 133.73 | 116.19 | 60.15 |
| Signed harmonic-12 extension | 10.46 | 53.28 | 32.88 | 184.56 | 173.08 | 90.85 |
| Source coil bias | 10.01 | 55.77 | 41.29 | 187.80 | 177.53 | 94.48 |
| Zero voltage | 10.06 | 55.83 | 41.35 | 187.88 | 177.62 | 94.55 |

Both resistance conventions beat all seven structural controls on the five-session mean. The main forecast beat the load-blind model on all five. Runs 37 and 38 favored the shared-path model. In run 38, the independent-blade path model outperformed both shared constructions with 20.50 mV. These results fail the prespecified four-of-five criterion and leave path integrability unresolved on this specimen.

**Worst signed window.** In run 40, coil 19 from 6.40–6.50 s had 11 reported voltages of 0.01, 0.70, 1.63, 1.65, 1.04, −1.05, −1.97, −1.72, −0.42, 1.01 and 1.25 V. Their net impulse was **+0.01500 V·s**, versus **−0.05513 V·s** from shared flux. The absolute impulse difference corresponds to **0.70134 V** mean-voltage error. The model assigned −0.05513 V·s to the third blade, with the other two blades and fitted bias contributing about zero in total. The sign of the predicted net impulse was wrong even though both observed and predicted within-window voltages changed sign. At this same cell the zero and harmonic-12 controls missed by 0.150 and 0.271 V respectively. Recorded motion and all ten subintervals appear in `held-worst.json`; the electrical bandwidth, calibration and attribution of this individual failure remain unresolved.

Runs 40 and 41 had 452 and 343 released samples at or beyond ±1.65 V, reaching 2.69 V and 2.40 V. No values were clipped in evaluation. The sole missing held voltage, run 41 zero-based sample 984 and coil 17, left 11,999 measured coil-window impulses. The archived rectangular score table uses a zero sentinel at this coordinate together with an explicit missing mask. All receivers honor that mask. Each role has 11,999 observable residuals and 12,000 predictions.

## Reproduction and custody

The 657,738-byte original forecast NPZ was committed at `79287a1e` before any held electrical read. Its SHA-256 is `7be44ab317b7666be7cd88b5b33e0cb606f2fc9250e723b31f7b88815f87cfb5`. `loaded-coefficients.npz` is the actual 31-run fitted artifact. `loaded-development.json` retains every source fold result and ridge candidate. `held-score.json` preserves the original score, per-run/role errors, every worst cell and original observed window integral. The 40-digit independent receiver uses a separate NPY parser and sums the original voltages with Decimal arithmetic. It reproduced 107,991 finite residuals and all 45 worst indices, with 12,143 numerical checks and maximum delta 2.67×10⁻¹⁶.

Run `python independent_receive.py` here to recount the published integral/forecast pairs without third-party packages. To check the original acquisition as well, supply `--raw-dir DIRECTORY` containing the five published measurement CSVs named `37-terminal.csv` through `41-terminal.csv`. The receiver authenticates their original published bytes. The exposure file records every source ID and digest. NumPy is required only for fitting and prediction. Source-data DOI, collection protocol and underlying physical model are publicly documented. [Dataset, CC BY 4.0](https://doi.org/10.17632/y4cmrsdv9f.1) · [Dataset methods](https://doi.org/10.1016/j.dib.2024.111126) · [Physical characterization](https://doi.org/10.3390/s24123813) · [Harvester design](https://doi.org/10.1016/j.apenergy.2023.120715)
