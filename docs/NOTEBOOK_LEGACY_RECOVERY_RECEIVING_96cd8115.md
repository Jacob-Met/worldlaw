# Bounded legacy notebook recovery receiving — 2026-10-26

Team: `hamon-estate-96cd8115-20261026`. Canonical estate worker prompt: 2026-10-26.7. Native ownership: [WORLDLAW issue 1](https://github.com/Jacob-Met/worldlaw/issues/1#issuecomment-6428039015).

## User outcome and boundary

[PR 340](https://github.com/Jacob-Met/worldlaw/pull/340) prevents newly exported Studio notebooks from exceeding their own reader's text limit. This follow-up recovers earlier, otherwise valid notebooks whose JSON formatting exceeded that limit.

Startup and the ordinary notebook file picker now pass text through a bounded formatting recovery helper before the existing session parser. Text at or below 2,000,000 UTF-16 code units follows the existing path unchanged. Larger text is scanned only when it is at most 6,000,000 code units, and the retained result must fit the original 2,000,000-unit parser budget. The existing notebook file preflight remains 6,000,000 UTF-8 bytes, and the raw observation file preflight remains 2,000,000 bytes. These byte and code-unit limits are distinct.

The helper preserves every string character, escape, numeric spelling, key order and non-whitespace character. It recognizes only JSON's four whitespace characters. It removes them at input edges or next to structural punctuation; elsewhere it retains one separating space. Thus damaged tokens such as `1 2` or `tru e` cannot silently become valid values. Native JSON parsing and the unchanged schema, metadata, row, event and replay-work validation still decide admission. The separate input-design case callback keeps its existing strict session-parser path.

Startup recovery leaves the original local-storage text intact. Header Save downloads a bounded portable copy without rewriting that storage. A subsequent measured revision uses the existing autosave behavior. Successful file import uses the existing adoption/autosave path only after complete validation. Failed recovery leaves current evidence and stored text unchanged.

The scan limit bounds additional scanning; it does not prevent `localStorage.getItem` from materializing the stored string first. This is not universal recovery of malformed or arbitrarily large historical files.

## Same original files, before and after

The receiver used actual browser downloads retained from the original failure controls, not reconstructed replacements.

| Original fixture | UTF-16 code units | UTF-8 bytes | SHA-256 |
| --- | ---: | ---: | --- |
| Nested metadata | 2,043,468 | 2,043,470 | `c1323dccacdf98e979e731bc3cea188f02adc72862a638532eb91a46e81cd99c` |
| Unicode plus measured revision | 2,267,611 | 2,607,613 | `48a6b2ff7f4ddd179246cdaf75757181d6096a647b58fb309be6c7ecdbb1829c` |

The PR 340 baseline refused both files through both file import and startup: four expected refusal controls, with prior state/storage retained. The new source and extracted candidate each passed all six legacy receiver groups:

- Both original files reopen, autosave bounded text, download and reload with their complete base evidence, metadata, options, events and recomputed history.
- Both startup cases recover while preserving the exact original stored text, including after keyboard-operated Header Save.
- A recovered metadata notebook accepts a new measured revision, autosaves compactly and reloads with nine rows.
- Four split numeric/boolean tokens embedded in otherwise valid notebook metadata refuse without changing current state or storage and without producing a download.

Storage fixtures are seeded once before the tested reload. File checks await completion of the actual input handler before asserting preservation. No JavaScript page errors occurred.

These fixtures are authored software controls, not physical measurements or human acceptance.

## Qualification

Qualified base: `eec7a69a97fd94557f87378391b0eb02fdcc81b4`. Execution through Renpō on Node 22.23.4 and Chrome 156.0.8078.47.

- Current native tests: 19/19 pass, including the eight new legacy groups, existing notebook-size tests and session replay tests.
- Exact 2,000,000-unit retained output and 6,000,000-unit scan boundaries pass; the immediately larger inputs refuse. Escaped quote/backslash parity, literal string whitespace, malformed primitive fragments, non-JSON whitespace, unsupported schemas, 129 events and forged history are covered.
- Existing package-policy tests: 7/7 pass. All paths in the complete remote tree plus new files satisfy the existing policy. No policy expansion was needed.
- Fresh extracted distribution: 7 Studio, 4 Motion Reference, 4 notebook-persistence and 6 legacy-recovery browser groups pass, for 21 groups total.
- The maintained launched-server smoke passes from the extracted distribution. The maintained distribution receiver verifies active browser namespace, PID/network namespace and seccomp protections.

The notebook-persistence receiver now tests irreducible excess content for its oversized-text refusal. Formatting-only padding is intentionally recoverable at the two UI entrypoints. The direct session-parser test continues to require refusal above its original text budget.

The retained independent reviewer assessed the scanner, semantic boundary, consumer controls and receipts. The lead brokered execution; review is not represented as a second independent execution or a submitted GitHub approval.

Reproduction, with separately supplied Playwright and Chrome paths:

```sh
node --test tests/legacy-notebook.test.mjs tests/notebook-size.test.mjs tests/session.test.mjs
python3 scripts/package-policy-test.py
node scripts/smoke.mjs
node scripts/distribution-browser.mjs
node scripts/notebook-size-browser.mjs
node scripts/legacy-notebook-browser.mjs
```

The legacy receiver generates equivalent authored controls by default. `LEGACY_FIXTURE_DIR` selects the retained original downloads; `WORLDLAW_SOURCE_ROOT` and `--baseline` allow the same receiver to demonstrate the earlier consumer failure without modifying that source.

## Candidate artifact and continuity

The maintained packager produced a **working-tree candidate**, not a release or a complete verified Git-tree archive:

- Reference commit: `eec7a69a97fd94557f87378391b0eb02fdcc81b4`.
- Archive SHA-256: `033856c96dc4d3328108c4cd8f9ec41e76cdb1c9b4d20e99710a8deea2d0d277`.
- 417 source files; 7,673,797 bytes.
- Every included manifest length/hash verified after extraction. All five changed implementation/test files match the tested working bytes exactly.
- Every current runtime module is materialized. Historical reference material is not all present, so no full-repository test-suite or complete source-distribution claim is made. These receiving notes were added after package execution.

Workspace: `/home/ubuntu/work/scratch/worldlaw-96cd8115-legacy`. Receipts: `/home/ubuntu/work/scratch/worldlaw-96cd8115-receipts/legacy-*`. Execution owner: `node-72e09d180ec675855992b3cbfb59e9e8`.

Command IDs: `estate-root-96cd8115-legacy-native-qualified`, `estate-root-96cd8115-legacy-package-policy`, `estate-root-96cd8115-legacy-browser-baseline`, `estate-root-96cd8115-legacy-browser-candidate`, `estate-root-96cd8115-legacy-build-candidate`, `estate-root-96cd8115-legacy-extract`, `estate-root-96cd8115-legacy-package-distribution`, `estate-root-96cd8115-legacy-package-notebook`, `estate-root-96cd8115-legacy-package-upgrade` and `estate-root-96cd8115-legacy-package-smoke`.

Intermittent Renpō routing failures were handled by retaining original owners, operation IDs and exact payloads for receipt recovery. No alternate owner or replacement effect identity was used. Existing estate science owners and manual/public-release/hardware holds remain in place.
