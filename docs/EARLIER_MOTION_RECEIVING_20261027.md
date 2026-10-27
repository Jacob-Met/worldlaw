# Earlier-law motion receiving — 2026-10-27

## Outcome and design

Studio can compare the laws saved before a measurement even after that measurement changes the current competitive set. The receiving fixture retains all 16 earlier laws when only nine current laws remain. Comparison executes saved coefficients and ranges directly, without refitting or joining against current model IDs. Budgets and refusals apply to the complete original set.

The feature reuses the existing instrument, comparison transport and plots. A second timeline would duplicate navigation and obscure which laws drive the instrument. Explicit source labels instead distinguish earlier and current laws in one comparison. Historical motion uses the current declared release, starts paused, and is described as reconstructed from notebook inputs rather than an authenticated forecast. Receipt changes retire derived paths until rerun; clearing restores the current simulation and keyboard focus. Export remains input-only. Reopening reconstructs earlier laws; motion requires an explicit rerun.

## Tested application and distribution

Application candidate: `cc53c56cf8342d0553d25d9592f8cf8d9a84b250`  
Tree: `0ceaa04257c6fdc4607a9ac48cba2d9c90fbde8a`

This candidate adds the exact recovered 54-byte file-input CSS rule to `8794c2f74c1f9b67a2b0742a08594abb0a8c97c1`. The maintained **full Studio source ZIP** is the receiving artifact:

- Size: 61,221,414 bytes; 1,473 files.
- SHA-256: `76ceb58c75e49cb45988e4bc176ea64f63ce1a84a465bed66ab3c344849f66d0`.
- Every manifest file verified; fresh extraction and `npm start` checked.
- Served module hashes, HTTP 404/405 behavior, and both smoke checks passed.

## Executed evidence

| Scope | Result |
| --- | --- |
| Native suite at `8794c2f74c1f9b67a2b0742a08594abb0a8c97c1` | 1,429 pass, one skip, zero failures |
| Smoke and package-policy checks at that revision | Both smoke checks and all seven package-policy tests pass |
| Historical motion, 390 px, from candidate ZIP | Six groups pass |
| Current motion, from candidate ZIP | Five groups pass |
| Maintained experiment receipts, from candidate ZIP | Four groups pass, including 320 px layout, export, reopen and undo |
| Historical motion, default 320 px, from candidate ZIP | Six groups pass |

The ZIP browser courses used actual Chrome 156 with the standard launcher and verified sandbox. Native results above apply to the explicitly named predecessor revision; they are not represented as a rerun on the CSS-only candidate.

Historical receiving checks cover the original law set, changed same-ID coefficients, direct-executor curve agreement, complete-set refusal, explicit current/historical switching, receipt selection, input-only export/reopen, reduced motion and keyboard comparison controls. Viewport metadata and screenshot names identify the executed width; 390 px results are not substituted for the default 320 px gate.

## Retained failure and bounded layout recovery

Earlier `8794c2f74c1f9b67a2b0742a08594abb0a8c97c1` receipt and historical 320 px courses failed: document width was 349 px at a 320 px viewport. Those failures remain part of the evidence. They do not establish a historical pass and are superseded only for the candidate ZIP by the new receiving results above.

The repair recovers the original estate2adf 54-byte CSS rule from that owner's artifact on coord1. Recovered source SHA-256: `67ad1f592837d0502dd53ebf882acd45ae65387f3813d31fcc361a2069d33018`. The original owner's record remains untouched. The separate integration recovery task is `worldlaw-2adf-layout-integration-estate-48a767a1-20261027`, revision 2, with reconciliation SHA-256 `a702782cff83901769213dd6f660bbc832ccecf7ccbfb33322419e78ac945519`.

The original owner's 05:50 passes are provenance, not current receiving proof. Current proof comes from the freshly extracted candidate ZIP. Package policy retains exact historical-log omissions and explicit admitted paths rather than broader exclusions.

## Reproduction environment and commands

Native receiving used Node 22.22.1; extracted-package receiving used Node 22.23.4, Playwright 1.64.1 and Chrome 156.0.8078.47. The product needs Node >=20 and no npm runtime installation. Browser receiving uses the separately supplied Playwright module and a Chromium launcher with its sandbox enabled.

From the source checkout, run `node --test --test-concurrency=2 tests/*.test.mjs`, `npm run smoke`, `npm run smoke:trajectory` and `python3 scripts/package-policy-test.py`. Build the full distribution with `python3 scripts/package.py --source-commit cc53c56cf8342d0553d25d9592f8cf8d9a84b250 --output ../worldlaw-cc53.zip`, using a fresh output filename. Extract it into an empty directory and use its `worldlaw` directory as the working directory.

Set `PLAYWRIGHT_MODULE` to the absolute installed Playwright entry module and `BROWSER_EXECUTABLE_PATH` to the installed sandbox-capable Chrome launcher. Give every run a separate fresh `BROWSER_ARTIFACT_DIR`. Execute `node scripts/earlier-motion-browser.mjs` at its default 320-pixel viewport and again with `BROWSER_NARROW_WIDTH=390`; also execute `node scripts/studio-comparison-browser.mjs` and `node scripts/experiment-receipts-browser.mjs`. These commands launch and operate the application server from the extracted source. The structured receipts alongside the screenshots retain exact run identities and the additional chooser receiver source digest.

## Screenshots

- [Historical instrument, desktop](receipts/earlier-motion-20261027/historical-motion-desktop.png)
- [Historical comparison, desktop](receipts/earlier-motion-20261027/historical-comparison-desktop.png)
- [Historical instrument, 320 px](receipts/earlier-motion-20261027/historical-motion-320.png)
- [Historical comparison, 320 px](receipts/earlier-motion-20261027/historical-comparison-320.png)

## Native chooser receiving and integration status

The lead executed the ephemeral receiver with SHA-256 `515f12a0961528a9becaec8babab610b94d75e0841bf7063d08b9939798cea4a` against the exact candidate ZIP extraction: exit 0, Chrome `156.0.8078.47`, sandbox verified. Keyboard Enter opened the native file chooser. Actual exported replay passed the public checker with exact weights; the notebook remained unchanged. At 320 px, document width was 320 px and the input occupied x=34 through x=289 (255 px), matching its parent width. No page errors, bad responses or external requests were observed.

- [Native chooser input focused, 320 px](receipts/earlier-motion-20261027/historical-chooser-focused-320.png)
- [Historical replay panel, 320 px](receipts/earlier-motion-20261027/historical-replay-panel-320.png)

Review responsibilities: the lead executed receiving; the consumer reviewer reviewed behavior and authored receiving checks; the source reviewer independently reviewed packaging and science; the work-state reviewer inspected viewport enforcement and evidence wording.

This document records candidate receiving evidence. It does not claim final documentation integration, final merge or public release. Private integration is authorized; public release remains held.
