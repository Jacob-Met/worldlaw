# Motion notebook saving and compact Studio transfer

Issues: [#343](https://github.com/Jacob-Met/worldlaw/issues/343) and [#346](https://github.com/Jacob-Met/worldlaw/issues/346). Team: `9e5183`. This record covers source preservation and a bounded evidence handoff; it does not qualify physical mechanism acquisition.

## User workflow

In Motion Lab, select one continuous evidence segment. Supply known constant inertia and an explicit constant applied torque, optionally override the angle-noise assumption, and confirm those declarations. Choose **Export studio observations**, then import that downloaded JSON using **Import observations** in the torque studio.

Use **Save matching Motion notebook** to retain the exact source snapshot identified by that export. Keep the original video separately for pixel inspection. The compact Studio file contains exact angular inputs and derivation lineage; the matching Motion notebook contains original pixel points, per-row clocks, tracking diagnostics, gaps, corrections, source metadata and revision history. Saving the current Motion notebook after further edits can produce a different snapshot.

Motion's ordinary **Save notebook** also preserves the complete validated notebook. It uses readable JSON when the result fits the existing 8 MiB file-reader limit, otherwise compact JSON with identical content. Formatting must not make a supported notebook impossible to reopen.

## What the handoff preserves

The Studio download remains a `worldlaw.observations/v1` dataset. Its source metadata uses `worldlaw.motion-studio-source/v1` and retains:

- Every selected `[time, unwrappedPosition]` pair in seconds and radians, without rounding, interpolation or resampling.
- The verified contiguous original measurement range, selected-course identity and original measurement count. Derivative-window indices refer to this selected course; the range maps them back to the full notebook.
- The normalized active angular calibration, including a declared metric plane when present, and bounded original source identity.
- The constant inertia and command declarations, resolved scalar position-noise value and its origin, derivative settings, diagnostics and disjoint source-window split.
- Status and clock summaries, reference-event identity and fitted-reference conditioning warnings. Complete per-row and reference-history details remain in the matching notebook.
- The SHA-256, UTF-8 byte length and schema of the exact serialized Motion export snapshot. This identifies exported bytes, not necessarily the originally uploaded file's formatting.

The maintained scalar estimator consumes the retained times, positions, constant command and resolved settings. The legacy synchronous `exportStudio()` and complete `exportAngular()` outputs remain available with their original contracts. The new preparation path shares the existing guarded derivation rather than introducing another fitter.

## Two different receiving checks

`replayStudioExport(dataset)` recomputes the derived training and held-out observations and their source-window split from the retained angular inputs. It checks internal numerical consistency. It has not inspected the original pixel measurements or video.

`verifyStudioExportSource(dataset, notebookText)` additionally checks the supplied notebook's exact byte length and SHA-256, then reconstructs the compact handoff from that notebook's measurements, calibration and selected course. A matching snapshot establishes content identity and reproducible lineage. It does not authenticate video pixels, the acquisition clock, physical forces or measurement truth. Inspecting pixels still requires the separately retained original video.

An accepted fitted reference remains conditional on its source observations. A downstream train/check split does not turn that reference into independently calibrated evidence. Numerical differentiation still amplifies noise and introduces smoothing bias; assumed pixel/angle noise is not calibrated tracking confidence.

## Bounds and refusals

The handoff retains the existing 4,000-measurement Motion bound, 250,000-serialized-character Studio metadata limit and observation parser limit. The actual outbound observation file must also fit 2,000,000 UTF-8 bytes. Readable output falls back to compact JSON when necessary; no measurements are silently dropped to fit.

The original physical and continuity guards remain: explicit dynamics confirmation, positive known inertia, bounded explicit command, adequate continuous evidence and explicit course selection when gaps produce multiple courses. Local-video torque derivation still requires decoded media timestamps. Nominal seek positions remain insufficient. Tracked-pivot measurements remain angle-only because the fixed-pivot scalar torque model omits possible inertial forcing from pivot motion.

## Receiving status

The following outcomes were relayed by the integration lead from execution through Renpō; this document does not claim separate local execution by its author.

| Check | Status | Evidence or scope |
| --- | --- | --- |
| Focused native export and serializer tests | **Passed** | `node --test tests/motion-studio-export.test.mjs tests/motion-notebook-output.test.mjs`: 13 passed, 0 skipped. |
| Short legacy export and full angular provenance | **Passed in focused native tests** | Existing synchronous output, complete measurements and scalar results retained. |
| Compact 1,000- and 4,000-measurement handoff | **Passed in focused native tests** | Actual observation parser, exact scalar replay and matching-notebook source replay; original notebook unchanged. Authored software fixtures. |
| Gap/course mapping, metric plane, reference history and noise origin | **Passed in focused native tests** | Original lineage and existing conditional assumptions retained. |
| Changed input/output and mismatched source controls | **Passed in focused native tests** | Replay or exact source receipt detects the relevant mismatch; existing clock, pivot and dynamics refusals remain. |
| Original browser Save failure | **Reproduced** | Baseline 04 accepted the original compact input, downloaded oversized pretty JSON, and refused its reopen. An actual error JPEG was captured after bringing the page forward. Earlier baseline 02/03 capture timeouts remain harness failures. |
| Actual browser Save of the original large notebook | **Passed** | Complete diagnostic content retained in a 1,582,180-byte download including newline; fresh notebook reopen passed. Exact hash below. |
| Actual browser Motion export → Studio import and reopen | **Passed** | Nine browser groups: actual import/export, Studio fitting, session reopen, matching Motion notebook reopen and original input preservation. Twelve stale-preparation controls cover source, segment, inertia, command, sigma and confirmation changes, each with delayed success and delayed failure. |
| Actual rendered layout inspection | **Passed** | The integration lead inspected actual 1,440 px desktop and 390 px narrow Motion-panel captures: legible text, wrapping without clipping, and clear matching-source controls. |
| Maintained metric-plane decoded-movie consumer | **Passed** | Six groups: actual decoding/tracking, retained initial tracking loss and explicit corrections, source-bound plane refusals, removal/reopen/reattachment, narrow keyboard focus, and separate-recording Trajectory fit/forward prediction/reopen. Zero page errors or external requests. |
| Full native regression and launched-product smokes | **Passed with one conditional skip** | `npm run verify`: 1,299 tests total; 1,298 passed, 1 skipped, 0 failed. Both launched smokes passed. The optional live Node/Chromium portability case in `tests/trajectory-experiment-portability-92be.test.mjs` was skipped because `PLAYWRIGHT_MODULE` was unset; it is not counted as passed. |
| Candidate package qualification | **Passed** | Seven package-policy checks; all 1,321 included files verified after fresh extraction; launched Studio smoke, all nine Motion-transfer groups and all eleven maintained distribution-browser groups passed from the extracted application. The new imported modules were included and served. |
| Exact integrated commit and publication receipt | **Recorded separately** | The associated native PR is the authority for the reviewed head, merge commit, complete source tree and fresh published-package receiving. Candidate results alone do not imply publication. |

### Original Save boundary input

The lead identified the original large-notebook input as SHA-256 `65e1a048546c6bd0127a7902ccce49d536c852869c30ee843a2456038ee04dcf`. The original browser accepted this **1,582,179-byte** compact input. Its Save operation produced **11,423,262 bytes**, SHA-256 `54fe3a7cc3c181ce6f17f8cb0834aae2311be0db7f4dda0bd23999b4c46c7b0a`, exceeding the existing 8 MiB reader limit. Reopening that actual download was refused with “Motion notebooks must be at most 8 MB.” Baseline 04 captured the error in an actual JPEG after bringing the page forward. Baseline 02/03 screenshot timeouts are retained as harness failures, not product passes.

The candidate's actual Save download is **1,582,180 bytes**, including its terminal newline, SHA-256 `c988689235ce4b5b0c944963be9d3cbf5f6ae9c7ee5b8e0db5fc4478679340ed`. Its complete diagnostic content matched and it reopened through the actual file control, waiting for the new completion notice.

### Actual compact-transfer browser outputs

The lead relayed a passing nine-group browser receipt from receiver SHA-256 `3ff6c205b48527622610da754268125d1c03acf43110d63dd9d9c541b14ba773`. The authored long-course downloads entered the real Studio fitter and survived session and matching Motion notebook reopen:

| Selected measurements | Training rows | Held-out rows | Metadata characters | Studio download bytes |
| --- | ---: | ---: | ---: | ---: |
| 1,000 | 694 | 294 | 36,471 | 235,627 |
| 4,000 | 2,794 | 1,194 | 133,742 | 930,382 |

The exact matching Motion snapshot hashes are:

- 1,000 measurements: `6f36a96979f086e77498077837073c65fc0db9132ee19a767f9f01f27db20743`.
- 4,000 measurements: `9a689c09cda2bd581719839742912699a75a874c351b7ec97f84501afc22a8c3`.

A synthetic raster sequence additionally exercised actual tracking: 31 retained rows, 30 accepted rows and 15 training observations. This is generated-pixel software receiving, not an acquired physical-video or physical-law validation claim. The stale-operation controls confirmed that superseded preparation neither downloads an obsolete export nor replaces current feedback, for both success and failure completions.

### Maintained decoded-movie regression

The maintained metric-plane browser course passed six groups using the repository's existing pinned `examples/metric-plane` assets; no newly generated substitute was used. Each fit/challenge course retained 160 frames. Initial tracking loss remained visible, followed by one explicit manual correction on the fit recording and two on the challenge recording. The same existing Trajectory consumer selected rate plus spring and reported challenge RMSE **0.0035073523538161856 rad**. This is regression evidence for an already qualified authored control, not a new accuracy or physical-performance claim.

The authored video identities were:

- Fit: `5a27a92fe35d38e54f303b8299693f630223c6d252076b52820cb4e302e66d7c`.
- Challenge: `1740ff6d082d562f7b35bbb1d28e6eaaf5f0de1198d23721fb369912a59ad3c9`.

### Extracted candidate package

The archive `worldlaw-motion-transfer-candidate.zip` was **56,253,208 bytes**, SHA-256 `138db55ce3fd5b38c72d73bf5e382bd4d0e04962058579e39eb37981518e2b7b`. It was explicitly labeled `working-tree-candidate`, based on main `50f5afe4ad16d1536f05cb46d4ff0f66be4a902c`, with staged candidate tree `9badfe11c85788cafed3b6becb4c8b4eaf87dabc`. Every manifest entry matched its extracted byte length and SHA-256. Only receiving-document text changed after this candidate archive; qualified runtime and receiver hashes remained unchanged.

The extracted application passed `npm run smoke`, `node scripts/motion-studio-transfer-browser.mjs` and `node scripts/distribution-browser.mjs`. The latter retained ordinary Studio experimentation, source preservation, notebook reopening and the distributed Motion reference-image consumer. Renpō command `hamon-9e5183-motion-package-candidate-20261026-01` completed with exit 0 on owner `node-edba2efbb070062f49f5eb7b33b2aec3`. Logs, manifest receipt, downloaded fixtures and browser evidence are retained under `/home/ubuntu/hamon-work/estate-9e5183-worldlaw-20261026/receiving/motion-transfer/package-candidate` on that host.

## Environment and reproduction

The lead brokered receiving through the Renpō browser host with **Node.js 22.23.4**, **Chrome 156.0.8078.47** and **Playwright 1.49.1**. Browser sandbox admission passed. The evidence above is from that executed environment; it does not promise arbitrary browser or decoder equivalence.

From the candidate source checkout, the focused and full native commands are:

```sh
node --test tests/motion-studio-export.test.mjs tests/motion-notebook-output.test.mjs
env -u PLAYWRIGHT_MODULE npm run verify
```

The second command reproduces the recorded conditional-skip configuration. It does not count the gated live Chromium portability case as passed.

For actual browser receiving, set `WORLDLAW_SOURCE` to the absolute checkout path and use an artifact directory outside that checkout. Substitute locally installed browser/module paths when receiving on another machine:

```sh
export WORLDLAW_SOURCE=/absolute/path/to/worldlaw
export PLAYWRIGHT_MODULE=/home/ubuntu/.npm/_npx/f0a362733743bae2/node_modules/playwright/index.mjs
export BROWSER_EXECUTABLE_PATH=/opt/google/chrome/chrome
cd "$WORLDLAW_SOURCE"
export SOURCE_COMMIT="$(git rev-parse HEAD)"
BROWSER_ARTIFACT_DIR=/absolute/path/to/evidence/motion-transfer node scripts/motion-studio-transfer-browser.mjs
MOTION_FIXTURE_DIR="$WORLDLAW_SOURCE/examples/metric-plane" INFER_PLANE_REFERENCE=0 BROWSER_ARTIFACT_DIR=/absolute/path/to/evidence/metric-plane node scripts/motion-metric-plane-browser.mjs
```

The original Save failure was exercised against baseline `50f5afe4` using the external receiving script's `--baseline-save-only` mode. Keep that failure receipt distinct from the candidate's successful Save/reopen result. Exact integrated/merged commit and package identities belong in the publication receipt; they are not implied by this candidate record.

## Remaining qualification

Focused tests establish a bounded software transfer and replay contract. They do not establish real-video tracking accuracy, physical-law recovery, calibrated uncertainty, independently measured mechanisms, human acceptance, submission or deployment. The original product's broader acquisition and scientific-discovery requirements remain open.
