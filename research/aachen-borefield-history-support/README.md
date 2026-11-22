# Which historical borehole loads can the Aachen field release identify?

The E.ON ERC field contains forty 100 m double-U exchangers connected to three underground vaults. This study asks whether the released observations support a comparison of predictions for individual boreholes, conditioned on the recorded field-wide inlet temperatures and flow rates, with a full year of measured interwell heat history. A geometric alternative uses differences between two wells to cancel unmeasured heat sources. Both questions concern one operating field.

**None of the 365 prespecified development issues has a complete preceding year of measured all-field heat history.** Across 631,296 five-minute bins, only 287 met even the optimistic forty-well heat-support rule. All 287 occurred in June 2024. The conditional forty-well boundary requirement also had zero eligible five-minute bins during development. Ground-response and outlet-prediction error therefore cannot be scored under the registered full-field protocol. The underlying recorded temperature magnitudes were never decoded in this study. Models using imputed inlet temperatures, reconstructed schedules, subsets of wells or latent initial conditions can address different prediction questions.

| Source interval | Five-minute bins | Possible forty-well heat bins | Possible forty-well forcing bins | BHE26 operating-flow bins without a prepared inlet |
|---|---:|---:|---:|---:|
| Jul 2018–Jun 2021, initialization and training | 315,648 | 0 | 0 | 235,929 |
| Jul 2021–Jun 2022, development | 105,120 | 0 | 0 | 30,259 |
| Jul 2022–Jun 2024, subsequent availability only | 210,528 | 287 | 288 | 150,883 |

At the very first development issue on July 1, 2021 at 00:00 UTC, all five affected wells (13, 26, 29, 33 and 35) had an unavailable prepared inlet. Each had ten finite nonnegative raw flow readings and at least one reading at or above 0.5 L/min in that bin. The longest uninterrupted sequence for BHE26 spans 23,405 bins, from August 17, 2018 at 12:50 UTC through November 6 at 19:10 UTC (last bin label). For the frozen development issue dates, a failed complete calendar month entirely inside the trailing 365 days suffices as an exclusion witness. The first and last issues have June 2021 and May 2022 as their latest such complete months. The two independent archive readers agree on all 360 month × affected-well operating/missing counts.

## Measurement and timing

The authors release 72 monthly 30-second files and 72 corresponding five-minute files from July 2018 through June 2024. Each file contains time plus inlet temperature, outlet temperature and volumetric flow for each of forty probes. Both archive MD5 digests and the coordinates/connector-length table are checked before analysis. The raw timestamps carry a UTC offset. In the preprocessing source, pandas groups five-minute intervals by their left endpoints and computes a mean over available rows, then rounds to two decimal places. A label at 00:00 represents the interval from 00:00 inclusive to 00:05 exclusive. The 00:00 and 00:05 labels occur in every monthly member. Two independently averaged temperatures multiplied by an averaged flow do not recover a samplewise heat integral in general.

The source masks observations below 0.5 L/min and applies a flush delay following off-flow or sufficiently long gaps. It also applies six dated sensor masks. For example, the mask for the inlet of BHE26 covers July 1 2018 through **midnight** June 30 2024 inclusive. The code compares against the parsed midnight at the end date. Positive flow below the threshold, reported zero, missing flow and missing temperature are counted separately. A raw zero reading supplies a *recorded-flow convention* for zero transported heat, subject to meter resolution. The vault sensors and uninsulated connecting lines of different lengths limit inference about an individual downhole fluid temperature.

## Information available at the issue time

The fixed daily issue time is 00:00 UTC. July 2018–June 2021 was designated for initialization and calibration, July 2021–June 2022 for development and July 2022–June 2024 for a sealed response comparison. All arms would receive the measured inlet temperature and flow during the following 24 hours. This defines a forcing-conditioned response experiment. At issue time, the operator's future schedule has not been established from the release. Historical measured outlet and heat may enter only through intervals ending by the issue time. Measured outlet temperatures during the response interval are reserved for scoring.

The published same-field four-model comparison selected wells 17, 18 and 28 close to their vaults. Its November 2018 and mid-July to mid-August 2020 comparisons and its four-year winter-2018-to-spring-2023 comparison were already publicly described. The authors fitted initial ground temperature on a 10–14°C range and also studied calibration durations from one to 364 days. Those are distinct from the 12°C initial state in the released solver example and from the proposed split. The field began operation in 2011, well before the public six-year series. The original paper already describes incomplete load history.

## Physical and numerical controls

