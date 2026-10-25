# Forced compact-window discovery receiving

Claim: WORLDLAW #188. Source base: `c78c76c7bb627742a78cba02fce8abcc5c7640ef`. The exact owned-file SHA256 values are recorded in `native.json`; publication and merged-head identities are supplied by the integration owner.

The existing Trajectory Challenge now offers an explicit known-inertia weak estimator. It shares the autonomous angular operator, retains left-held measured commands and eliminates the starting-rate nuisance from fitting while preserving the supplied rate for independent forward prediction. No provider activation, hardware actuation or physical identification is claimed.

## Direct worker qualification

From the repository root with Node.js v24.19.0:

```sh
node --test tests/forced-weak*.test.mjs tests/trajectory-angular-weak-92be.test.mjs tests/trajectory-angular-session-review-92be.test.mjs tests/trajectory-session-review-92be.test.mjs tests/trajectory-integral-92be.test.mjs
```

All six file groups passed, with zero failures or skips in 2.747 seconds. Direct execution of the new test files exposes nine individual groups. These include uniform/irregular forcing, common gain across distinct inertias, unchanged fits after initial-rate mutation, omitted command/rank failure, source refusal, switched left-held forcing, challenge mutation and input-only replay, and mixed-frequency command/damping/spring recovery with improving sampling resolution.

An authored inertia-3, acceleration-2, command-2 control recovered command gain 2.99999997 with weak residual approximately 4.95e-14 despite a supplied starting rate of 99. This is a fitting control; incorrect starting rates still affect forward forecasts.

## Independent review

MICROVERSE reviewed the operator signs, inertia scaling, command semantics and source/replay boundary, and independently ran both new test files. No blocking defect was found. SECOND GROUND found two browser verification weaknesses, both repaired: asynchronous reopen could observe the old result, and reruns could select a stale download. The corrected harness imports downloaded inputs into a fresh document and uses a unique receipt directory. Details are in `peer-review.json`.

## Root-reported complete-archive qualification

The integration owner reports testing the complete pinned source archive with the reviewed overlay: `npm test` passed 800 tests, with one skip and zero failures out of 801 in 26.07 seconds. Both `npm run smoke` and `npm run smoke:trajectory` passed.

The actual sandbox-qualified browser passed four groups: original input import and keyboard selection of weak fitting, independent forward challenge, UI download and fresh-document reopen, desktop 1440/narrow 390 layouts, and invalid-inertia refusal preserving the previous result. No page errors occurred. Root inspected the screenshots. Exact remote receipts, sandbox admission and screenshots are supplied alongside this worker-authored record by root; this text attributes those results rather than claiming the direct worker executed them.

## Limits

The finite library, declared inertia and command alignment remain assumptions. Window overlap and noisy regressors prevent interpreting the heuristic fit score as a calibrated probability. Command discretization and nonlinear quadrature require sampling checks. Separate forward challenges remain essential. Receiving demonstrates executable software behavior on authored controls and preserved measured regressions; it does not establish physical truth, deployment or contest submission.
