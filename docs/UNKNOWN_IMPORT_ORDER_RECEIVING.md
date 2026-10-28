# Unknown Lab: preserve the newest experiment choice

**Source and prepublication package receiving passed.** This record
covers the Unknown Lab import-order correction and its regression checks; it
does not claim integration, deployment or public release.

## Product behavior

A delayed evidence-file read can no longer replace a newer import or virtual-run
attempt. Obsolete success and failure callbacks cannot overwrite newer results,
refusals or focus. A newer invalid file or invalid run leaves the previous valid
notebook available and retires older pending reads. The file input is reset
immediately after retaining its File so that the same file can be selected again.

This protects the notebook that feeds the displayed measurements, subsequent
analysis, explicit saving and export. The correction adds controller-local intent
ownership and captures native form-validation refusals; it changes no scientific
model, notebook schema or import-validation rule. Saving remains explicit.

## Received source results — 27 October 2026, Pacific

The lead executed the source checks through the authorized remote route and
reported terminal results. The product worker independently reviewed the
baseline and package receipts and receiver source; it did not execute these remote checks.

| Check | Received result |
| --- | --- |
| Unchanged baseline, same v2 receiver | Expected behavioral failure: older import 101 replaced newer import 102 in actual exported JSON |
| Candidate desktop, 1440 × 1000 | 14/14 checks passed |
| Candidate narrow viewport, 390 × 844 | 14/14 checks passed |
| Linux browser admission | Same browser admitted before product navigation in all reported runs |
| Uncaught page exceptions | None recorded in the browser runs |
| Maintained native verification | 1,524 tests: 1,523 passed, 0 failed, 1 inherited skip |
| Maintained smoke runs | Both passed |
| Package-policy regression checks | 7 passed for the two exact log exclusions; this is not delivered-package receiving |

The browser receiver checks stale success and rejection, a superseded queued
run, newest malformed and oversized files, valid runs, native required/range
validation, retained pending Files, same-file reselection readiness, empty
selection, ordinary import/export roundtrip, and explicit save/forget. Its final
case uses **CDP Enter on focused Remember and Export controls**, reloads the
page, and compares the actual downloaded JSON file with the saved evidence.

### Exact provenance

| Artifact | Identity |
| --- | --- |
| Baseline controller `src/unknown-lab/app.mjs` SHA256 | `fa8861f08f62573f34284f912bbb4422d2ab40abed7226ae3378ba8138d6f63d` |
| Source base/main revision | `34a8c486787b145b80ffcc4eb3ffc48c9caea517` |
| Tested candidate controller SHA256 | `2db3789e38588097307a059cd87bc2c414ca2f177a3a7b5a70c35d4af897df1b` |
| Executed v2 receiver SHA256 | `a00fb209c9c83cbf30f2ad49733484cf05cf5c9b937cbc5f6122dac2c959bb95` |
| Maintained Linux sandbox helper SHA256 | `4607c67b360596ee06b36e41a6b5d3a8a6da70defb04292d955f609dcef05ead` |
| Actual downloaded filename | `worldlaw-history-pairs.json` |
| Actual downloaded size | 8,303 bytes |
| Actual downloaded SHA256 | `866597917576a850121185f75dc92577cd66f3ceffce5bbe335919cc20802d10` |
| Download receiving | Keyboard activation of Remember and Export; saved notebook reopened successfully |

The candidate was tested as working source on the base revision above; no
published candidate commit is claimed. Its only difference from the earlier
source-review controller is removal of an extra trailing newline. The receiver
compares served controller bytes with its selected source root and records the
hash. Execution evidence is indexed in the [receiving summary](receipts/unknown-import-order-20261028/summary.json), alongside `baseline.json`,
`source-desktop.json`, `source-narrow.json`, `package-desktop.json` and
`package-narrow.json`. Published-commit package receiving remains a separate
next step; no integrated revision is claimed here.

The directly reviewed earlier baseline receipt used Chrome `153.0.8010.47` on
Linux x86_64 and the preceding receiver
`6703b4ae244dc3cd9782b839aff71c844e7ae52c0d84b3adbcea7bb5d604f061`.
Its sandbox report admitted SUID layer 1, PID/network namespaces, seccomp-BPF and
TSYNC. Its actual assertion diff showed `import-order receiver 101` replacing
`import-order receiver 102`, including changed exported trial values. The lead
subsequently repeated the genuine negative control with v2. The receiver's
expected exit 1 is distinct from exit 0 of an enclosing command that validates
the negative control. Setup failure never qualifies as the expected product
failure.

## Reproduce

