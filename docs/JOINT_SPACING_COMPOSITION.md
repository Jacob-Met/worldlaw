# Joint-state fitting with represented finite-difference spacing

## Result and decision

The exact combined source at `3f70a51626e31b70751271d3bbf8d7ee5456cc5d` passes the authored three-course scientific comparison with the corrected bounded helper. Both position and supplied-rate RMS improve on every course after an accepted proposal reaches the spring bound. Separate position and rate numerical screens remain enforced.

This is one joint training fit over three authored courses per arm. The corrected helper preserves the useful constrained-fit result, with **44 evaluations instead of 41** for the delegated old helper, within the unchanged cap of 65. It is not a speed result or evidence of improved generalization.

| Executed arm | Final weighted RMS | Evaluations | Final rate coefficient | Final spring coefficient |
| --- | ---: | ---: | ---: | ---: |
| Original joint-state loop | 0.7996830295007916 | 8 | -0.24604286839902634 | -3.85 |
| Delegated fitter, original helper | 0.6772447091845787 | 41 | -0.19259937352738096 | -3.85 |
| Delegated fitter, corrected helper | 0.6772447091845784 | 44 | -0.19259937353078452 | -3.85 |

The original loop accepts trial 5 and then stops with `jacobian_unresolved`. The delegated old helper accepts an improvement in all eight iterations, ending at trial 40. The corrected helper accepts seven improvements, ending at trial 35, then records `no_improvement` in the eighth iteration after further proposals. Its extra evaluations and tiny numerical differences are retained in the receipt.

The corrected result's weighted RMS is about 15.31% below the original loop's result on these same training courses. The old-helper and corrected-helper objectives are effectively the same at the displayed scientific scale. Their per-channel differences should not be interpreted as a new predictive gain.

## Why this qualification was needed

The earlier [joint-state adoption receipt](receipts/joint-state-bounded-lm-7912183a/native-comparison.json) explicitly used helper SHA-256 `26536292d6fbdfc5bb26d7fa557fc01c6e80138c42d6b32b4d6cc947e9618a92`. Its three-course comparison could not establish behavior for the corrected helper, even though a later broad selected test run used that helper.

This comparison executes three arms contemporaneously. It isolates the original boundary-stop defect from the subsequent finite-difference arithmetic correction. The historical receipt remains unchanged.

## Exact source composition

The original source closure is pinned to `0a7ba12e58d714a52fd8f5385b87a1a8600c927e`. The combined receiving source is `3f70a51626e31b70751271d3bbf8d7ee5456cc5d`, tree `cbb89c6aa4f6a8dc8a042fe95c85f2f91a209c6b`. A fresh GitHub comparison confirmed that the only runtime changes between these pins are the joint-state fitter and bounded helper.

| Runtime text | SHA-256 |
| --- | --- |
| Original joint-state fitter | `52629bd0b4edaed3dde1970f41700d2fbd95a9524683b6fb0e2b9f0e2fed6fb0` |
| Delegated joint-state fitter, both delegated arms | `2915796fe51f98401461f2f084cc5e0836f1ec149a7c9288166f9c6e28a992a9` |
| Original helper | `26536292d6fbdfc5bb26d7fa557fc01c6e80138c42d6b32b4d6cc947e9618a92` |
| Corrected helper | `f9a86ac2529a38d83a9e039c5b43912bf493b681d0464dd299503c4e9e67632b` |

The runner checks all 29 original closure files before execution and again afterward. It uses native Node module hooks with a separate module namespace for each arm. The loaded source bytes are recorded: 28 project modules for the original loop, and 29 for each delegated arm. The original loop does not load the bounded helper; its receipt records `helperUsed:false`.

Receiver, normalization, integration and reservation code remain real pinned project modules. No project dependency is stubbed. Only the designated fitter and helper texts vary between arms.

## Inputs and fairness

The runner extracts the complete `fixture()` body from the exact maintained boundary test and preserves its arithmetic, declarations and property order. The serialized input exactly reproduces the earlier native input digest:

`86efee448961acd995afe70ef052837d071a00ab39392f738d30281bd6d60a89`

The digest representation is explicitly `JSON.stringify(fixture())`, whose properties are `seed`, `runs`, and `options`.

| Input | Preserved value |
| --- | --- |
| Initial position/rate pairs | (1, 0.2), (-0.7, -0.1), (0.5, 0) |
| Samples | 126 original rows per course, every 0.04 seconds through 5 seconds |
| Authored law | Rate coefficient -0.2; spring coefficient -4 |
| Seed | Rate -0.3; spring -3.6 |
| Bounds | Rate [-1, 0]; spring [-3.85, -2] |
| Iterations / maximum integration step | 8 / 0.02 seconds |
| Position / rate numerical screens | 0.001 / 0.001 |
| Objective scales | 0.1 rad / 0.1 rad/s, with their explicit declared basis |
| Complete reservation | 186,810 integration steps and 24,570 prediction rows |
| Evaluation cap | 65 |
| Supplied-rate dependence | `not-assumed-independent` |

