# APG-III ternary adsorption from pure and binary measurements

The positive-site midpoint reduced mean absolute component error on all 27 ternary conditions, from 0.095501 mmol/g for the authors’ rounded Toth–IAST model to 0.081925 mmol/g. Its worst condition block reached 0.142159 mmol/g. A single positive-site distribution fitted to the same calibration data reached 0.123567 mmol/g on that criterion. **The registered joint comparison failed 1 of its 12 tests.** The midpoint improved on the authors’ model under both criteria. At the midpoint’s worst block, 303 K and nominal 500 kPa, the vertex reached 0.101011 mmol/g.

| Model | Equal-block mean absolute error (mmol/g) | Worst block (mmol/g) |
|---|---:|---:|
| Positive-site interval midpoint | 0.081925 | 0.142159 |
| Authors’ rounded Toth–IAST | 0.095501 | 0.162567 |
| Pure-data refit Toth–IAST | 0.095989 | 0.163955 |
| Binary additive IAST correction | 0.098136 | 0.160246 |
| Binary log-ratio IAST correction | 0.096317 | 0.160630 |
| Single minimax positive-site fit | 0.086124 | 0.123567 |
| Independent site-affinity marginals | 0.197909 | 0.423871 |

## What the column measured

Avijegon and colleagues measured CH₄, N₂ and CO₂ on a nominal 31.761 g charge of MOLSIV APG-III. The dynamic column protocol integrates inlet minus outlet component flow through post-breakthrough steady state, applies a helium void correction and converts excess to absolute uptake using assumed adsorbed-phase densities. This analysis predicts those reported protocol-conditioned component capacities. The release gives no rowwise bed identity, regeneration history or independent equilibrium assay. The later chapter’s explicit individual-run purge description concerns a different adsorbent. [Author thesis, chapter 2](https://doi.org/10.26182/5bc56fc9e708b) · [Journal article](https://doi.org/10.1007/s10450-018-9952-3)

Calibration used all 85 pure observations and 108 binary component measurements at 54 mixture conditions. The three temperatures were 333, 303 and 273 K. For all 27 ternary conditions the projection retained only gas fractions, pressure and temperature before forecasts were locked. The PDF parser reads the source container and returns selected text columns. The source report had already disclosed aggregate prior discrepancies. Source records are rounded and several N₂ observations or uncertainties are printed as zero. The authors describe binary discrepancies per species and binary mixture as RMSDs. Their exact denominator remains unresolved. Pointwise maxima and this study's held mean absolute errors answer different questions.

Each of the nine temperature/nominal-pressure blocks contains all three feed compositions and all three species. The intermediate 500 kPa tier has no directly corresponding binary pressure tier. The comparison file preserves its errors, the full N₂ residual sequences and the absolute worst row for every model. The 27 conditions share one nominal apparatus and are the experimental units. No independent-material transfer is tested.

## What the pure and binary faces determine

The exact parity example in `parity.py` uses four equally weighted competitive Langmuir sites in each of two distributions. Each of the three affinities is either 1 or 4. The even and odd parity distributions have identical two-affinity marginals, so every pure and binary loading agrees at every partial pressure. At ternary partial pressures (1,1,1), each species instead has loading 23/80 versus 53/182. This supplies a counterexample within that site class; it does not quantify ambiguity in the actual material.

The numerical fit used 728 grid atoms per temperature and capped total capacity at 13.64 mmol/g. At 333/303/273 K the optimum largest absolute scaled calibration residual was respectively 1.435/1.365/1.561. None fit the complete calibration set within one reported uncertainty, with the prespecified 0.01 mmol/g scale floor. At 273 K the selected solution reached the capacity cap. Following the registered protocol, each envelope uses a scaled-error threshold 0.05 above the larger of 1 and the optimum. Each coordinate extremum is a separate linear program. Their midpoints need not come from one site distribution.

At the previously unmeasured binary pressure tier, the midpoint and author IAST errors averaged 0.092099 and 0.114242 mmol/g. The site envelopes contained only **36 of 81** published capacities at mean width 0.117219 mmol/g. The counts were 12/27 for CH₄, 16/27 for N₂ and 8/27 for CO₂. No entire nine-cell block was contained. The wider empirical IAST bands contained 81 of 81 at mean width 1.401170 mmol/g. These deterministic ranges describe their respective fit assumptions. They have no calibrated probability interpretation. The largest midpoint error occurred at 303 K and 112 kPa, at CH₄/N₂/CO₂ fractions 0.30/0.30/0.40. The published capacities were [0.04, 0.01, 3.33] mmol/g and the prediction [0.073156, 0.012041, 3.882974]. The CO₂ error was +0.552974 mmol/g and its reported uncertainty 0.19 mmol/g.

## Reproduction

Use Python with NumPy, SciPy and Poppler’s `pdftotext`. Download the author's thesis from the link above. The scripts authenticate its exact SHA-256 before scientific extraction. From this directory run `python parity.py` and `python replay.py /path/to/thesis.pdf`. The latter reconstructs all seven arms from calibration, verifies IAST by independent quadrature, then reopens every held row and checks the 63 condition scores, 12 gates and 162 interval memberships. The source receives the seven scientific arms and protocol unchanged from commit `c7f97de062717a8db38bd1f633d53ad665518170`.

The original forecast ZIP SHA-256 is `43d441c0fbd08ae989e4edba9ab84f9d8c7a7d2adef1351630d8b1bc55fb3f0b`. It was uploaded and cold-read back before the separate held scorer started. The original score SHA-256 is `fff782a701c986c8dd175de670dbfa49d1b3d20fc7a64bd6313569c8e1deee60`. The independent reader processes complete Table 11 text rows using scalar arithmetic and checks those exact two original inputs. A new fit may differ in archive bytes across solver and runtime versions. All scientific gates retain their originally registered comparisons.
