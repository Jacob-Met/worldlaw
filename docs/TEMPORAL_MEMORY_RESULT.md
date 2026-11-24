# An exact causal memory representation did not identify the projected Lorenz law from these recordings

One unobserved Lorenz coordinate can be replaced by an exponential memory of observed position squared. This yields the exact symbolic lift in the [frozen protocol](TEMPORAL_MEMORY_PROBE.md), including at zero position. The fit searched 13 decays and learned the other coefficients from two noisy training recordings. A third whole recording selected the decay. Every test forecast used only its first 11 observed states and scheduled commands, then ran 390 steps open loop.

| Frozen mechanism | Local cubic | Local plus transient | Wrong history plus transient | Causal memory plus transient |
|---|---:|---:|---:|---:|
| Projected Lorenz, mean full relative error | 1.103593 | 1.067760 | 1.027862 | 1.298205 |
| Projected Lorenz, first 50 steps | 0.856386 | 0.861829 | 0.731955 | 0.754081 |
| Matched memoryless cubic, mean full error | 3.551301 | 0.174041 | 0.131833 | 1.389686 |

These nine noise realizations per mechanism reuse one test command profile. They do not represent independent laws. On the projected Lorenz world the causal memory won 1/9 against the local cubic, 0/9 against the transient and 0/9 against wrong history. No Lorenz arm diverged. Three local-only fits and one causal-memory fit diverged on the matched cubic; the registered penalty of ten is included. The extra donor trace in the wrong-history arm is drawn only from training.

The worst causal-memory Lorenz forecast was the 25 dB record with seed 73021. At forecast step 135 it predicted position and velocity (12.6934, +85.2114); the independent simulator returned (10.8202, −80.5871). The selected decay was 1.0, learned memory coefficient −4.8749 and fitted prefix transient −345.55. Across the nine records, selection spanned 0.25–16. The 15 dB matched cubic with seed 73001 diverged after 120 of 390 predictions even though its true law is local. A causal coordinate exists algebraically, but this observation and fitting scheme did not reliably recover it. This experiment neither calibrates discovery abstention nor improves the active-PDE benchmark.

[Hosted original 45313669592](https://github.com/Jacob-Met/worldlaw/actions/runs/45313669592) passed the three source controls and returned 37 files in artifact 14883709811 (674,034 bytes, SHA-256 `eff1c1127faea6aee9f98e470ee0c78e4ed49963570d79e0be236089e2565d86`). The frozen scientific gate was false. A [separate hosted readback](https://github.com/Jacob-Met/worldlaw/actions/runs/45313971990) fetched those immutable outputs without re-fitting and independently reproduced 144 full/short scores from all 72 trajectories and the paired decision.
