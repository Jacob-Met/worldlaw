# Does the law improve prediction?

Trajectory Challenge now compares each inspected law with two no-learning
forecasts on the same separate recording: hold the initial angle, and keep the
supplied initial angular rate constant. Both ignore command and forces. They
are deliberately simple references, not competing learned physical laws.

Only the initial observed angle initializes the forecasts. Subsequent observed
positions score errors and never reset forecast state. Initial rate is supplied
by the input author; the comparator does not estimate it from challenge data.
The initial sample is excluded from every RMSE and skill calculation.

`skill = 1 - model squared error / baseline squared error`. Positive skill
means smaller squared error than that reference; negative means worse. A perfect
baseline has undefined skill, including when the model is also perfect. Values
outside finite numerical range remain unavailable. Skill does not alter model
ranking, fit settings, or the training evidence. Inspecting these scores while
choosing settings reuses the recording and is not blind validation.

The session summary compares all challenge runs with sample-weighted squared
errors. A failed, missing, duplicate, incomplete, or timestamp-mismatched model
result prevents an aggregate skill claim. The existing selected-model aggregate
RMSE is now null when any required challenge run fails, rather than describing
only surviving runs. The interface shows the inspected run's reference RMSE and
skill immediately below its existing prediction metrics. Notebook reopening
recomputes references from source inputs, without persisting inferred scores.

## Source-local evidence, 2026-10-24 UTC

`npm test` passes all 27 test files on Node 24.19.0.
`node tests/trajectory-baselines.test.mjs` passes six groups: analytic ballistic
motion, no dependence on future positions, improvement/loss/perfect-reference
cases, sample weighting and complete-run refusal, invalid input/numerical range,
actual challenge/reopen preservation of training ranking, and finite-range accumulation.

Independent review exposed an intermediate-overflow counterexample with four
finite errors of `1e308`: their RMSE is representable even though their unscaled
Euclidean norm is not. Error accumulation now divides each residual by the
square root of the final sample count before applying `hypot`. Aggregation
weights each run RMSE by `sqrt(runCount / totalCount)` before combining it.
The regression covers exact-model skill, unequal run lengths, large model
errors, and explicit refusal when the residual subtraction itself is not
representable. No Infinity baseline is reported as available.

Using existing fixtures with unchanged defaults (weak method for PASCO):

| Evidence | Learned RMSE, rad | Hold-angle RMSE, rad | Keep-rate RMSE, rad | Skill vs hold / rate |
| --- | ---: | ---: | ---: | ---: |
| Synthetic ambiguous release | 0.564396 | 2.023838 | 2.023838 | 0.922229 / 0.922229 |
| Reused measured PASCO recording | 0.322969 | 1.163049 | 8.278193 | 0.922887 / 0.998478 |

Beating these weak references does not establish adequate absolute accuracy,
identify a unique mechanism, calibrate uncertainty, or establish transfer to
unfamiliar apparatus. The PASCO evaluation was already used during development;
its training mismatch and cumulative-fit failure remain intact. These numbers
are local source execution, not a new physical acquisition or browser receipt.

## Maintained consumer receiving

The candidate was composed with maintained angular-reference and per-run consistency main `b60c334fbfeb3536b095a21b01bf78b5e49686b9` and received on Node 22.23.4 / Chrome 156.0.8078.47. The complete `npm run verify` passed 253 native cases, zero failures and one conditional Playwright case skipped with its optional module unset; both launched-server smoke paths passed. The optional portability course was also received separately against the immediately preceding `d04a780` composition: four actual Node-to-Chrome pending/applied notebook cases, zero skips.

`scripts/browser-baselines.mjs` passed all six browser groups on the current composition, including selected-model inspection, the measured PASCO failure, actual export/reopen, 390px/320px layout and no offsite requests. Desktop and narrow screenshots were visually inspected. Fixture hashes and exact comparison text are retained with the receipt.

The actual standalone trajectory build also passed using esbuild 0.25.5. Its HTML SHA-256 is `9049f404b14850f4526be36b812ac26407c109c10723514d29b67db9193e5677`; Chrome loaded that generated file offline and checked numeric references, retained measured failure and no external requests/exceptions. This snapshot build reports no source HEAD because it was received through hash-verified connector files; the HTML hash identifies the tested artifact.

The strict source-distribution path was exercised from an isolated Git index. Its 141 packaged source files include the baseline implementation, current representation diagnostics, UNKNOWN LAB and the browser harness under the maintained scripts directory. Temporary receiving fixtures, dependencies and the obsolete tools-directory harness are excluded. That ZIP is a local verified-tree candidate; its base reference does not assert a published candidate commit association.

These controls do not establish physical model adequacy, independent blind validation or a new apparatus acquisition.
