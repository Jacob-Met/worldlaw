# Can an interfacial resistance improve capillary rise-speed forecasts?

A two-resistance model improved on the calibrated inverse-square law for micropipette rise speed in agarose gels. It lost to a simpler predictor that reused the training speed from the nearest measured tip radius. On 20 later measurements the root-mean-square log errors were **0.4460** for the two-resistance model and **0.4123** for nearest radius. The proposed model won three of five formulations and failed the two registered improvement gates.

## What the experiment measured

Datar, Ryssy, Toivonen and Backholm raised a hydrogel toward a fresh dry glass micropipette. Their early-regime observable is the slope of a line fitted to meniscus height versus time below 500 µm, where the authors treat the radius as approximately constant. The supplied workbook gives that fitted speed, its error, the measured tip radius and its error. The measured speed is in m/s. Different tips sampled different gel locations. Dates group the archived records. The paper describes two independently manufactured samples per concentration; the measurement workbook supplies no per-row plate identity. These scores characterize transfer between recorded dates within a formulation. They cannot assign a difference to a particular batch, indentation, pressure or location. [Article](https://doi.org/10.1039/D6SM00056H) · [Experimental release](https://doi.org/10.5281/zenodo.16908708)

Five formulations have at least two date blocks. The first date within each supplied 11 calibration measurements, and all subsequent dates supplied 20 evaluation measurements in six blocks. The calibration dates differ between formulations, so this is a retrospective split within each group. The five measurements in the one-date, 2% agarose++ group remained unscored. This material also had a distinct indentation protocol. The selected position traces and the concentration-gradient and puddle outcomes remained unopened; the paper's already published qualitative conclusions, static liquid property summaries and Table 1 bulk estimates supplied prior information. We used neither interface permeability derived from each observed speed nor the source worksheet's derived effective surface-tension column as a predictor.

| Formulation | First date | Calibration tips | Later dates and tips | Mixed log RMS | Nearest log RMS |
|---|---|---:|---|---:|---:|
| 0.3% agarose++ | Apr 10 | 2 | Jul 6, four | 0.6134 | 0.5589 |
| 0.5% agarose++ | Apr 10 | 4 | Apr 25, two | 0.4591 | 0.1851 |
| 0.7% agarose++ | Jun 27 | 2 | Jul 3, five and Jul 9, two | 0.4374 | 0.4960 |
| 1% agarose++ | Apr 11 | 2 | Apr 16, four | 0.1932 | 0.2529 |
| 0.5% agarose | Aug 13 | 1 | Aug 14, three | 0.4230 | 0.4396 |

## The model and its geometric limit

Author Eq. (1) uses a pressure drop across a distance proportional to the tip radius, with capillary pressure proportional to the inverse radius. It gives rise speed proportional to permeability times surface tension times contact-angle cosine, divided by viscosity and squared radius. We evaluated both a calibrated formulation amplitude and a wholly speed-independent version using the published Table 1 bulk permeability estimates and composition-level liquid properties. The latter is a proxy for the interface. The paper inferred those bulk values from water-content measurements on other samples. It assumed common liquid properties for the stiffer agarose++ formulations. Static contact angles come from puddle experiments.

The alternative places porous spreading resistance proportional to the inverse tip radius in series with an areal surface resistance proportional to the inverse squared radius. With normalized radius `r = R / 20 µm`, the resulting speed is `A_g / ((1−w) r² + w r)`. Its limits recover the calibrated spreading and layer laws. The fitted amplitudes absorb formulation-specific pressure and material factors. Individual site permeability, independent layer thickness and local driving pressure were unavailable.

The fixed-radius range itself limits what can be learned about curvature. For `x=log(r)`, the second derivative of log speed is `−z(1−z)`, where `z=(1−w)exp(x)/(w+(1−w)exp(x))`. Its magnitude is at most 1/4. The straight secant in log coordinates therefore approximates the curve with absolute log error at most `(xmax−xmin)²/32`. Across the observed radii within each scored formulation the largest corresponding multiplicative gap is 0.648%, in the 1% formulation. A separate power law per formulation can therefore approximate this shape closely on its observed interval. This bound refers to point radii and a freely chosen secant per formulation. The competitive power-law comparator below used one fitted exponent shared across all five. The reported radius standard deviations are descriptive uncertainties. Unknown site-dependent amplitudes can absorb the radius dependence exactly when each tip is measured at a fresh location.

## Frozen comparisons and errors

Each trial used its own measured radius and formulation. The calibrated shapes estimate each formulation amplitude from its first-date speeds, using geometric means in log space. The joint calibration assigned each formulation equal weight. It selected `w=0.785` on the 201-point grid. A shared free power exponent selected −1.16 on the 401-point grid from −4 to 4. The per-formulation shrinkage control regularized its log slope toward −2 with a fixed strength of 0.04. Nearest radius used training observations from the same formulation, with workbook row order breaking ties.

| Predictor | Equal-formulation/date log RMS | Largest absolute log error |
|---|---:|---:|
| Two resistances | 0.4460 | 0.8027 |
| Calibrated author inverse-square | 0.4959 | 0.8104 |
| Pure layer, inverse radius | 0.4361 | 0.8024 |
| Constant per formulation | 0.4159 | 0.8011 |
| Nearest radius | **0.4123** | 0.9031 |
| Shared free exponent | 0.4433 | 0.8026 |
| Shrunk per-formulation exponent | 0.4712 | 0.8037 |
| Author law with bulk estimates | 1.2916 | 2.2270 |

The score averages squared log errors first over tips within a date, then over dates within a formulation, then over formulations, and takes a square root. The locked forecasts covered all 20 eligible tips. The 5% improvement against every comparator and four-of-five formulation win gates both failed. The largest-error guard passed against the strongest pooled comparator. The largest candidate error was July 9, 0.7% agarose++, workbook row 13. The tip radius was 21.323 µm with reported error 1.5231 µm. Measured speed was 26.82 µm/s with fitted slope error 0.31 µm/s. The candidate gave 12.0186 µm/s, nearest radius 10.87 µm/s and the separate bulk-input model 22.7983 µm/s. The fitted slope error omits between-location variation. The full 160 forecasts and all 20 speed/error observations are in `scores.json`. There is no IID uncertainty interval over tips.

## Replay

Download `Capillary Rise Gels.xlsx` (31,084 bytes, SHA-256 `d805c0bcf02de00231635aa999c41416dcdd35a5632fd2507dc350ce63ff3d88`) from the pinned experimental release. Use Python 3.11 or newer and a new empty output directory.

```sh
python3 replay.py '/path/to/Capillary Rise Gels.xlsx' /tmp/datar-replay
```

The producer generated the complete 160-forecast packet before its scoring process read later speeds. The original packet SHA-256 is `43a6dd9f6b3fa74cc64cd4fc2e5020365234c91976b27496e77a99e1ca7aa603`. The independent receiver reads the five eligible worksheets and reconstructs all forecasts, each material-level and aggregate error, every maximum, and all four registered gates with 46-digit decimal arithmetic. Its first version required the raw XML decimal strings to equal the producer's serialized decimals. Some strings map to the same binary64 value with different decimal spellings. The final receiver checks exact binary64 equality for that serialization boundary and keeps the original decimals for its independent calculations. The original refusal and positive replay refer to separate native jobs.

An earlier source qualification examined Lunowa et al.'s accompanying capillary software. Its README explicitly identifies the distributed numeric CSVs as model-generated replacements for the restricted original Heshmati–Piri measurements. No CSV values from that archive entered this experiment. The agarose release is a separate apparatus and question.
