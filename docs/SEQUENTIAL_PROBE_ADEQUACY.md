# WORLDLAW torque-probe model adequacy

A single surviving torque law means that the other offered laws contradict the declared training or probe measurements. An unoffered law can produce the same readouts within the noise bound. All results below come from a virtual instrument. No physical measurements were used.

| Frozen study | Policy | Correct singletons | Incorrect singletons | Empty sets | Measurement count |
| --- | --- | ---: | ---: | ---: | ---: |
| In-family 102001–102100 | Fixed course | 73 | 0 | 0 | 162 |
| In-family 102001–102100 | Adaptive | 95 | 0 | 0 | 122 |
| Mixed law 113001–113100 | Fixed course | 0 | 45 | 6 | 195 |
| Mixed law 113001–113100 | Adaptive | 0 | 72 | 6 | 160 |
| In-family 124001–124100 | Adaptive | 94 | 0 | 0 | 125 |
| In-family 124001–124100 | Adaptive with confirmation | 94 | 0 | 0 | 200 |
| Mixed law 124001–124100 | Adaptive | 0 | 86 | 1 | 141 |
| Mixed law 124001–124100 | Adaptive with confirmation | 0 | 79 | 8 | 199 |

The fixed-course comparator uses the original two-state chooser when it recommends a strictly separating pair. Otherwise the benchmark takes the first offered pair as an explicit fallback. On seeds 102001–102100 the original chooser recommended 38 pairs. Both policies identified 38/38 in these cases, with 56 fixed versus 42 adaptive readings. On the 62 fallback cases, fixed identified 35 using 106 readings and adaptive identified 57 using 80. All 22 additional identifications came from fallback cases. The original chooser would abstain on those cases.

Each row represents 100 studies with at most two unit-cost readings per study. The mixed mechanism was −0.35 × rate − 0.35 × sin(angle). Neither single-feature candidate represented it. For confirmation after an early singleton, the instrument chose the remaining offered state with the largest midpoint gap from the nearest originally admitted rival. The second reading counted against the same budget. Seven additional mixed mechanisms were rejected at the cost of 58 additional measurements. A singleton still remained in 79 mixed cases.

The in-family comparison used one ambiguous training fixture and six offered states per seed. Its gain describes discrimination within that declared catalog and generator. It does not estimate physical reliability. Taskboard preregistrations 144498, 144663 and 144687 specify the three cohorts and selection rules.
