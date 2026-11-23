# Can a local image of intermittent flow predict pressure across two sandstone plugs?

At five mixed brine/decane injection settings, reusing the low-rate resistance at the same water fraction predicted the high-rate result more accurately than conditioning on a local image of intermittent occupancy. Mean absolute error was **2.340** for the same-fraction reference and **3.935** for the occupancy forecast. The proposed resistance intervals contained **two of five** pressure-derived targets, below the registered requirement of four. Treatment of the last printed digit cannot change this coverage.

Gao and colleagues imposed 0.02 and 0.5 mL/min in two successive experiments on one Bentheimer assembly. This study uses their low-rate observations for calibration and their high-rate image summaries as forecasting inputs. Their published qualitative finding of greater intermittency at high rate was already known. We preserved all 56 numerical predictions before inspecting the seven high-rate permeability pairs. The five mixed settings constitute the primary comparison. Zero and one water fractional flow are supplemental settings with a single injected phase and possible residual fluid.

## What was measured

The pressure taps span an upstream diffuser plug and a downstream sample, together 60 mm long and 4.99 mm in diameter. The imaged region near the downstream outlet is a 4.26 mm diameter, 4.8 mm long cylinder, about 5.8% of the two plugs' geometric volume. The hour-long scan measures spatially averaged phase occupancy over that interval. The authors averaged line-loss-corrected pressure over the final two hours of each 10–20 hour constant-rate setting. The plugs underwent washing and oven drying between the two experiments. The seven settings share the same physical assembly.

The primary endpoint is dimensionless apparent whole-assembly resistance, reconstructed from the two rounded relative permeabilities in Gao et al., Table 2. Both coefficients come from one differential pressure observation by equation 11. With oil and water viscosities 0.838 and 0.822 mPa·s and their mean 0.830 mPa·s, the resistance is

\[
Y=\frac{1}{\mu_{\mathrm{ref}}(k_{ro}/\mu_o+k_{rw}/\mu_w)}.
\]

At the high imposed rate, one unit corresponds to 10.37681 kPa using the authors' measured single-phase permeability of 2.045 × 10⁻¹² m². Dimensional values below are reconstructions with the central calibration. Printed-coefficient intervals cover rounding only. Calibration uncertainty, including the reported ±0.056 × 10⁻¹² m² for permeability, remains separate. The calculation uses no raw pressure time series. Capillary number follows from imposed pump rate and fluid properties.

## Prediction and controls

The source curve interpolates the seven low-rate resistance observations linearly in water saturation, with constant tails. One source-only diagnostic illustrates its limitations. Withholding the low-rate 0.30 fractional-flow setting gave 15.237 from its neighbors against 12.093 observed.

The proposed model assumes that, under fixed imposed total flow, instantaneous resistance follows that source curve at the relevant saturation. Published stable-water and stable-oil fractions define a local saturation range under the segmented occupancy interpretation. Published water saturation supplies its mean. The minimum and maximum mean response over all distributions with that support and mean are attained by mixtures of at most two saturation states. The code checks the interval endpoints and interior calibration knots, plus mass concentrated at the mean. It forecasts the midpoint, which minimizes the largest absolute deviation over this model interval.

Whole-cell pressure depends on capillary transients and the unobserved upstream geometry. Neither the duration of the two-hour pressure record nor its spatial support matches the local image. The numerical interval bounds only the assumed mean of the low-rate resistance law. Local phase marginals cannot determine whether remote channels connect at the same time.

Two controls use the authors' measured inlet-to-outlet connectivity from the segmented image. The stable-oil control scales oil conductance by the ratio of stable connected oil volumes. The permissive control includes the entire intermittent region when computing the connected numerator. Both scale the water contribution by the ratio of high/low water saturation and use the same pump fraction. At 0.85 the reported connected-oil fractions for both definitions are zero despite nonzero imposed oil flow. These are empirical mobility proxies. The remaining controls use the same pump fraction, the mean saturation, the endpoints alone, cyclically reassigned supports, or the full unit support.

## All settings

| Water flow fraction | Pressure-derived Y | Reconstructed kPa | Occupancy prediction | Conditional interval | Same-fraction signed error |
|---:|---:|---:|---:|---:|---:|
| 0.00 | 1.781 | 18.478 | 3.257 | 3.257–3.257 | +1.476 |
| 0.15 | 9.410 | 97.648 | 17.097 | 14.589–19.604 | +2.295 |
| 0.30 | 18.590 | 192.903 | 15.821 | 12.221–19.422 | −6.496 |
| 0.50 | 19.610 | 203.486 | 15.556 | 11.924–19.187 | −1.093 |
| 0.70 | 18.794 | 195.026 | 15.278 | 12.392–18.164 | +1.536 |
| 0.85 | 16.835 | 174.692 | 15.187 | 13.006–17.368 | −0.281 |
| 1.00 | 14.782 | 153.385 | 14.353 | 14.353–14.353 | −0.428 |