Using the released parameters (ground conductivity 2.3 W m⁻¹ K⁻¹ and volumetric heat capacity 2.3 MJ m⁻³ K⁻¹), the nearest-neighbor spacing across the surveyed field is 8.936–14.527 m. The diffusion scale r²/(4α) is 231–611 days. This is a characteristic scale, not a propagation cutoff. A week of measured workloads alone cannot capture the subsoil thermal state accumulated since 2011. On the closest pair the archived ground solver's one-day and one-year responses to a sustained 1 W/m neighbor load are about 7.30×10⁻¹⁰⁴ K and 0.01377 K, respectively.

The untouched Düber v1.0.0 prescribed-inlet/flow path was evaluated at the two nearest bores on 72 synthetic five-minute steps. With uniform 12°C initial and boundary conditions, including ten zero-flow steps, the original 0.000005 K equilibrium-drift gate failed: the measured maximum was 0.0000409147 K. A separately registered 0.0005 K test (one hundredth of the authors' stated 0.05 K readout increment) subsequently passed. Warm/cold inlet pulses of ±2 K produced outlet excursions +1.34219156/−1.34219271 K relative to the uniform run, identical pre-pulse predictions, and a maximum antisymmetry defect of 0.0000418031 K. These numerical checks do not validate predictions on the monitored installation.

## An independently testable geometric remedy

The archived Düber simulation couples the inside-borehole RC/finite-volume model to an isotropic ground response. For a uniform geometry and thermal properties, the off-diagonal wall transfer for source j and receiver i depends on their distance. With equal source distances, the contribution of any piecewise load history cancels in the difference of the two wall temperatures.

Using exact decimal coordinates, wells 24 and 25 have identical squared distances to well 26 (80.6229 m²) and to well 33 (572.4898 m²). The archived full-scale radial kernel returns equal values for each pair at all seven evaluated lags from 30 to 2,190 days. Well 29 has squared distances of 323.7565 and 82.2649 m² to these receivers. A sustained unit line load at well 29 changes their modeled wall-temperature difference by −0.0125314 K after 365 days and −0.0335058 K after 2,190 days. These are *per 1 W/m step* sensitivities. No unobserved physical load magnitude is assigned. The unit-load sensitivity establishes that a missing source can survive this contrast. The two receivers also have different horizontal pipe lengths (40 m and 23.5 m). Equal source-distance cancellation is a statement about the ground term.

There is a broader exact limitation for **fixed linear contrasts in the ideal infinite line-source model**, with arbitrary independently varying unknown sources. For an off-source receiver at distance r, the step response is proportional to E1(r²/(4αt)). Differentiation in t gives exp[−r²/(4αt)]/t. If a fixed contrast annihilates the contribution for every positive lag, the coefficients of these exponentials must sum to zero within each equal-distance class. To see this, multiply by t and let 1/t tend to infinity after dividing by the slowest decaying exponential. Its grouped coefficient must vanish. Remove that group and repeat. The same result follows on any open lag interval by analyticity. Distances from well 35 to each other receiver are all distinct in the released survey. Thus a fixed contrast across those receivers which annihilates *arbitrary* independent well-35 histories has all coefficients zero in this model. The argument does not quantify the size of typical leakage, establish a singular value for a finite sampling grid or exclude history-dependent estimation. The separate finite-line/cylinder source calculations above use the actual released program.

## Reproduce

Python 3.11, GCC with C++17, numpy 1.23.5, scipy 1.10.1, matplotlib 3.7.5 and pandas 2.2.3 run the two independent readers, exact daily witnesses, untreated physical solver and contrast checks. From the repository root:

```sh
uv run --no-project --python 3.11 --with numpy==1.23.5 --with scipy==1.10.1 --with matplotlib==3.7.5 --with pandas==2.2.3 -- python research/aachen-borefield-history-support/replay.py --cache /tmp/aachen-public-source
```

The release consists of about 654 MB of compressed measurement data. The cache stores verified public source archives only. The portable receiver checks all monthly histograms against the original SHA-256, repeats the independent Pandas count from the source files, and checks the 365 issue certificates and seven-lag radial responses. The first reader uses temperature tokens only for availability; the second reads five raw flow columns and five prepared inlet columns as lexical strings for missingness. Neither reader decodes temperature magnitudes. The source and archived model of record are independent of the two implementations here.

## Source references

- Heim et al., six years of 40 borehole measurements, [data release](https://doi.org/10.5281/zenodo.12724484) and [Scientific Data article](https://doi.org/10.1038/s41597-024-04241-9).
- Heim et al., [same-field comparison and calibration](https://doi.org/10.1186/s40517-024-00303-8) and [released preprocessing](https://github.com/elimh/ERC_BHEfield_Data_Code/tree/6fb41ae4aee72b15bcb665d89038d56b6fb8367d).
- Düber et al., [hybrid model](https://doi.org/10.1002/nag.3427) and [v1.0.0 source archive](https://doi.org/10.5281/zenodo.5971257).
