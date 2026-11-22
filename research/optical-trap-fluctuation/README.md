# Can quiet optical-trap fluctuations predict a driven bead recording?

Rescaling the same bead’s measured small-drive waveform gave a date-balanced two-channel error of **0.007845** on the larger drive. The positive-lag covariance predictor gave **0.160513** and lost all eight registered comparisons. All 15 beads on the six reserved later dates remain unopened. The outcome is an error in the measured detector coordinates, in electrode voltage divided by gain times summed detector voltage.

| Frozen predictor | Mean across dates | Worst date |
| --- | ---: | ---: |
| Small-drive waveform, scaled by 1.6 | 0.007845 | 0.011573 |
| Small-drive fit from the author’s log-slope estimator family | 0.019224 | 0.025705 |
| Instantaneous step to the predicted plateau | 0.041950 | 0.048357 |
| Quiet covariance, zero-lag reference | 0.042386 | 0.045339 |
| Quiet covariance, 0.3 ms reference | 0.160513 | 0.193781 |

The study uses Skidmore, Rajasekharan and Farrell’s fluorescent bead calibration in saline. The release description reports 153 beads on 69 days. Its pinned file list contains one calibration program and **134 distinct bead archives on 58 dates**. The three source years contribute 46, 35 and 53 archives. The available records did not identify the other 19 beads or 11 dates. The linked 2017 instrument-methods chapter predates the 2019 records. We could not assign identities or years to the unlisted acquisitions. The development set included all four public beads on the first acquisition date in each year, with 15 beads on the final two dates of each year reserved and 115 additional archives untouched. [Author data and program](https://zenodo.org/records/3333905) · [Instrument methods](https://doi.org/10.1007/978-1-4939-6646-2_12)

## What a forecast could use

Each bead supplies separately recorded planned commands of −500, +500, −800 and +800 nm. We used only the two smaller-amplitude acquisitions and the recorded gain to construct forecasts. All five predictors issued both components at each of 51 nominal sample phases for both larger commands. The predictions for all four beads were independently stored and read back before the eight larger-drive recordings were scored. A second raw projection, with different accumulation and indexing, reproduced the observed targets and plateaus to 1.39 × 10⁻¹⁶.

The authors record two displacement voltages and summed intensity at 200 kHz. Their program sets a 16,000-sample period and nominal step index 4,000. We average complete periods, form the author’s signed detector ratios and subtract each measured waveform’s neutral mean over indices 1,000–2,999. This subtraction is part of the scoring target. The held waveform supplies no input to its own forecast. The fitted equilibrium shift is 1.6 times the signed small-drive plateau displacement (indices 7,000–8,999 minus the neutral window). This is an assumption about a measured detector signal under a larger nominal command. The archive has no independently recorded trap-center trajectory to establish its actual rise time or physical displacement.

The released program estimates a displacement scale from all four commands. Its interactive log-residual slope fitting begins with the first sorted command, ordinarily −800 nm, then reuses the chosen interval for the other slopes. Using the stored small-drive slopes would therefore import information from a larger drive. Our comparator applies the author’s log-residual regression to each smaller drive on the prospectively fixed interval 4,100–4,599. The fitted slope multiplies the relevant predicted two-channel plateau. All comparators share the same small-drive information.

For each command the error is the square root of the mean squared Euclidean distance over the 51 points, from nominal 0 through 5 ms. We average the two commanded signs within bead, then the beads within date. Dates receive equal weight. The positive-lag predictor had to beat all four comparators on both the date mean and the worst date to open the reserved cohort. A bead, date and complete acquisition are distinct experimental units. Repeated square-wave periods supply signal averaging.

## What happened at the largest error

On 13 June 2013, bead 2, +800 nm, at index 4,460 (nominal +2.3 ms), the measured vector was **(−0.214247, −0.025840)**. The positive-lag forecast was **(+0.051762, −0.083692)**, giving a Euclidean error of **0.272227**. Its inferred remaining displacement was (−0.268121, +0.057653), large enough to reverse the first component after subtraction from the small-drive predicted plateau. The rescaled small-drive waveform predicted (−0.209745, −0.028294) at the same index. The complete 51-point traces of every arm are in `dev1.json`.

The reference covariance at 0.3 ms had singular values 0.000369793 and 0.000343710 in squared detector-ratio units. Its condition number was 1.076. Across eight contiguous groups of complete small-drive periods, the largest spectral-norm deviation from the full reference was 0.000019366, or 5.63% of the smaller singular value. Even- and odd-period estimates reproduced the incorrect leading sign. The block spread describes these recordings and has no confidence-level interpretation.

The two off-diagonal terms at this lag were +0.000310578 and −0.000317396. The spectral-norm distance to the nearest symmetric matrix is exactly half their absolute difference, 0.000313987. This exceeds the largest observed block deviation by a factor of 16.2. A stationary reversible position process viewed through an instantaneous linear detector has symmetric population lag covariance. The measured lag relationship departs substantially from that approximation across these blocks. Detector memory, cross-channel phase, residual forcing and changes in optical response remain possible contributors.

## Why both covariance references matter

For a stable, fully observed linear Markov state driven toward a known new equilibrium displacement Δ, the step response is `[I−P(t)]Δ`. Its stationary noiseless covariance obeys `C(t)=P(t)C(0)`. Temporally independent additive readout noise contaminates the zero-lag covariance while leaving positive lags unchanged. In that special case `C(t+v)C(v)⁻¹` recovers the propagator when the reference is invertible. The experiment linearizes both normalized detector coordinates about the lower-drive neutral plateau and subtracts the phasewise ensemble mean. It estimates lag covariance entirely within each source-defined neutral window.

A bead and detector with first-order poles a and b give a different result. The unit-step complement and normalized stationary covariance can both equal `[b exp(−at)−a exp(−bt)]/(b−a)`. For equal unit poles and t=v=1, the unshifted covariance complement is 2/e while the positive-lag ratio is 3/(2e). Interchanging the two poles and scaling the driving noise amplitude by b/a preserves both the driven and stochastic linear transfer functions. Without independently calibrated diffusion and readout, neither these equations nor this experiment identifies the bead pole, proves a fluctuation–dissipation mechanism, or measures trap stiffness.

## Reproduction

Run `python3 replay.py` from this directory with standard Python. It checks the four locked forecast hashes and the four complete records, reconstructs 4,080 component forecasts’ residuals, checks all eight decisions, and verifies the worst two-channel trace and the pole-exchange example. The authentic whole-record archive hashes, native timing, script digest and output bindings are in `provenance.json`.

To reconstruct a bead from its original HDF5 archive, use NumPy 2.2.6 and h5py 3.13.0. Run `python3 forecast.py source.h5 prediction.json` first. The independent score invocation is `python3 score.py source.h5 prediction.json observation.json`. The original course waited for all four forecast locks before scoring any bead. `raw_receiver.py` provides a separate raw target projector, and `tail_diagnostic.py source.h5 dev1.json` reproduces the contiguous-block diagnostic on the June 2013 bead 2 source. No model was refitted after the development scores were received.
