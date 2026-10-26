# Receiving the three-law velocity comparison

The velocity instrument compares diagonal loss, symmetric loss, and symmetric
loss plus a skew velocity term. Its results do not adopt a law into motion
playback or release planning. All three training fits are fixed before the
separate source is evaluated.

## Native controls

```sh
node tests/velocity-comparison.test.mjs
```

Eight groups cover an independently authored coupled inertia and reversed
mixed-frequency motion; the uniform rank-four and irregular rank-seven false
candidate controls; zero skew; held-source invariance of every primary and
alternate training fit; indefinite symmetric loss; source-only replay and
strict new-source admission; and the complete three-training-plus-one-challenge
quadrature reservation. The independent source generator is in
`tests/support/velocity-control.mjs` and does not use a fit or motion integrator
to generate its original observations.

The independent matrices are M=[[2.6,-.37],[-.37,1.4]],
D=[[.55,-.18],[-.18,.8]], and G01=-.42. The reviewed control recovers all seven
coefficients within 2e-6. A changed held torque leaves all training reports
unchanged. Numerical full rank alone is deliberately not accepted as physical
identification: the irregular one-frequency candidate fails separate receiving.

## Actual browser receiver

Run this only on the isolated receiving host with its installed Chrome and
already provisioned sandboxed browser launcher:

```sh
BROWSER_EXECUTABLE_PATH=/tmp/hamon-70fa-chrome-sandbox \
BROWSER_ARTIFACT_DIR=/tmp/worldlaw-velocity-receiving \
node scripts/coupling-velocity-browser.mjs
```

The launcher path is a browser executable wrapper, not a Chrome setuid sandbox
helper. The receiver preserves the inherited environment unchanged.

The wrapper starts the maintained product server and an owned temporary Chrome
profile. Before navigating to product content, it invokes the unchanged
`scripts/support/chromium-sandbox.mjs` admission gate on the owned isolated page.
Every required live sandbox protection must be active. No browser is downloaded,
no sandbox-disabling fallback is provided, and a refusal writes a failed receipt.
Temporary browser state is removed after the run; result artifacts remain.

The reusable `receiveVelocityComparison` receiver checks all three actual cards,
the misleading-rank example and separate failure, an actual source-only browser
download and fresh-page reopen, independent-source receiving, training-fit
invariance, zero-skew and inadmissible fits, unsupported/repeated source
retirement, aggregate-work refusal, settings invalidation, trusted keyboard
activation, and two delayed-file races. The settings-race control requires a
pending read to retire its old result and requires a subsequent setting change
to re-enable explicit comparison of the retained source.

At both 1440 and 390 pixels, the receiver checks page and coefficient-table
overflow and captures the two-frequency and irregular-source instruments.
It also rejects uncaught product exceptions and external requests.

Artifacts include `sandbox-admission.json`, `velocity-verification.json`, the
actual downloaded `worldlaw-velocity-study.json`, and four PNG screenshots.
Inspect the screenshots as well as the automated measurements before claiming
visual receiving. A successful native or syntax test alone is not a browser
receiving result.
