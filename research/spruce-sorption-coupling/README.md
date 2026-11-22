# What the spruce sorption curves identify

Two ordered populations of moisture-sorption sites can match both published major isotherms at every relative humidity and retain different amounts of water after the same reversal. For the ideal equilibrium path from dry wood up to 95% RH and down to 72% RH, the sharp interval over all such populations is **0.142301255830 to 0.162129407882 kg water per kg dry wood** (endpoints rounded). The width is 0.019828152052 kg/kg. This is a property of the constitutive model class. The four experimental dishes were exposed for finite times, so their measured masses need a transport model as well.

The planned test of finite-rate storage across the observed fan disturbance and three faster humidity cycles remains **unscored**. The authors publish the parameters of the two boundary curves in the workbook. They refer readers to a separate paper for the fitted IPM scanning-curve shape. The public presentation establishes that the authors modified this shape and tested the IPM and Frandsen models. Its text extraction gives neither that modification nor its numerical fit. The registered independent comparator could not be reconstructed from the authenticated materials. A retrospective sheet includes measured endpoint references and estimated curves for these experimental dishes. All four challenged mass series remain unopened.

## The coupling calculation

Let A and D be the published increasing major adsorption and desorption moisture-content functions. Parameterize the sites by moisture mass q from zero to 0.2968 kg/kg. Assign each site an activation humidity X with cumulative mass A and deactivation humidity Y with cumulative mass D, subject to Y ≤ X. After the stated reversal, the wet sites satisfy X ≤ 0.95 and Y ≤ 0.72.

Pairing equal cumulative ranks gives the upper endpoint, min(A(0.95), D(0.72)). A second explicit pairing shifts seven disjoint equal-width rank intervals cyclically. On the six forward shifts the code proves D(X)−A(X) > 0.016, so the shifted deactivation threshold stays below activation. Moving the last strip to the first preserves the order as well. This rearrangement preserves each whole major curve and changes the equilibrium return from 0.162129407882 to 0.150129407882 kg/kg. The exact change is 3/250 kg/kg.

The directional coupling theorem gives the sharp lower endpoint D(0.72)−min(D−A), with the minimum taken over [0.72,0.95]. The program uses rational upper and lower bounds for each exponential. On 180 humidity subintervals below 0.90, it proves the gap exceeds its value at 0.95. On the remaining 50 subintervals, it proves the derivative of the gap is negative. The formulas use the four-decimal author coefficients as decimal constants. The archive reader also exposes the full Excel serialization, which can differ in its last displayed digits. A separate Decimal implementation assigns each finite bin's activation mass to the oldest or newest still-available deactivation mass. All 200-, 1,000-, and 4,000-bin runs reproduce both endpoints within the certified 12-decimal intervals. These equilibrium witnesses need no measured validation mass. [Nutz and Wang, *The Directional Optimal Transport*](https://arxiv.org/abs/2002.08717)

## The measured experiment

The workbook identifies four weighed dishes, each carrying two radial or two tangential specimens. All specimens have nominal 5 mm transport depth. Their actual dimensions and individual dry masses are in sheet 1. The two bottom thermocouples were installed in a separate dish that the authors explicitly never weighed. These measurements support neither a thickness-scaling experiment nor a same-specimen mass-to-heat forecast.

The boundary record contains 65,230 consecutive one-minute ambient measurements. Relative humidity ranges from 0.699468 to 0.974830, ambient temperature from 22.171 to 23.636°C. The averaged surface mass-transfer coefficient was measured independently by evaporation from water-filled dishes. It changes at minute 37,530 from 0.01348845 to 0.00701399 m/s; the prescribed fourth-cycle split occurs later at minute 38,880. A main piping fan failed during that cycle, and its actual humidity history differs from its intended command. The reported cup permeability applies above 70% RH and is effectively common to radial and tangential wood there. Two ambient minutes fell slightly below 70%. Any future transport evaluation would need to check its own predicted material states against that domain.

| Prespecified time window | Scheduled weighings per dish | Complete weighings per dish |
| --- | ---: | ---: |
| Three slow cycles, before 648 h | 73 | 73 |
| Disturbed fourth cycle, 648–1016 h | 33 | 33 |
| First rapid cycle, 1016–1040 h | 12 | 11 |
| Second rapid cycle, 1040–1064 h | 11 | 11 |
| Third rapid cycle, 1064 h through the last observation | 9 | 9 |

The authors missed the weighing at 1032 h for every dish. The audit preserves its scheduled row and records the four missing cells. Time rounding to the instrument minute changes no recorded time by more than 1e−7 minutes. Sheet 2 contains wood-only masses corrected for assembly and blind-sample changes. Raw individual balance traces are absent from this workbook.

Appendix A contains 50 formula links from its equilibrium table directly to five experimental sample columns, including follow-up observations. Another 65,230 pairs of hard-coded coordinates are labeled as estimated scanning curves averaged over SR2, ST1 and ST2. The audit reports their labels, counts and formula references without converting those values to numbers. Sheet 3 (thermocouple differences) is never opened. The data article, separate shape-calibration paper and archived workbook have different evidentiary roles. [Public workbook](https://doi.org/10.17632/dbfdm6sy6x.1) · [Acquisition methods](https://pmc.ncbi.nlm.nih.gov/articles/PMC11372379/) · [Separate scanning-curve calibration](https://doi.org/10.1063/5.0164047)

## Reproduction

All commands use the Python standard library. The public audit authenticates the complete archive and workbook before reading approved sheet fields. The worksheet parser inspects raw XML and the presence/type of the four mass cells; it never uses their numerical values.

```sh
python audit_source.py
python coupling_witness.py
python sharp_interval.py
python discrete_recount.py
```

Use `python audit_source.py --archive PATH` with an unmodified local copy of the public archive. The source-audit.json and independent-receipt.json files record the original input projection and the independently executed discrete calculations. The registration fixed the disturbed cycle, all three rapid cycles and all scheduled weighings before any mass values were interpreted.
