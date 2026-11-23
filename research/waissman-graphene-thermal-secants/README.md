# What the published carbon-nanotube thermal secants constrain

The released gate sweeps do not supply an equilibrium thermal-conductance curve to integrate through a finite heating excursion. We closed the proposed equilibrium-to-finite-bias test before reading any numeric plot ordinate. The source audit identified 16 MATLAB figure files, their exact hashes, axis labels and data-array shapes. No empirical heat-current or model-accuracy score was calculated.

## Measurement contract

The experiment uses graphene Johnson-noise thermometers at the ends of a carbon nanotube. The independent cold-side self-heating calibration and the measured cold noise-temperature rise give the authors’ inferred bridge heat current. In the lossless model this is $Q=(2/3)G_C\Delta T_C$. The reported bridge conductance also uses the temperature difference at the interfaces. In the idealized spatial model, hot and cold peak rises differ from their respective noise-weighted averages. The authors describe the CNT thermal quantities as lower bounds because the exposed thermometers lose energy. A finite excursion of one reported noise temperature does not give both interface temperatures.

| Archived figure | Source observation or transformation |
| --- | --- |
| 3b, Device 1 | Gate sweeps at bath temperatures 20, 40 and 70 K, each at a hot noise-temperature rise of 10% of bath temperature. |
| 3c, Device 2 | Gate sweeps at 5, 10 and 15 K, with fractional rises 0.5, 1 and 1, respectively. The authors report 30 mV DC across the nanotube to overcome the contact barrier. |
| 4a | Inferred heat versus normalized hot-side rise. Device 1 has two conditions, 70 K at 0 V and 40 K at −10 V. Device 2 has one, 50 K at −19.4 V. The plotted Device 2 ordinate has a factor of 20. Each run has a plotted fit. |
| 4b | Replots the three 4a conditions and includes two additional conditions. The vertical offset uses a fitted model parameter. |
| 4c | Reports fitted exponents versus resistance. |

The Fig. 4a header has two curves apiece at 125, 156 and 182 samples, consistent with the reported data/fit pairs. Header shapes alone do not assign every graphics primitive a physical role. The sixteen-file main-text deposit contains no separately labeled numerical cold-interface temperature history alongside these three sweeps. The monolithic graphene bridge in Figs. 1–2 is another specimen. The known publication-level statements about superlinear transport and fitted exponents were exposed during source qualification. The plotted powers were never used to select a law.

## Exact limit for a favorable ideal experiment

Suppose the temperatures at both ends are known, every heat-current measurement is exact, and a fixed contact and gate obey $J(a,b)=F$b$-F$a$$ with increasing $F$. This is the endpoint-separable class. With a differentiable potential and a genuinely measured equilibrium conductance $G(T)=F'(T)$, $J$ would equal its temperature integral. The figure measurements at finite imposed excursions constrain differences across finite intervals. The following examples grant exact cold temperature equal to the bath and hot temperature equal to the reported average. Each target excursion $T\to 1.5T$ is an illustrative synthetic query. It is not a claim about any particular plotted acquisition point.

| Idealized source intervals in K | Synthetic query | Source-unobserved interval inside query |
| --- | --- | --- |
| [20,22], [40,44], [70,77] | 40→60 | (44,60) |
| [20,22], [40,44], [70,77] | 70→105 | (77,105) |
| [5,7.5], [10,20], [15,30] | 50→75 | (50,75) |

Choose one uncovered interval $(a,b)$ from the last column. Let $H=0$ below $a$, $H=1$ above $b$, and $H=3u^2-2u^3$, with $u=(T-a)/(b-a)$, inside. Its derivative is $6u(1-u)/(b-a)\ge0$ and vanishes at both boundaries. For any compatible increasing base potential, adding $A H$, $A\ge0$, preserves every stated source difference because both endpoints of each source interval lie on the same plateau. Each query difference increases by exactly $A$. Thus there is no finite upper bound in this class from these source observations alone. This reasoning also applies to intervals that overlap one another away from the support of the added derivative.

The runnable witness uses the synthetic base $F(T)=T$ and exact fractions for three amplitudes. Its source and query values carry arbitrary heat-current units. It proves neither a physical unbounded-current property of any CNT nor failure of either author fit. A calibrated gain bound, smoothness magnitude, finite number of channels, or a separately justified dispersion law could restrict the class. Each would require its own source evidence. Learning a descriptive gate dependence from other published plots would answer another question.

## Reproduction and custody

Run `python3 secant_witness.py` for the exact synthetic controls. Run `python3 project_schema.py` for the authenticated remote source inventory. The projector verifies each whole-file SHA-256 as well as the publisher MD5, inflates MATLAB containers, and reads array structure and character labels. It never interprets numeric XData, YData or CData elements. Numeric dimensions, type tags and class metadata are part of the projection. All sixteen files must reproduce their archived labels and shapes. Only Python’s standard library is required.

The native ledger retains the original argument validation refusal and all four terminal jobs, including the first parser failure on a legal empty MATLAB matrix. The successful source parser added empty-child handling before reading flags. The independent scientific evidence here consists of authenticated publisher metadata and the conditional exact counterexample. No held experimental efficacy or mechanism identification follows from this audit.

[Published article and heat-balance convention](https://doi.org/10.1038/s41565-021-01015-x) · [Public manuscript with supplementary methods](https://ciqm.harvard.edu/uploads/2/3/3/4/23349210/waissman_submitted.pdf) · [Author figure deposit](https://doi.org/10.5281/zenodo.5500449)
