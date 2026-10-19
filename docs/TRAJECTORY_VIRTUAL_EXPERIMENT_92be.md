# Acquiring an independent synthetic pendulum run

`src/trajectory/virtual-experiment.mjs` supplies a controlled synthetic instrument
for the trajectory planner's next-run experiment. It generates a whole new
recording from a chosen initial angle and rate. This component does not plan,
fit, rank, append evidence, or execute physical hardware. The experiment
controller connects acquisition and explicit revision to the actual workbench;
its consumer also screens the proposal's numerical sensitivity before new
acquisition. See `TRAJECTORY_PLANNER.md` for that workflow and its receiving.

## Contract

```js
import {
  acquireVirtualPendulum,
  VIRTUAL_PENDULUM_INSTRUMENT,
} from './src/trajectory/virtual-experiment.mjs';

const acquiredRun = acquireVirtualPendulum({
  initialPosition: 2.1,       // rad; selected intervention
  initialRate: 0,            // rad/s; selected intervention
  seed: 5001,                // explicit fresh unsigned 32-bit seed
  duration: 8,               // seconds; default 8
  sampleInterval: 0.04,      // seconds; default 0.04
  noiseSigma: 0.00002,       // rad; default 0.00002
}, {
  existingRuns: [...trainingRuns, ...challengeRuns, ...priorAcquisitions],
});
```

`existingRuns` is explicitly required. Pass an empty array only for an empty
instrument history. Include retained challenge recordings even though they never
enter planning or fitting: this list is used solely for acquisition identity and
noise-stream checks. The planner should emit only initial position/rate,
duration, and sample interval. The controller supplies a new seed, noise scale,
and complete history. A proposal ID belongs in the controller's experiment
record; it does not change the identity of acquired evidence.

The returned object is an ordinary known-inertia trajectory run:

```text
{id, label, kind:'synthetic', units, inertia:0.8, initialRate,
 samples:[{time, position, command:0}], source:{...}}
```

Units are seconds, unwrapped radians, rad/s, N·m, and kg·m². The first sample's
angle is exact and its rate is independently supplied by the instrument request.
Later noisy angles never reset the evolving simulation. Every command is zero,
held across its sample interval; the final command has no subsequent interval.
The output contains a complete run or the call throws a typed refusal. Inputs
and prior evidence are never modified.

## Independent instrument and numerical reference

The fixed release instrument integrates the explicit equation

\[
  \theta'=\omega,\qquad
  \omega'=\frac{-0.24\,\omega-2.2\sin\theta}{0.8}.
\]

Its implementation imports neither learned-model prediction nor discovery nor
the receiving forward solver. Callers cannot supply a candidate, coefficients,
inertia, command, or other physical overrides. The initial state changes the
experiment; it does not change the apparatus law.

The convention matches the unforced pendulum in
`scripts/generate-trajectory-fixtures-92be.mjs`: known inertia 0.8 kg·m²,
linear damping 0.24 N·m·s/rad, sinusoidal restoring scale 2.2 N·m, and no bias.
The three existing small-angle-example recordings are reproduced sample for
sample by the new instrument when given their original settings. The driven
example has different forcing and bias; this release-only instrument must not
be silently treated as that apparatus configuration.

Reference integration uses independently coded RK4 with substeps no larger than
0.0005 s. The source records the actual substep and total step count. It is a
fine-step numerical reference, not exact physical truth or a calibrated accuracy
bound. A candidate's agreement with this known apparatus qualifies a synthetic
experiment within the declared scope; it does not identify an unfamiliar
mechanism or establish transfer to physical hardware.

## Noise, identity, and repeated evidence

Position errors after t0 use the fixture's deterministic 32-bit linear
congruential generator and cosine Box–Muller transform. Seed zero is valid.
There is no implicit seed, clock, random device, or global acquisition counter.
For the same request and JavaScript numerical implementation, replay reproduces
the same samples and identity. Different seeds are controlled pseudorandom
realizations, not proof of physical independence. Floating-point transcendental
functions can differ in their last digits across JavaScript engines.

`source.recordingId` is a canonical string containing the versioned instrument,
initial state, effective seed, noise scale, duration, and sample interval. The
short run ID is a deterministic label derived from that string; it is not an
authenticity or security checksum. The full recording identity remains in the
portable source metadata. When noise is zero, the seed does not change that
identity.

Before doing numerical work, acquisition checks all supplied history:

- An already retained canonical recording is rejected, including a renamed run.
- A nonzero-noise request cannot reuse the seed of an existing nonzero-noise run
  from this instrument or the original fixture generator, even under a changed
  release angle, noise amplitude, duration, or sampling grid.
- A repeated noiseless release from the same initial state is rejected even if
  its seed, duration, or sampling grid changes.
- Recognized virtual records with incomplete seed/noise provenance are rejected.

Ordinary bundle validation also rejects a relabeled copy used across training
and challenge because its canonical recording identity is shared. These checks
prevent normal replay mistakes; they cannot authenticate deliberately edited
metadata, discover omitted history, or certify statistical independence. A
caller that deliberately clears history can reproduce an existing recording,
but it receives the same canonical identity and must not call it new evidence.

## Bounds and errors

The frozen `VIRTUAL_PENDULUM_INSTRUMENT` export publishes the computational
contract for planner and UI consumers:

| Setting | Accepted range |
|---|---|
| Initial angle | −2.4 through 2.4 rad |
| Initial rate | −2 through 2 rad/s |
| Duration | 0.64 through 20 s |
| Sample interval | 0.01 through 0.1 s |
| Samples | 17 through 2,001 |
| Position noise sigma | 0 through 0.05 rad |
| Seed | Integer 0 through 4,294,967,295 |
| Retained history | At most 64 runs |
| Integration steps | At most 42,000 per acquisition |

Duration must contain a whole number of sampling intervals, within floating-point
roundoff; a nonintegral request is refused rather than silently rounded. The
sample-count and whole-run integration budget are checked before execution.
Finite-state guards remain active during integration. These bounds are not
physical safety limits or hardware authorization.

`VirtualExperimentError.code` is `invalid_request`, `invalid_history`,
`resource_limit`, `repeated_evidence`, `reused_noise_stream`, or
`numerical_failure`. A refusal never returns success-shaped partial observations.

## Component verification

Run `node tests/trajectory-virtual-experiment-92be.test.mjs`.

The tests cover exact compatibility with all three original unforced fixture
recordings, fixed zero equilibrium at the maximum acquisition size, altered-start
noiseless prediction by the known law, deterministic seeded observation noise,
replay and noise-stream rejection, zero-noise sampling changes, existing bundle
independence checks, copied inputs, portable JSON, physical-parameter injection,
missing history, and bounded invalid requests. This is a received numerical
component; actual planner/acquisition/revision browser integration is a separate
release gate.
