# Stale notebook autosave: received source and package

An older Studio tab could replace newly acquired evidence saved by another tab. The actual unpatched browser course acquired 66 observations, then an older 65-observation tab refitted and silently saved its old notebook. The stored row count fell to 65 while the UI reported success.

The repaired storage adapter compares the exact active source with the version this tab loaded or last successfully saved. It refuses a completed external change, keeps the in-memory notebook available, and explains that it must be exported before reload. A detected conflict stays refused for this page. Explicit protected-original archival still verifies both archive and replacement before establishing the next save baseline.

## Source and execution identity

- Original source: `e4f505e21a843a8fe571ef0bd0f0d791a9092cac`; implementation frozen at `3f6294cfffd551d73557038458b1ccf8d1a252f2`.
- Current-main composition: `a66fba03d73658cb4f55f7c7429053fa6fa496ed`, including upstream main `a07755d701d51021344cd289f49bd0b17ee68718`.
- Packaged candidate: **`6e878fcf9ccf5c334d520b928e423065da5aea9e`**, tree `d214e8bb061eb26c2e5ff4b88b7893051d14310b`. This adds only the bounded package-policy repair to the composed application.
- Official Git-commit ZIP: 61,218,491 bytes; SHA-256 **`4eff0937f5b79bdd80992e95b63744487648d00f693a7ddf84862d13b87a7e5e`**. All 1,475 payload hashes/sizes and exactly 1,476 unique archive members, including the manifest, were verified.
- The later documentation/evidence commit does not relabel that tested archive as a different commit.

## Executed checks

| Check | Source and environment | Observed result |
|---|---|---|
| Regression reproduction | Original module plus nine new groups, ThinkPad Node22.22.1 | Six groups fail before repair |
| Focused recovery and conflict | Patched original source | 20 pass |
| Full native tests and two launched smokes | Original base plus implementation, before latest-main composition; Node22.22.1, test concurrency2 | 1,428 pass, one existing optional skip, zero fail; both smokes pass |
| Latest-main composition | `a66fba0`, notebook and new challenge training/course tests | 30 pass; both smokes pass |
| Existing distribution-policy suite | Original candidate then `6e878fc`; Python3.13/Git on Mac | Reproduced tracked-tree failure, then all seven pass |
| Actual source browser before/after | Maintained server, Mac normal user501, Chrome156.0.8078.48, Node26.11.0 | Silent overwrite reproduced before; five repaired groups pass |
| Freshly extracted package browser | Exact `6e878fc` ZIP; same sandbox-enabled Chrome and Node; Playwright1.64.0-alpha-1790635538000 | All five groups and both launched smokes pass |

Native commands are `node --test --test-concurrency=2 tests/*.test.mjs`, `npm run smoke`, and `npm run smoke:trajectory`. Focused composition uses the notebook recovery/conflict and challenge course/training test files. Package commands are `python3 scripts/package-policy-test.py` and `python3 scripts/package.py --source-commit <full candidate SHA> --output <new ZIP outside source>`.

The unchanged `scripts/notebook-autosave-browser.mjs` runs from the extracted `worldlaw/` directory. Set `PLAYWRIGHT_MODULE` to the installed Playwright module and `BROWSER_EXECUTABLE_PATH` to the existing Chrome executable. `BROWSER_ARTIFACT_DIR` names a new evidence directory. Chrome launches with its sandbox enabled. Linux receiving additionally requires an ordinary user and the maintained active-sandbox check.

## Actual consumer outcome

The saved acquired notebook SHA-256 was `701471b79188fd483906e81aaeeb953ac3437d6640dbc0ab9001efd3c17933ce`. It remains byte-identical after the older tab's refit and visible undo. Before repair, the stale refit changed it to `7c220b553959fe6495a0388433cfb77c1de6366deabec0994420fc821d67b95c`.

The stale tab's keyboard export reopens through the ordinary importer with its 65 observations and edited noise0.023. A fresh same-origin tab exports the acquired 66-observation notebook, including the actual virtual input command0.4, position1.4, rate−0.7. The current writer can still save. Two pages opened before any saved notebook also refuse the stale first-save attempt. No page exceptions were observed.

[Desktop capture](receipts/notebook-autosave-20261027/desktop.png) · [390px capture](receipts/notebook-autosave-20261027/narrow.png). The narrow document stays390px; the warning occupies x18..372 and wraps. Keyboard export and reduced-motion presentation were exercised. The inherited small, subdued status typography remains a presentation limitation.

## Packaging prerequisite and preserved failures

The official packager initially refused 42 historical receiving paths already on main. The repair admits the exact 36 benign notes, JSON receipts, receiver-source and PNG paths, and omits six exact raw logs through the existing omission set. It adds no wildcard or policy exception for unknown paths. All seven maintained policy tests pass, including no-read omissions, renamed/uppercase negatives, unknown outputs/secrets/traversal and file/directory symlinks. The six logs are absent from the ZIP and its manifest. Their original repository evidence is retained.

ThinkPad browser startup was blocked by its existing sandbox/user-namespace policy; its installed Chromium snap also failed launch. No policy was changed. The initial Mac harness failed because the Fit settings disclosure was closed; the corrected v2 course opens it normally and produced the reported before/after evidence. These failures are not counted as successful receiving.

## Review and limits

The lead executed the checks and inspected the actual screenshots. Retained independent and consumer workers reviewed brokered source/evidence and accepted the bounded result; their stalled external routes are not presented as independent execution.

This is sequential stale-source detection, not atomic cross-tab exclusion. Two simultaneous writers can both pass separate read checks; an intervening change returning to identical bytes can be undetected. The app does not merge independent notebooks. Export unsaved work before reloading. Source read/write failures and protected-original recovery are covered by native tests. Browser acceptance covers the reported Mac Chrome environment. All acquisitions in this course use the maintained seeded synthetic virtual instrument, not physical measurements.

[Machine-readable receiving identity and native-log hashes](receipts/notebook-autosave-20261027/receiving.json), [package manifest receipt](receipts/notebook-autosave-20261027/package.json), and [packaged browser receipt](receipts/notebook-autosave-20261027/package-browser.json) preserve exact attribution. The exported older and newer notebooks and the original before/after comparisons are beside them.
