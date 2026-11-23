# Paired river stage did not improve discharge estimates across three USGS reaches

An empirical rating fitted to local gage height performed better on all three rivers than a reach-momentum correction to DYNPOUND. Across 79 complete field visits in 2021–2024, the correction's mean absolute error was 0.06100 in the registered transformed discharge units, versus 0.03971 for a static isotonic rating. Input coverage passed; the mean, reach-win, worst-reach and upper-quartile error gates all failed. The 2025–2026 reserve remains unopened.

## What was measured

The target is approved, in-person discharge measured with an acoustic Doppler current profiler (ADCP), in cubic feet per second. Each target is paired with published primary gage-height readings at the target station and its nearest same-named river neighbor among the 34 stations in the companion registry. Station identity, observation procedure and visit identifier come from USGS. Bridge or boat descriptions alone do not establish instrument type. The three reaches are the structural units; visits during one flood can be correlated. Archived readings may have been revised before this study.

| Target river and local gage | Neighbor gage | Direction | Point-to-point distance |
|---|---|---|---:|
| Meherrin at Bryants Corner, 02052090 | Lawrenceville, 02051500 | Upstream | 45.0 km |
| Gasconade at Jerome, 06933500 | Rich Fountain, 06934000 | Downstream | 52.9 km |
| Mississippi at St. Louis, 07010000 | Thebes, 07022000 | Downstream | 168.7 km |

These distances are straight-line proxies. The river course, changes in cross section, intervening tributaries, dams and unobserved downstream conditions can all affect the relation between two gage readings. The registry's NAD27/NAD83 labels are horizontal coordinate datums. The levels at distinct gages have their own vertical references, so only changes in the head contrast relative to the learned training relation enter the correction.

The authentic DYNPOUND event solver was run with the archived code and six released scientific package versions. All 4,744 timestamps in the three author events, for both discharge and stage, reproduced their reference CSVs. Maximum differences were below $3\times10^{-9}$ cfs and $1.6\times10^{-13}$ ft. These comparisons test software reproduction. The study's accuracy test uses direct gaugings. The authors' model uses an initial rated discharge and interpolates missing stage. Its event routine can fall back to the mean rated discharge of the full event when the first rating is absent. The evaluation used the released discharge solver with an explicitly different causal initialization.

## Information available at each prediction

The latest complete UTC hour at or before the field observation defines the issue time. Each method receives the same 25 hourly bins ending then. For each gage and bin, the most recent finite approved instantaneous stage reading must fall within the preceding 30 minutes. Insufficient coverage leads to an unscored row. The registered discharge solver starts at the steady Manning discharge for the first local stage, 24 hours before issue, and advances through the 24 hourly changes using the original DYNPOUND root solver, calibrated cross section, roughness and slope ratio. The source's water-year and flood calibration parameters are inherited. The comparison is a retrospective estimate at field-observation time using an archive, without a real-time data-delivery guarantee. An ADCP transect also has duration.

For a physical interpretation, consider linear, inviscid, constant-depth shallow water with no interior source. A standing wave can have height perturbation $a\sin(kx)\cos(ckt)$ and velocity perturbation $-ac\cos(kx)\sin(ckt)/H$, where $c^2=gH$. At $x=0$, the entire height record is identical to still water while the flux changes. A second height record still misses this mode when both sensors are at nodes. The construction establishes a limit on identification by height alone under unspecified boundary and initial conditions. It supplies no diagnosis of which mechanism occurred at the three gauging stations.

The candidate estimates the velocity perturbation from the linearized momentum equation $du/dt+u/\tau=g\,\delta h/L$. At each hour it subtracts the training-only quadratic relation between local stage and upstream-minus-downstream level from the observed head contrast. It integrates the residual forcing with exponential decay and multiplies the result by the local wetted area. The relaxation time $\tau=U/(2gS)$ uses the reference Manning velocity and bed slope. A single nonnegative gain at each site scales this correction to a calibrated local DYNPOUND prediction. The fitted gains were 2.40625, 0 and 0.5 in the table's site order. Gasconade therefore retained the calibrated local prediction exactly.

The seven competitors were steady Manning discharge, the original discharge solver under the causal initialization, its training-calibrated output, a static local-stage isotonic rating, local ridge, paired-gage ridge and paired-gage gradient boosting. The ridge and boosting settings were selected by omitting entire training years. A wrong-sign ablation used the same gain with reversed forcing and remained outside the candidate ranking. The submitted forecaster is included as `forecast.py`; it consumes the physical feature manifest identified in `custody.json`.

