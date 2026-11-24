# A training command that distinguishes linear and cubic actuation

For every previously applied input in {−1, 0, 1}, the columns for linear and cubic actuation are identical. At a new magnitude a between zero and one, their difference in magnitude is a−a³. Its derivative 1−3a² gives the largest contrast at 1/√3, or the largest allowed symmetric magnitude when smaller. This is an exact result about actuator features. Position separation also depends on the state, inertia and the rest of the dynamics.

The new request uses four equal dwells with signs +, −, −, +. Each drive has zero integrated impulse and zero endpoint position displacement in the initially stationary, pure driven second-order system. The response between those endpoints distinguishes the laws. The implementation sends the request through the existing continuous-command validator. It reads only applied commands from training acquisitions and ignores the terminal input, which drives no interval.

If S past intervals had nonzero unit commands, their two-column Gram matrix has every entry equal to S. Adding N intervals with magnitude a contributes N times the outer product of (a, a³) with itself. The resulting determinant is S N (a−a³)². Thus a single interior magnitude **together with the unit-amplitude training data** gives rank two. An acquisition confined to ±a by itself still has rank one. The count gives each sampled command interval one row. Uneven training dwells or input correlations with other state terms require their own conditioning analysis.

## Optimality for the original interval budget

When S ≥ N and commands are bounded by one in magnitude, the interior design also maximizes this two-column determinant over **every** allocation of the N new commands, including schedules with unequal magnitudes. This result requires ±1/√3 to be allowed. It concerns only the actuator input columns.

Write v(u)=(u,u³), b=v(1), c=v(1/√3). In this basis v(u)=p b+q c with p=(3u³−u)/2 and q=3√3(u−u³)/2. For x=u²,

    1 − p² − q² = (1−x)(3x−1)² ≥ 0.

The analytic design has Gram matrix G=S b bᵀ+N c cᵀ. The leverage of any possible next input relative to G is p²/S+q²/N ≤ 1/N. For an alternative total Gram matrix A with the same S source intervals and any N new commands, the trace of G⁻¹A is at most 1+N/N=2. The two nonnegative eigenvalues of G⁻¹ᐟ² A G⁻¹ᐟ² then have product at most one, giving det(A) ≤ det(G). The analytic schedule attains equality. When S<N, moving some new rows to unit amplitude can improve the determinant; the bound here relies on the observed budget. The maintained position planner optimizes a different, dynamical criterion.

## Original development design

Receipt 194295 fixed the design and comparators before evaluating a new simulated response. The source contains only the three recordings retained in the worst Worldlaw #894 fold. They supplied 500 nonzero unit-command intervals. One additional 8-second request at 0.04-second cadence adds 200 intervals, raising the actuator determinant from zero to 14814.8148. No fourth recording supplies a training label or an observed response in this comparison. The initial state is 0.25 rad and zero rate, and each dwell takes two seconds.

| Prospective request | RMS between rival position forecasts (rad) | Peak separation (rad) |
| --- | ---: | ---: |
| Unit-magnitude sign control | 0 | 0 |
| Analytic interior amplitude | 0.61308249 | 1.19772643 |
| Existing position-separation planner | 0.75059359 | 1.53399147 |

Both fitted rivals come from the three retained training acquisitions. Forecast separation uses the 200 postinitial points, with RK4 repeated at maximum steps of 0.01 and 0.005 seconds. The existing planner obtained the largest separation across these requests using 100 candidate schedules and 202 rollouts. The analytic request requires no rollout to choose its amplitude. These are design predictions. The subsequent paired development-instrument measurements are reported below.

A separate closed-form control applies each of the two laws at gains −0.7 and 1.3, then adds alternating position errors of magnitude 0.002 rad. All four fresh courses select their generating actuator. The true-law residual RMS is 0.002 rad in each case, and the clean rival separation exceeds twice the noise bound. Under any pointwise errors bounded by that value, the triangle inequality still separates the two forecast residual norms on this fixture. The comparison assumes the source unit-command gain is fixed; estimating all nuisance terms jointly is a different problem.

The test and JSON receipt retain the four-segment requests, both integration meshes and the existing planner's work. To reproduce the source fits, point WORLDLAW_POSITION_OUTPUT_ARCHIVE to the original development ZIP, then run:

```sh
node --test tests/actuator-excitation.test.mjs
```

## Paired measurements on the development instrument

The protocol's original synthetic development oracle generated one fresh eight-second training run per design. Both arms used world 1006's original physical parameters, the same three archived source trajectories, the same independent noise stream and exactly 201 new positions. The first position is imposed. Each arm scores the other 200 before refitting. The forecast seal binds both request and position arrays before either acquisition. Registration 194490 fixed the two requests, noise derivation and decision rule.

| Acquired training request | Linear rival RMS (rad) | Cubic rival RMS (rad) | Identified actuator | Four-run weak refit |
| --- | ---: | ---: | --- | --- |
| Analytic interior | 0.61245664 | 0.00219608 | Cubic | Cubic |
| Existing active planner | 0.74949906 | 0.00236590 | Cubic | Cubic |

The frozen rivals had identical nuisance coefficients. Both measured runs identified the cubic actuator registered for this world, and both independent four-acquisition refits recovered its cubic drive, rate, spring and cubic restoring terms. The active planner produced the larger gap between rival residuals, 0.74713 versus 0.61026 rad. The decision agrees for this one development world and this one paired noise draw. Calibration, protected evaluation, historical forecast observations and physical hardware were outside the comparison.

The two raw position recordings, seal and usage receipts live under `docs/receipts/paired-actuator-acquisitions/`. To score those recordings without another acquisition, run `node --test tests/measured-interior-actuator.test.mjs`. The optional `WORLDLAW_POSITION_OUTPUT_ARCHIVE` check also reconstructs the four-run weak fits using only the three named training members. The supplemental generator requires their original contents, admits only registered development world IDs and caps the new instrument at one acquisition per arm.
