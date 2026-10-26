# Studio source import receiving — 2026-10-26

Team: `hamon-estate-9e5183-20261026`. Native scope: [WORLDLAW #342](https://github.com/Jacob-Met/worldlaw/issues/342). Canonical HAMON worker prompt: v2026-10-26.8.

## User outcome

The newest selected source file owns a pending Studio replacement across observations, notebooks, command-map comparisons, input-design cases and angular-frequency inputs. An older asynchronous read cannot replace, persist or export its source while a newer selection is pending. If the newest file is refused, the previously accepted notebook remains intact; the obsolete read is not revived.

Every replacement entry point starts the same source generation before reading. Panel-local declaration revisions and connectedness still apply. Ordinary evidence adoption, refitting and undo also retire pending replacements. Frequency inference observes the generation without claiming a replacement. Separate per-input read serials prevent an older completion from clearing a newer selection, while allowing successful same-file reopening.

The scientific algorithms, source schemas, data limits and finite-library interpretation are unchanged. The concurrent legacy notebook recovery from [PR #341](https://github.com/Jacob-Met/worldlaw/pull/341) is preserved at startup and the main notebook picker.

## Original-first failure

Untouched main `eec7a69a97fd94557f87378391b0eb02fdcc81b4` was launched in real sandboxed Chrome. Controlled `File.text()` completion gates used distinct authored A and B sources: A was selected first with 17 observations; B was selected later with 12.

Five of twelve cases incorrectly displayed and persisted A:

- Command-map panel first, then main observations, with A completing first.
- Main observations first, then command-map panel, with A completing first.
- Input-design panel first, then main observations, with A completing first.
- Main observations first, then input-design panel, with A completing first.
- Main observations first, then frequency panel, with A completing first.

The opposite completion orders passed. The maintained six-group Studio dynamics receiver also passed on that baseline, illustrating why broader source-entrypoint coordination needed a separate consumer check.

Baseline receipt: `receiving/import-order-baseline/receipt.json`, command `hamon-9e5183-consumer-baseline-probes-20261026-01`.

## Qualified composition

Current main advanced through PR #341 during implementation. The full recovered source was composed with its seven changed files. Its Git index tree exactly matched the native GitHub tree:

- Base commit: `07a8362dbd4656c3d555bbac2e6569c1757638be`.
- Base tree: `3edc4a34a6c68b312416f79f09e5cb23260ee209`.

The candidate changes four runtime modules and adds the maintained browser course. Browser responses matched these exact runtime bytes:

| Path | SHA-256 |
| --- | --- |
| `src/app.mjs` | `4f45d939fbe7f2983a3d02c99f78dd014aeff3bc8083d41ed84ee63b95affe8a` |
| `src/science/command-deadzone-panel.mjs` | `1dc8eefb683974cdd015c0ead37a83a8ab84d60dddebbcad385e239ec4f40520` |
| `src/science/excitation-design-panel.mjs` | `0ab156b577285be467591bac03c3322c90f0b60ca9ba88e19139041925b8f7c3` |
| `src/science/angular-frequency-panel.mjs` | `4294454c7fac738fdd1731aaa6a8f80f88a0c672ea778cfb67a7db575c55d392` |

Receiving script SHA-256: `21cdab018bc5c8e687a456bff2fccb470d8cd7e45200fe70ddd85af4c3d10b88`.

## Actual receiving

Execution used Renpō owner `node-edba2efbb070062f49f5eb7b33b2aec3`, Node 22.23.4, Playwright 1.49.1 and Chrome 156.0.8078.47. Browser courses request the Chromium sandbox; the independent and maintained distribution courses verify active namespace and seccomp protections in that browser.

- `npm run verify`: all **1,286 native tests passed**, with zero failures or skips; both actual launched Studio and Trajectory smoke courses passed.
- `python3 scripts/package-policy-test.py`: all **seven policy tests passed** on the complete tracked source. No distribution policy expansion was needed.
- `node scripts/studio-source-import-browser.mjs`: all **27 ordering cases passed**, plus the ordinary keyboard experiment, structural revision, held-out comparison, download/reload/undo/reopen and malformed-input atomicity journey.
- The ordering course covers main ↔ panel, panel ↔ panel, observation ↔ notebook, both relevant completion orders, malformed newest input in both completion orders, and overlapping reads followed by same-file reopening for all five file pickers. It checks transient accepted state, exact downloaded base and observation hashes, and pending file-input cleanup.
- The same 27-case course and golden path passed from a fresh extracted source package.
- Extracted `scripts/distribution-browser.mjs`: **11 groups passed** across Studio and Motion Reference, including ordinary navigation, shared runtime modules, exact source reopening, wrong-source refusal and narrow keyboard use.
- Extracted `scripts/legacy-notebook-browser.mjs`: **six groups passed**, including bounded formatting recovery, original storage preservation and split-token refusals.
- Extracted `scripts/studio-dynamics-browser.mjs`: **six groups passed**, including independently calculable motion, changed inertia, persistence, invalid-inertia clearing and narrow reduced-motion behavior.

The synthetic golden path changed held-out RMSE from 1.645 to 0.000957 N·m. This is the existing declared virtual-instrument control, not physical discovery or measured accuracy. No JavaScript page errors occurred. Independent receiver measurements found document widths equal to 1,440 and 390 pixels respectively; the lead also inspected actual desktop and narrow viewport screenshots. Controls, source counts and the desktop mechanism canvas rendered without clipping.

## Source package and reproduction

Pre-publication candidate archive:

- SHA-256: `2009eb8b4fa47e7b8958b0aececf0f07667179c406926e3a72d1797d8dfb6750`.
- 1,314 included source files, 56,167,856 bytes.
- All included lengths and hashes verified after extraction.
- Mode: **working-tree-candidate**, referencing the base commit above. This receiving note and its README link were added after that candidate package execution.
- Publication, resulting-main tree verification and the final verified-tree package receipt belong to the native PR/issue. The candidate archive is not a release claim.

With separately supplied `PLAYWRIGHT_MODULE`, `BROWSER_EXECUTABLE_PATH` and an external `BROWSER_ARTIFACT_DIR`:

```sh
npm run verify
python3 scripts/package-policy-test.py
node scripts/studio-source-import-browser.mjs
node scripts/distribution-browser.mjs
node scripts/legacy-notebook-browser.mjs
node scripts/studio-dynamics-browser.mjs
```

The source-order receiver defaults to its own repository root; `WORLDLAW_SOURCE` can target an explicitly selected source tree. `SOURCE_COMMIT` annotates its receipt and does not authenticate source by itself. The receipt includes hashes of the actual served runtime modules, inputs and downloaded evidence.

Workspace: `/home/ubuntu/hamon-work/estate-9e5183-worldlaw-20261026`. Receiving directories: `receiving/source-order-candidate` and `receiving/source-order-extracted`. Commands: `hamon-9e5183-worldlaw-candidate-receiving-20261026-01`, `hamon-9e5183-worldlaw-candidate-package-20261026-01` and `hamon-9e5183-worldlaw-extracted-receiving-20261026-01`.

The retained independent reviewer authored and reviewed the receiving course and inspected the implementation. The lead brokered actual execution and integration through Renpō; this is not represented as a separately submitted GitHub approval or a second independent execution. Existing science owners and the PR #9 hold remain intact. GitHub Actions was not run, and no substitute status, deployment, physical operation or contest submission is claimed.

