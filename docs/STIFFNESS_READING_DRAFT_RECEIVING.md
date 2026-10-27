# Retaining an unrecorded stiffness reading during check replacement

Issue: https://github.com/Jacob-Met/worldlaw/issues/363

## Behavior

Replacing separate checks now keeps the live acquisition ID, observed coordinates and torque field strings when the same complete frozen request remains active. This allows a user to inspect different held-out evidence while finishing a reading. It neither records that draft nor uses it for fitting.

Preservation is explicitly requested only by the check-replacement path. Freezing a request again, opening a notebook and starting another experiment continue to initialize the reading fields. The pending summary, control availability and check diagnostics still render on every installation.

## Executed receiving

Baseline: `816019f8f2cb3845c4198146f6b1d95c4be8dadc`. The unchanged panel lost the ID `bench-note-A`, the torque string `1.234500` and the entered coordinate formatting after a valid check import. The same run verified that the check metric changed while the training fit, pending request, acquisition list and historical forecasts stayed equal.

The candidate passed all 37 tests in the three maintained stiffness suites and all eight actual-browser groups:

- Preserve every draft field while changed checks update their diagnostics.
- Preserve a second edited draft on another replacement.
- Retain an incomplete draft and survive an invalid check import.
- Reset on an identical explicit refreeze and an identical notebook open.
- Receive the preserved reading through the real form using Enter.
- Reload, reopen the exported notebook and recover the acquired observation and earlier forecasts.

The installed Chrome 156 binary passed the maintained sandbox admission check with namespace, PID, network, seccomp and TSYNC protections active. Measured viewports were 1440 × 913 and 390 × 844. Desktop and narrow screenshots were inspected; the narrow run also used reduced motion.

The execution used the exact maintained Stiffness Lab module closure. Source hashes, commands, browser evidence and the original failed control are retained in `docs/receipts/stiffness-reading-draft-3b86/verification.json`. These are authored software controls.

## Run the focused checks

```sh
node --test tests/stiffness.test.mjs tests/stiffness-experiment.test.mjs tests/stiffness-revision.test.mjs
BROWSER_EXECUTABLE_PATH=/path/to/installed/chrome BROWSER_ARTIFACT_DIR=/tmp/worldlaw-reading-draft node scripts/stiffness-reading-draft-browser.mjs
```

Choose an installed Linux Chromium executable that passes the maintained sandbox preflight. The browser script uses an isolated profile, the real product server, ordinary file imports and exported notebooks. The artifact directory retains its receipt and screenshots.

## Review and integration

Two retained reviewers independently assessed the brokered patch and executed evidence; neither reported a blocking issue. They did not independently execute the tests. The implementation keeps the existing deterministic full-request comparison convention.

PR94 remains owned by the input-design contributor and changes a distinct hook in the same panel. Its import and inputDesign creation/update must remain intact when that branch is composed. The family-expansion, scientific-core, notebook-schema and coordination-migration owners remain unchanged.