## Transfer result

All 2015–2020 training gaugings were eligible under the same instrument and clock policy. Of 228 eligible training timestamps, 181 provided complete paired histories. The development period contained 88 approved timestamps in 86 visits. Eighty-one timestamps in 79 visits supplied complete histories. Each score is the absolute difference after transforming discharge with `asinh(Q / scale)`, using the site's median absolute training discharge as the scale. Times are averaged within visit, visits within site, and three sites equally. The upper-quartile score averages the largest ceiling of one quarter of the visit losses at each site. The best pooled competitor was selected among all seven predeclared controls. Equal-weight upper-quartile errors were 0.11473 for momentum and 0.08482 for isotonic.

| Reach | Complete / eligible visits | Momentum | Static isotonic | Momentum / isotonic |
|---|---:|---:|---:|---:|
| Meherrin | 22 / 26 | 0.06899 | 0.04123 | 1.6733 |
| Gasconade | 15 / 17 | 0.08234 | 0.04774 | 1.7247 |
| Mississippi | 42 / 43 | 0.03168 | 0.03016 | 1.0503 |

The calibrated single-gage solver scored 0.05787 pooled, the local ridge 0.04370, the uncalibrated DYNPOUND core 0.08586, the steady operator 0.08631, paired ridge 0.06536 and paired boosting 0.07711. The wrong-sign diagnostic scored 0.05960. On the Mississippi the paired ridge achieved 0.01851 and steady geometry 0.01885. A second gage can contain predictive information on a particular reach even when this fixed physical correction loses the pooled comparison.

| Largest momentum error at each site | ADCP | Forecast | Local stage over 24 h | Neighbor stage over 24 h |
|---|---:|---:|---:|---:|
| Meherrin, 2023-06-26 14:17:14 UTC | 1,310 cfs | 906.20 cfs | 8.93 to 8.91 ft, peak 9.12 | 5.33 to 3.54 ft |
| Gasconade, 2022-03-03 19:19:46 UTC | 4,170 cfs | 3,527.04 cfs | 4.60 to 4.55 ft | 5.15 to 5.21 ft |
| Mississippi, 2024-06-05 16:26:42 UTC | 444,000 cfs | 385,279.78 cfs | 23.22 to 23.70 ft | 29.72 to 29.47 ft |

All four accuracy conditions failed. The mean had to improve by 5% over the strongest pooled comparator, the candidate had to win two of three reaches, the worst reach ratio had to be at most 1.10, and the upper-quartile ratio had to be at most 1.10. The qualifying reserve roster contains 8, 9 and 16 direct ADCP timestamps. Its stage and discharge values were never requested.

## Clock and evidence checks

Version 1 of the USGS field API separates the UTC date in `time` from the offset-bearing `time_of_day`. The initial input procedure falsely treated its date as an observation instant. A uniqueness check first stopped on a same-day repeated visit. A second run excluded colliding date keys and produced midnight histories; all of its prediction errors were withdrawn. The clock correction was frozen before any development discharge was opened. Matching the full UTC timestamp to the archived NWIS observation date, local time and time-zone code gave exact second agreement for all 231 modern records within the legacy files' coverage. Six further records postdate those files. All accepted ADCP keys were unique using the full timestamp.

The board-archived prelabel forecast holds all 262 successful training/development rows, nine methods and 54 input refusals. A separate worker verified the board copy before the development discharge request. Another receiver fetched the direct development observations and recomputed every site/method score, coverage count, worst observation and gate using 65-digit decimal arithmetic. A fourth recovered all 150 hourly stage observations for the three largest physical-candidate errors. The larger original-worker export remained without an observed terminal result during preparation. Its job and original worker remain recorded in `custody.json`. The portable replay uses the independently retained forecast, approved observations and worst trajectories.

Run `python3 research/dynpound-paired-stage/replay.py` using Python's standard library. Add `--live` to compare the frozen 88 observations with the same approved USGS rows. The local replay verifies all 729 scored forecasts, 27 site/method mean and tail pairs, raw RMSEs, worst cases and each frozen decision. It does not rerun the upstream stage history acquisition or nonlinear solver. Source and reference units are reported as released.

[USGS report](https://doi.org/10.3133/sir20245129) · [Model archive](https://doi.org/10.5066/P9X7QZFG) · [Site registry](https://doi.org/10.5066/P955QRPQ) · [USGS API v1 clock changes](https://waterdata.usgs.gov/blog/api-v1-release/)
