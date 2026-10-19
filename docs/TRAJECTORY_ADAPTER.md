# Experimental angular telemetry adapter

`src/science/trajectory-observations.mjs` provides an additive route from tracked
or encoder angular positions to WORLDLAW's torque observations. It is qualified
on controlled analytic fixtures; physical sensor receiving remains open. Its
inputs must already be calibrated and synchronized. No video reconstruction,
tracking, physical actuation, or inertia identification is included.

## Use with the existing studio

The command-line bridge creates a JSON file accepted by the studio's observation
import. It does not require new browser controls:

```sh
node scripts/derive-telemetry.mjs \
  --input examples/synthetic-angular-telemetry.json \
  --inertia 0.8 --position-sigma 0.0001 \
  > derived-observations.json
```

Open the studio and import `derived-observations.json`. This supplied example is
explicitly synthetic. For other telemetry, preserve that file's original units
and provenance, supply its actual known inertia, and inspect the derivative
noise diagnostics. The bridge retains an input SHA-256 digest, assumptions and
source-window split in its JSON source metadata. The studio retains this supplied
provenance under `source.metadata` through notebook export and replay, while
labeling it user-supplied rather than independently verified. Use `--help` for the
narrow command-line contract.

## Callable interface

```js
import {deriveTorqueObservations, splitTrajectoryEvidence}
  from './src/science/trajectory-observations.mjs';
import {discover, evaluate} from './src/science/torque-discovery.mjs';

const derived = deriveTorqueObservations(telemetry, {
  inertia: 0.8,          // kg·m², supplied known constant
  windowSize: 7,        // odd, 5 through 31
  positionSigma: 0.001, // radians, assumed independent position noise
});
const split = splitTrajectoryEvidence(derived, {trainingFraction: 0.7});
const discovery = discover(split.observations, {noiseSigma: 0.02});
const heldOut = evaluate(discovery.selected, split.heldOut);
```

Every input row has `time` in seconds, **unwrapped** `position` in radians, and
`command` in N·m. Time must increase strictly. Irregular sampling is accepted;
missing points are not interpolated. Jumps above π radians are flagged as
possible wraps, but no automatic unwrapping is performed. At most 4,096 raw rows
are accepted. A known positive constant moment of inertia is required: inferred
net joint torque equals inertia times angular acceleration. This assumes a
scalar rotational coordinate with that inertia; a coupled mechanism with a
state-dependent inertia needs a different model.

For each interior observation, a cubic polynomial is fitted to a centered local
window after time scaling. Its value and first and second derivatives give
smoothed position, angular rate and angular acceleration. A two-pass QR solve
supports nonuniform timestamps without fitting large absolute epochs. Half a
window is dropped at each end; outputs carry `sourceStart`, `sourceEnd`, and
`positionSourceIndex` so their exact raw support remains inspectable.

The default `positionSigma: null` uses the local polynomial residual scale as a
**proxy** for position error. This mixes measurement noise with approximation
error, and may underestimate correlated errors. A supplied nonnegative sigma
is propagated through the linear derivative estimator; `jointTorqueSigma` and
`jointTorqueNoiseGain` expose the amplification. A sigma of zero is an explicit
caller assumption of zero position noise. These are not validated confidence
intervals. Clock error, command misalignment, tracking errors, inertia error,
aliasing and unmodeled dynamics are not included in the uncertainty calculation.

Numerical differentiation can produce large torque uncertainty from small
position noise. Increasing the window smooths noise while increasing bias on
fast dynamics. Inference also receives correlated errors in position, rate and
torque; ordinary least squares does not remove that errors-in-variables bias.
Users should not choose `noiseSigma` by treating the local proxy as calibrated
sensor evidence.

`splitTrajectoryEvidence` divides raw time order at an explicit cut and excludes
every derivative window that crosses it. This prevents training and held-out
estimates from sharing raw input samples. Nearby states in one trajectory can
still be strongly related; the split does not establish a new-mechanism or
independent-run evaluation. Both sets may be too short for discovery after the
guard is applied, which is reported through counts and the existing minimum-row
validation. The caller must not silently reclassify discarded windows as
held-out evidence.

Run `node tests/trajectory-observations.test.mjs`. The independent fixtures check
exact derivatives of an irregularly sampled cubic, harmonic-oscillator torque
units, linear noise propagation, source-window separation, wrap warnings and
invalid time/inertia handling. The harmonic case deliberately checks that
**a nearly perfect held-out regression on derived observations can coexist with
a biased recovered physical coefficient**. That counterexample prevents an
overstated physical validation claim from the derivative adapter alone.
