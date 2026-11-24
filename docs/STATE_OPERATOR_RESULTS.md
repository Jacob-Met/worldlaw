# State-only operator discovery: forecast gain and failed sham screen

The frozen course reduces mean held-record forecast error, but rejects the residual screen as an abstention mechanism. All 576 attempts were retained. The broad discovery goal remains unmet.

## Measured forecast comparison

Each arm received the same two fitting recordings, one separate selection recording and one additional acquired recording. Test recordings were used only for frozen scoring. The table averages all 60 genuine-law cases per arm (20 laws at 40, 25 and 15 dB); failed or divergent forecasts keep the fixed loss of 10. Errors are clean-reference relative L2, capped at 10, with a 1e-4 RMS floor.

| Estimator | Query | Mean error | Worst error | Worst law / SNR |
|---|---|---:|---:|---|
| weak_beam | active | 0.055420590 | 0.195404694 | cubic_drag / 15 dB |
| weak_beam | random | 0.065704127 | 0.249743397 | cubic_drag / 15 dB |
| weak_stlsq | active | 0.093831014 | 0.726538281 | asymmetric_trigonometric / 25 dB |
| weak_stlsq | random | 0.091246638 | 0.585571215 | asymmetric_trigonometric / 25 dB |
| derivative_stlsq | active | 0.685162612 | 10.000000000 | position_dependent_drag / 15 dB |
| derivative_stlsq | random | 0.678152954 | 10.000000000 | position_dependent_drag / 25 dB |

Weak beam active acquisition reduces mean error by 15.651% relative to its random-query counterpart. It wins 21 paired cases, ties 21 and loses 18. Its worst acquisition regret is saturating_flux at 15 dB: active minus random error is 0.156281916. Its largest gain is cubic_drag at 25 dB: -0.213830391. This is a descriptive result on one frozen synthetic course, not a confidence statement about unseen families.

| SNR | Weak beam active | Weak beam random | Weak STLSQ active | Weak STLSQ random | Derivative STLSQ active | Derivative STLSQ random |
|---|---:|---:|---:|---:|---:|---:|
| 40 dB | 0.011425129 | 0.017761158 | 0.042825574 | 0.017567456 | 0.123532385 | 0.060305644 |
| 25 dB | 0.048550355 | 0.065331226 | 0.077670107 | 0.072701879 | 0.534811839 | 0.762020454 |
| 15 dB | 0.106286286 | 0.114019998 | 0.160997362 | 0.183470580 | 1.397143611 | 1.212132763 |

## The periodic-field slice regressed under active acquisition

| Weak beam slice | Cases per arm | Active mean | Random mean | Active worst | Random worst |
|---|---:|---:|---:|---:|---:|
| Oscillators | 36 | 0.064212985 | 0.085608678 | 0.195404694 | 0.249743397 |
| Periodic PDE fields | 24 | 0.042231996 | 0.035847301 | 0.194827366 | 0.142042867 |

The aggregate gain comes from the oscillator slice. Active acquisition worsens both mean and worst error on the periodic fields. This is another reason the result does not qualify a general active-discovery policy. The common menu gives every arm the same query count and admissible plans, but varies amplitude and frequency; input energy is not matched across chosen plans. Noise is scaled to each complete recording to maintain its stated SNR.

## Abstention failed

| Estimator | Time-permuted controls accepted | Omitted mechanisms accepted |
|---|---:|---:|
| weak_beam | 60/60 | 6/12 |
| weak_stlsq | 58/60 | 6/12 |
| derivative_stlsq | 54/60 | 4/12 |

These are false predictive admissions relative to the registered sham/outside rejection objective. The code never claims structural identification: structuralIdentification stays false in every row. That guard is not calibrated abstention and does not satisfy the scientific target.

The three-noise-standard-deviation heuristic has a structural weakness. After temporal shuffling, an approximately independent Gaussian state sequence with marginal standard deviation s has second-difference variance 6s^2. The implemented median absolute second-difference noise estimate therefore approaches s. A zero forecast has RMSE near s and passes a threshold above 3s. Tuning the same multiplier on these evaluation shams would not establish a calibrated rule.

Weak beam accepted the delay system at all three noise levels, nonlocal dynamics at 25 and 15 dB, and dispersion at 15 dB. The delay test has error 0.007971228 at 40 dB despite the missing history mechanism. Good finite-horizon predictions alone do not identify the governing mechanism.

## Independent verification

The standard scientific verification, real desktop/mobile browser course, independent Nullgarden receiver and fresh source-package extraction passed. The operator course ran four producer checks and thirteen core/HTTP tests before each shard. Both shards completed, yielding 360 genuine-law comparisons, 180 time-permutation controls and 36 omitted-mechanism comparisons.

The standalone Python recount imports neither the learner nor the production scorer. It checks the complete registered Cartesian product, both shard identities, acquisition budgets, summary/case equality, divergence penalties, every saved forecast shape, the exact shuffled reference order, and prefix initialization using an independent rational least-squares derivation. It recomputed every saved score with maximum absolute difference 0. Nine mutated inputs were rejected: missing and repeated attempts, changed denominator, changed aggregate, changed prefix, changed loss, changed acquisition, false structural claim and omitted test permutation. The recount validates observations and arithmetic; it does not independently rerun the fitting search.

```sh
python3 scripts/replay-state-operator-course.py \
  Worldlaw_State_Operator_Course_Shard_0.zip \
  Worldlaw_State_Operator_Course_Shard_1.zip --output independent-recount.json
```

## Frozen source and reproducibility

- Evaluated feature source: [c08760a85880d64ab4562d6ad75d0df0d5f1b788](https://github.com/Jacob-Met/worldlaw/commit/c08760a85880d64ab4562d6ad75d0df0d5f1b788).
- Actual hosted test-merge source: [bcd6b8533bb8c201f9a82c6cf09b52bf65466b3e](https://github.com/Jacob-Met/worldlaw/commit/bcd6b8533bb8c201f9a82c6cf09b52bf65466b3e).
- Independent producer: [Nullgarden 4af7717a866e0246e7c0bcd81977cea53cddbd8c](https://github.com/Jacob-Met/nullgarden/commit/4af7717a866e0246e7c0bcd81977cea53cddbd8c).
- Full scientific run: [45293746667](https://github.com/Jacob-Met/worldlaw/actions/runs/45293746667), artifacts state-operators-0-45293746667 and state-operators-1-45293746667. Node v22.23.5, two independent CPU shards.
- Application/source qualification: [45293746628](https://github.com/Jacob-Met/worldlaw/actions/runs/45293746628); browser receiving: [45293746695](https://github.com/Jacob-Met/worldlaw/actions/runs/45293746695).

The producer has public authored families, withheld recordings and coefficient scales, Gaussian observation noise set relative to each recording, and a finite spatial grid. This does not constitute externally blind family discovery, transfer to measured physics, continuum convergence, or calibrated uncertainty. The pre-review be964770 implementation is unqualified; none of its numerical scores were used to select or tune the corrected algorithm.

## Next binding ceiling

Keep the measured forecast improvement, replace the residual screen with a separately registered test of temporal predictive information and an explicit noise model, and evaluate on fresh trajectories and omitted mechanisms. Do not reuse these 576 evaluation cases for tuning and then present them as unseen qualification.