| Method | Mixed-setting mean absolute error | Maximum absolute error |
|---|---:|---:|
| Same water flow fraction | 2.340 | 6.496 |
| Mean saturation | 3.153 | 10.157 |
| Cyclically reassigned support | 3.668 | 6.811 |
| Connected oil plus intermittency | 3.776 | 8.569 |
| Occupancy midpoint | 3.935 | 7.687 |
| Full support midpoint | 4.471 | 5.686 |
| Endpoint switching | 6.050 | 7.686 |
| Connected stable oil | 10.071 | 17.267 |

Restricting the support reduced average interval width from 11.824 to 5.923. The 0.15 setting shows the cost of that restriction. Stable oil, intermittent occupancy and stable water occupied 0.427, 0.149 and 0.424 of the pore volume. Mean water saturation was 0.528. The reported high-rate permeabilities were 0.092 for oil and 0.015 for water, giving Y = 9.410 and a rounding interval of 9.322–9.500. Even the lower model endpoint, 14.589, exceeded that entire interval. At the same row, absolute errors were 7.687 for the proposed midpoint, 2.295 for same fractional flow, 10.157 for mean saturation, 5.962 for endpoint switching, 9.398 for stable connectivity, 1.817 for permissive connectivity, 6.811 for cyclic assignment and 4.303 for full support. Over all five settings, the candidate's excess mean absolute error over same fractional flow stays between 1.456 and 1.738 across the admitted rounding ranges. The observation count supports a descriptive transfer comparison on this assembly.

## Source and prediction custody

The Table 1 headings use the word “Percentage” for stable oil, intermittent occupancy and stable water. The first frozen receiver at `265d7141` interpreted these numerals on a 0–100 scale and stopped before producing forecasts. All seven triples sum to 1.000. The authors' worked example at 0.50 explicitly treats 0.328 as a fraction of pore volume, 0.339 as stable oil saturation, and 0.308 as the oil contribution within the intermittent phase. The two connectivity columns use percentages on a 0–100 scale. All 63 Table 1 cells match between the JATS table and the Imperial College deposited PDF, page 13. The corrected `8c4d9981` uses the published fraction units. High-rate imaging inputs were known at this correction, while all high-rate Table 2 values remained sealed. The role roster, registered acceptance rules and low-rate training data were held fixed. The trusted parser reads whole XML bytes before selecting the allowed table.

The compressed, byte-exact seven-row forecast entered Git at `2d1ffeca` before scoring. Its uncompressed SHA-256 is `87a7573f28a92492e98123ce96659caa96a3103f5da05b691578fd391fd856d0`. All 56 forecasts and seven physical rows are in `forecast-lock.json` and `score.json`. The BGS guide lists 14 two-phase TXM scans. Dry and initially fully brine-saturated references required by the authors' procedure were not separately listed. The two bounded ZIP-directory reads timed out, leaving embedded or unlisted files unresolved. No voxel reconstruction was attempted.

Run `python independent_recount.py` in this directory for a separately implemented 55-digit reconstruction of 56 forecasts, seven observed resistances, signed errors and the joint gate. An optional second argument after the directory is a copy of the original JATS XML; the reader verifies its complete SHA and independently extracts the seven target rows. Run `python rounding_sensitivity.py` for printing-interval sensitivity. The original receiver accepts `python score_locked.py author.xml forecast-lock.json output.json` and verifies both input hashes.

Sources include [Gao et al., DOI 10.1002/2017WR021736](https://doi.org/10.1002/2017WR021736), the [author-deposited manuscript](https://spiral.imperial.ac.uk/entities/publication/b995354a-d200-49a2-8ce1-9f9aad41b65c), [Europe PMC JATS](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC6175102/fullTextXML), and the [BGS deposited image collection](https://doi.org/10.5285/db27d484-55b9-4897-9f0a-3d7de343d2c6).

Imperial College London gratefully acknowledge permission to publish and funding from the Qatar Carbonates and Carbon Storage Research Centre (QCCSRC), provided jointly by Qatar Petroleum, Shell, and Qatar Science & Technology Park. Qatar Petroleum remain copyright owner.