Use Node.js 22+ with built-in WebSocket and an existing authorized sandboxed
Chrome/Chromium executable or launcher. From the selected checkout:

```sh
BROWSER_EXECUTABLE_PATH=/path/to/sandboxed-chrome \
BROWSER_ARTIFACT_DIR=/tmp/worldlaw-import-order-desktop \
node scripts/unknown-lab-import-order-browser.mjs

BROWSER_EXECUTABLE_PATH=/path/to/sandboxed-chrome \
BROWSER_VIEWPORT_WIDTH=390 BROWSER_VIEWPORT_HEIGHT=844 \
BROWSER_ARTIFACT_DIR=/tmp/worldlaw-import-order-narrow \
node scripts/unknown-lab-import-order-browser.mjs
```

Keep baseline and candidate result directories separate. On Linux, the unchanged
`scripts/support/chromium-sandbox.mjs` helper admits the same isolated browser
before opening `/unknown-lab.html`; refusal receipts are retained. Other
platforms record browser/version/platform and explicitly mark this Linux-specific
gate inapplicable. No sandbox-disabling flags are supplied.

## Prepublication package receiving

A fresh working-tree-candidate ZIP was built, extracted and received successfully.
Its manifest honestly records reference commit
`34a8c486787b145b80ffcc4eb3ffc48c9caea517` with `sourceTree: null`; it is **not a
package of a published candidate commit**.

| Package evidence | Received result |
| --- | --- |
| ZIP SHA256 | `e2d7c9445df66645a25ce21a19ff1bcec38e63fbed8e09643c33fcfbc6d9a985` |
| Source files / ZIP bytes | 1,572 files / 63,595,132 bytes |
| Manifest verification | Every listed archive file's size and SHA256 matched the manifest |
| Critical assets | Candidate controller, v2 receiver and unchanged sandbox helper matched the identities above; packager identity also verified |
| Exact two-log exclusions | Logs absent from ZIP; original source log hashes unchanged |
| Fresh extracted package, desktop | 14/14 receiver checks passed |
| Fresh extracted package, 390 × 844 | 14/14 receiver checks passed |
| Browser admission / exceptions | Sandbox admitted; no uncaught page exceptions |
| Keyboard save, reopen and disk export | Same 8,303-byte JSON and download SHA256 recorded above |
| Extracted Studio and Trajectory smoke runs | Both passed |

The recovered native command `estate-2e09e0-package-receive-cmd01` exited **0**.
Its receipt spans `2026-10-28T03:10:26.593958354Z` to
`2026-10-28T03:10:40.536113896Z`. The lead performed the execution; the product worker reviewed the relayed
structured package receipt. Package evidence is retained with the linked receipt
index. The seven package-policy tests separately passed for the two exact log
exclusions.

To repeat receiving against an extracted package:

```sh
WORLDLAW_ROOT=/absolute/extracted-package-root \
BROWSER_EXECUTABLE_PATH=/path/to/sandboxed-chrome \
BROWSER_ARTIFACT_DIR=/tmp/worldlaw-import-order-package \
node scripts/unknown-lab-import-order-browser.mjs
```

The lead visually inspected the actual [desktop](receipts/unknown-import-order-20261028/package-desktop.png) and [narrow](receipts/unknown-import-order-20261028/package-narrow.png)
package screenshots. The root instrument and controls were readable; the narrow
Export control had a visible focus outline. These are scrolled viewport
snapshots, not a visual audit of every downstream panel.

Source and this prepublication package are qualified by the reported checks.
Integration and receiving of a package built from the exact published commit
remain separate; neither deployment nor public release is claimed.

## Control identity and limits

The receiver creates deterministic controls through the served
`paired-history.mjs` using `syntheticChallenge({seed, effect})`; odd seeds use
an effect of 1 and even seeds use −0.5. It declares `source: "measured"` and a
`sourceNote` of `import-order receiver <seed>` solely to exercise the measured
import path, then serializes through the maintained exporter. **These controls
are synthetic, not physical measurements.** The negative control uses seeds
101 and 102.

File selections use actual browser File/DataTransfer objects and change events;
controlled File.text promises determine completion order. This verifies
application handlers and chooser reset, not operating-system file-dialog
interaction or native chooser event generation. Earlier checks compare the
application's actual export Blob while suppressing download navigation. The
final keyboard/reload check removes that instrumentation by reloading and verifies
a real file written to an isolated download directory, including its hash.

CDP keyboard activation tests the focused controls, not a complete keyboard-only
navigation audit. Viewport checks and screenshots do not by themselves establish
visual acceptance. Controlled delayed reads do not establish file-I/O performance,
physical-instrument validity or authenticated measurement provenance.
