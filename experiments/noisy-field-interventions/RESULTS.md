# Noisy trajectory intervention result

The frozen admission gate rejected committee acquisition. The active arm recovered 122 of 132 in-roster cases. The equal-power random arm recovered 123, and passive SINDy recovered 120. All arms rejected all 144 time-shuffled controls. Each arm admitted two of the twelve hidden-dynamics cases.

| Arm | Correct / 132 | Wrong in roster | Abstained in roster | Sham admitted / 144 | Outside admitted / 12 |
|---|---:|---:|---:|---:|---:|
| Active weak fit | 122 | 2 | 8 | 0 | 2 |
| Random weak fit | 123 | 1 | 8 | 0 | 2 |
| Passive SINDy | 120 | 7 | 5 | 0 | 2 |

Each noise band contains 44 in-roster cases. At 15, 25 and 40 dB, active recovered 40, 43 and 39. Random recovered 41, 43 and 39. Passive recovered 35, 41 and 44. Of all 132 paired decisions, active and random both succeeded on 122, random alone succeeded on one, and both missed nine. Random alone recovered quadratic drag at 15 dB on outer seed 299473. Active selected the pendulum there. Active and random both selected quadratic drag for Duffing on that same seed and noise level.

All six hidden-Z Lorenz cases were rejected by every arm. For delay feedback at outer seed 155331, the active arm admitted van der Pol at both 15 and 25 dB, with standardized forecast errors 1.960 and 1.561 under the registered threshold 3. Rejecting scrambled time series did not suffice for rejecting an ordered trajectory from unmodelled dynamics.

## Native reproduction

Node v24.22.3 ran the exact source at `39bf51ef024b5401f89a87530c012235f3145317` from a clean RAM-backed working directory. The six scientific input files matched the commit's Git blob IDs before execution. All three Node unit tests passed. The originally submitted tagged test job `j-build-620ba495a0771bb68d1e8f50` had zero attempts and was cancelled before assignment. It supplied no scientific observations.

Run `node scripts/noisy-field-course.mjs /tmp/noisy-field-result.json` to regenerate the course. Run `node scripts/replay-noisy-field-course.mjs experiments/noisy-field-interventions/result.json` to recount the retained decisions. The independent replay found all 144 unique registered cells, checked row decisions for all three arms, and reproduced the rejection. Five mutated receipts were refused separately: a missing row, changed aggregate, unregistered seed, changed sham decision and wrong protocol digest.

The registered protocol commit is `4cffdc5569372ae95518e845329b26c2e0d6ee91`. The retained 249,211-byte result has SHA-256 `852232409b7baa29604f052cd127ad6a17864deae854c9c9c35870b45613c8fd`. The simulation identifies one of 22 candidate templates from noisy states and a matched forcing schedule. Both held coefficient/initial-state seeds contribute to each family. No measured derivatives are supplied. The results describe this finite simulation course. A new acquisition or abstention rule would require an independent prospectively registered course.
