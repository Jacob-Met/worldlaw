# A held-bath test of a graphene bridge’s gate-response shape

Direct transfer of the measured gate-response shape beat resistance-weighted transfer on the complete reserved 20 K bath sweep. For the electrical labels independently supported by the published plot, the full-sweep errors were **0.03988 and 0.08874**, respectively. The physical arm failed both registered comparisons under both electrical assignments. Its error was lower than the constant-Lorenz Wiedemann–Franz control’s 0.16069. All these errors are dimensionless and allow the same one fitted positive gain per complete forecast.

## What was measured

Waissman et al. measured changes in the hot and cold graphene Johnson-noise temperatures as they varied the gate voltage on a monolithic graphene bridge. Figure 2a supplies those two measured signals, H and C, in kelvin. The electrical panel in Fig. 2b supplies resistance R, in kΩ. The article describes the separate electrical measurement, the heating-frequency doubling and the fixed gates of the thermometer regions. The three baths are measurements of one specimen. A shared voltage coordinate does not demonstrate simultaneous acquisition or independent noise across plotted curves.

All 181 gates at 5 K and 121 gates at 30 K in the common domain −7 to +5 V supplied the training inputs. Both 20 K noise signals stayed sealed at every one of the 121 gates until all sixteen forecasts were frozen. The original all-donor protocol stopped at thirty 5 K resistance NaNs between +5.0667 and +7 V. The separately registered common-domain successor retained every held point and used no imputation. The article’s qualitative description of similar gate trends across baths was known. The derived thermal-conductance and Lorenz-ratio ordinates and all nanotube ordinates remained closed.

The paper maps blue, yellow and red to 5, 20 and 30 K. The archived hot and cold graphics use those colors. The archived electrical axes instead use three shades of blue. Length identifies the 5 K sweep, while 20 and 30 K have identical gate positions. Matching only the published electrical panel gave RMS line-position differences of 0.217 and 0.219 points for dark-blue=20 K, versus 1.185 and 1.375 points for the opposite assignment. The independently known 5 K match was 0.235 point. One unused cross-color comparison was undefined due to the long donor’s missing tail. Both assignments remained binding.

## The unknown gain

The ideal lossless spatial model gives a hot peak rise of 1.5H, a cold peak rise of 2C and an inferred heat current of (2/3)G_c C. Substituting bridge conductance L(g,T)T/R yields the gate relation $H-4C/3=s_T C R/L(g,T)$. A gate-independent multiple of L can be absorbed into the unknown positive bath gain. The target is the relative gate shape of these measured signals. The observations and scoring convention do not identify absolute heat current, absolute Lorenz numbers or a microscopic transport mechanism.

Each arm predicts a full gate vector V(g). On the held sweep the receiver forms Y=H−4C/3 and U=C·V, with V first normalized to unit RMS. It fits one nonnegative scalar s for the complete relation Y=sU and divides the residual norm by the norm of Y. Five equal-width gate segments share this same fitted gain. The largest segment RMS is divided by the full-sweep Y RMS. Both use trapezoidal gate-voltage weights and every held point. This formulation avoids pointwise division by either C or a temperature difference. Because U itself includes the observed cold signal, the score measures an implicit shape relation and cannot predict an absolute cold-temperature rise at an uncalibrated bath.

The physical arm estimates each donor’s relative inverse-Lorenz gate shape with a local regression of Y against CR. It mixes the normalized 5 and 30 K estimates in a 40/60 ratio, then restores the independently measured held resistance. The flexible control searched 24 exponent/width combinations using reciprocal donor-to-donor comparisons. Both electrical assignments selected zero exponent and 0.35 V width, reproducing the direct gate-shape control. The two frozen protocol files specify all arms, norms, intervals and refusal thresholds.

| Model | Full, dark=20 K | Worst segment, dark=20 K | Full, light=20 K | Worst segment, light=20 K |
| --- | ---: | ---: | ---: | ---: |
| Resistance-weighted transfer | 0.08874 | 0.13420 | 0.10471 | 0.17063 |
| Constant-Lorenz Wiedemann–Franz | 0.16069 | 0.23629 | 0.17089 | 0.26031 |
| Constant gate vector | 0.39789 | 0.53494 | 0.39789 | 0.53494 |
| Direct donor shape | 0.03988 | 0.05225 | 0.03988 | 0.05225 |
| 5 K physical donor only | 0.16631 | 0.25994 | 0.17582 | 0.28228 |
| 30 K physical donor only | 0.04505 | 0.06443 | 0.06263 | 0.10451 |
| Donor-selected exponent and width | 0.03988 | 0.05225 | 0.03988 | 0.05225 |
| Gate/resistance ridge | 0.07048 | 0.12171 | 0.08016 | 0.14250 |

## Worst held gates

For dark=20 K the largest signed physical residual was +0.29421 K at −0.9 V. H was 1.38273 K, C was 0.0397964 K and R was 1.22876 kΩ. Y was 1.32966 K; the scaled physical term was 1.03545 K. The direct-transfer residual there was +0.12226 K. Under the alternative assignment the largest physical residual was +0.38612 K at −1.5 V, with H=1.38304 K and C=0.0321157 K. These residuals apply to the cross-multiplied temperature expression. The full-sweep cancellation ratio was 0.90859. The physical-arm design ratios were 0.36091 and 0.37675, both above the frozen engineering threshold of 0.02.

The immutable 41,978-byte forecast bank has SHA-256 `fff81752e7684f4c1d3b27036e367448a2e7ac5ab70118d2bb880e1198b6037d`. An independent reader used SciPy to decode the published Fig. 2a temperatures without importing the producer’s MAT parser. It made 7,936 numerical checks of the vectors, residuals, worst gates, conditioning and scores, with maximum absolute difference 1.43×10⁻¹⁴. The 172,480-byte outcome retains all raw gate values, normalized predictions and residuals for both assignments.

## Reproduction

Run `python3 replay.py` with NumPy 2.2.6 and SciPy 1.15.3. It authenticates both frozen artifacts, checks the recorded values against fresh author temperature data, and reconstructs all forecasts and scores. The producer inflates whole graphics files and interprets only permitted scientific numeric fields. The forecast path never interprets the 20 K temperature ordinates. The independent reader loads the eligible Fig. 2a file after the lock. The optional `electrical_registration.py` uses `pdftoppm` and writes the electrical-only image in the working directory. The related [nanotube source audit](../waissman-graphene-thermal-secants/README.md) concerns a different specimen and a separately closed question.

[Published measurement](https://doi.org/10.1038/s41565-021-01015-x) · [Figure archive](https://doi.org/10.5281/zenodo.5500449) · [Published figure and calibration equations](https://par.nsf.gov/servlets/purl/10378224)