The true spring coefficient lies outside the declared fitting box by design. Supplied rates remain the exact analytic derivative of the same authored trajectory; they are not regenerated by differencing or treated as independent noise. The interpretation remains angular acceleration only, with unknown absolute torque and inertia.

All three arms preserve the input seed, options and original runs, and return the original rows unchanged. Every trial coordinate is finite and within its declared bounds. The doubled residual reservation remains within the existing 262,144-value admission limit. The reported dimensionless objective also agrees with reconstruction from the six course/channel RMS values.

## Per-course receiving

The candidate assertions compare both channels for each course, including comparison with that arm's first **accepted** boundary trial. Derivative probes do not count as accepted progress.

| Course | Original-loop position RMS | Corrected-helper position RMS | Original-loop supplied-rate RMS | Corrected-helper supplied-rate RMS |
| --- | ---: | ---: | ---: | ---: |
| a | 0.06899631584973576 | 0.05246358122948573 | 0.13184367900115915 | 0.11500324319778951 |
| b | 0.04791350402022948 | 0.03633037392492645 | 0.09212295230633977 | 0.0799936886875375 |
| c | 0.033621813450411125 | 0.02535824832548547 | 0.06567770563950677 | 0.056387262818626424 |

For each delegated arm, a later accepted trial improves after the first boundary entry, the final spring stays at -3.85, and final weighted RMS is below 90% of the first accepted boundary trial's RMS. Both channels improve on every course against both that boundary trial and the original loop.

Every final course is `screened`, with a `compared` numerical-resolution receipt and finite, nonnegative differences within both declared screens. These compare two integration resolutions; they are not calibrated physical error bounds.

## Strict-rate refusal

Changing only `rateScreen` to `1e-16` produces `seed_unresolved` in all three arms. Each returns a null model, one trial, no optimizer iterations, the same full reservation and the same cap of 65.

All three course position screens still pass. Their supplied-rate resolution differences, approximately 4.53e-8, 3.15e-8 and 2.23e-8 rad/s, exceed the strict rate screen. A passing position screen therefore does not admit an unresolved supplied-rate fit.

## Reproduction and receipt

The native qualification ran on Node v24.22.1 and exited zero. The exact runner is [diagnose-joint-spacing-composition.mjs](../scripts/diagnose-joint-spacing-composition.mjs). The [source input](receipts/joint-spacing-composition-7912183a/source-input.json) freezes the candidate texts, maintained fixture source and original dependency pins. The [native receipt](receipts/joint-spacing-composition-7912183a/native-comparison.json) retains every trial's values, acceptance history, per-course metrics, actual module-load hashes and strict controls.

Runner SHA-256: `226cc35c6230dc92b760ec8a30f665fb499c2bf6e0ad3a18be9aa4c4edb7c0bd`.

Source-input SHA-256: `6861e7c405c262dfc146cf2e2a5b3063d0db743d7600d8b999c304473842e1aa`.

From a checkout containing these research files, supply a separate original source checkout at the pinned `0a7ba12` commit:

```sh
node scripts/diagnose-joint-spacing-composition.mjs --source-root /path/to/worldlaw-at-0a7ba12
```

The native run used the exact `--input-json` entry with the already verified local original closure, because ordinary workspace storage could not allocate new files. Default adjacent-file loading was not executed. A prototype run established the same result; final runner qualification repeated that deterministic input and is not statistical replication. One command assembly omitted Node's `--` separator before the runner flags and exited with `node: bad option: --input-json` before project code ran. The corrected invocation completed successfully; no project failure or source change occurred.

## Ownership and remaining work

This receipt advances root's existing bounded-helper and joint-state receiving tasks. It changes no production source or candidate PR head. PR608 and PR610 remain separate drafts, and the exact combined receiving branch retains their composition for review.

The earlier selected broad test result remains 2,181 tests: 2,180 passes, no failures, one inherited skip, with four writing/provenance test files excluded. The separately executed new spacing checks and overlapping joint-state tests must not be double-counted into that result.

This fitter-level authored comparison does not complete clean-checkout, full application, notebook, browser or final-artifact receiving. Original scientific ownership, explicit release/export holds and UNKNOWN operations remain unchanged. The next integration gate is the remaining receiving work under actual storage/browser capacity, followed by exact-head reconciliation before either draft can advance.
