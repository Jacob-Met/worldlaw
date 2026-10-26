# Studio notebook persistence receiving — 2026-10-26

Team: `hamon-estate-96cd8115-20261026`. Native claim: [issue 1](https://github.com/Jacob-Met/worldlaw/issues/1#issuecomment-6427133280). Canonical estate worker prompt: 2026-10-26.7.

## User outcome

Accepted Studio evidence can be saved, downloaded and reopened without formatting making the notebook exceed its own reader's limit. Ordinary notebooks keep their existing two-space formatting. Larger formatted envelopes use equivalent compact JSON, with an explicit final size guard. The notebook file preflight allows 6,000,000 UTF-8 bytes; the existing parser limit remains 2,000,000 UTF-16 code units. UTF-8 needs at most three bytes per code unit. The raw observation-file limit, schemas, metadata allowance, row/event limits, replay work and scientific calculations are unchanged.

The fixtures are authored software controls, not physical observations or evidence of a new scientific capability.

## Original controls and changed behavior

Original source: `ae2c799cc33c2969194fa154bf244847b3330df7`. Qualified composition: `e54b9ad281a9b7e8b9c542d6ab4dfb9bb44fc1c1`, including concurrent PRs 338 and 339.

| Control | Input | Original output / failure | Changed output / result |
| --- | --- | --- | --- |
| Permitted nested metadata | 242,059 UTF-8 bytes; 120,000 retained flags | 2,043,468 code units; browser reload rejects its stored notebook and leaves the bytes intact | 242,357 code units / 242,359 bytes; save, reload, keyboard download and file reopen preserve the metadata |
| Unicode and numeric normalization | 1,959,882 UTF-8 bytes; 4,095 training rows and 4,096 held-out rows | After one UI measurement, pretty output is 2,267,611 code units. Its whitespace-only compact equivalent fits the parser but is refused by the old file byte preflight | Actual downloaded file is 1,743,067 code units / 2,083,069 bytes; file reopen and reload preserve all metadata, the measurement event and history |

The Unicode input uses equivalent short exponent spellings of the numeric values and U+0800 in metadata. No state is injected into the application. The source enters through its ordinary observation picker, and the added observation enters through the measured-outcome controls.

Malformed JSON, text above the unchanged parser limit, notebook files above 6,000,000 bytes, and raw observation files above their unchanged 2,000,000-byte limit refuse without replacing the current notebook. Instrumented file reads confirm that the two byte preflights refuse before reading the file text. A separate native control proves that an unsupported envelope whose compact export exceeds the text limit throws before export returns.

## Executed checks

The lead executed these checks through Renpō on Linux with Node 22.23.4 and Chrome 156.0.8078.47. Retained `independent_review`, `runtime_recovery`, and `service_routes` reviewed the implementation, size bounds and consumer evidence. Their initial external discovery calls stalled; the lead brokered execution. Reviewer assessment is not represented as a second independent execution.

- Original-first focused native controls: 1 pass and 3 expected failures on original source; all 4 pass with the change.
- Current composition: 50 selected native tests pass across session replay, notebook size, declared weights, interaction, feature libraries, virtual-notebook portability and offered inputs.
- Maintained launched-server smoke passes.
- Existing package-policy tests: 7 pass. The policy also accepts every path in the complete remote tree plus the new files. All changed files are included by existing patterns; policy was not broadened.
- Fresh extracted candidate: maintained Studio receiver passes all 7 groups, including the default virtual experiment, improved held-out prediction, download/replay/undo, imported measurements, invalid dynamics, 320–1440 pixel layouts and stale-file-read refusal.
- The same extracted candidate passes all 4 Motion Reference groups, including the ordinary Motion Lab link, independent 3–4–5 and 6–8–10 controls, forged-answer and wrong-source refusal, and narrow keyboard operation.
- The notebook regression receiver passes all 4 groups against the extracted candidate. Desktop and 390-pixel rendering were captured; no page errors were observed.
- The maintained distribution receiver confirms active namespace, PID/network namespace and seccomp browser protections.

Reproduction commands, with separately supplied Playwright and Chrome paths:

```sh
node --test tests/session.test.mjs tests/notebook-size.test.mjs tests/weighted-fit.test.mjs tests/interaction.test.mjs tests/competitive-library.test.mjs tests/virtual-notebook-portability.test.mjs tests/input-excitation.test.mjs tests/library-proposal.test.mjs
node scripts/smoke.mjs
python3 scripts/package-policy-test.py
node scripts/notebook-size-browser.mjs
node scripts/distribution-browser.mjs
```

The last two commands were run from the freshly extracted package, with `PLAYWRIGHT_MODULE`, `BROWSER_EXECUTABLE_PATH` and an external `BROWSER_ARTIFACT_DIR` set. The new receiver requests a sandboxed browser; the distribution receiver additionally checks the actual protections.

## Artifact and scope

The maintained packager produced a **working-tree candidate**, not a release or a verified complete Git-tree archive:

- Reference commit: `e54b9ad281a9b7e8b9c542d6ab4dfb9bb44fc1c1`.
- Archive SHA-256: `963ab7f1ae6dfdab265884685a3fd2980534d6b43bf2bf94afaecb54f9f9c932`.
- 413 source files; 7,648,709 bytes.
- All included manifest lengths/hashes checked after extraction.
- Every current runtime source module is included; all five implementation/test files match the tested working bytes exactly.

This candidate materializes the complete runtime, entry-point assets, examples, required documentation and selected tests. It is not a complete repository snapshot: historical reference material is not all present, and the connected source route could not retrieve a large binary receipt. No full-repository test-suite, public-release, deployment, physical-validation or human-acceptance claim is made.

The source tree and receipts are retained on the execution owner under `/home/ubuntu/work/scratch/worldlaw-96cd8115` and `/home/ubuntu/work/scratch/worldlaw-96cd8115-receipts`. Command IDs for current qualification are `estate-root-96cd8115-current-native`, `estate-root-96cd8115-current-smoke`, `estate-root-96cd8115-package-policy`, `estate-root-96cd8115-build-candidate`, `estate-root-96cd8115-extract-candidate`, `estate-root-96cd8115-package-browser`, `estate-root-96cd8115-package-notebook`, and `estate-root-96cd8115-package-smoke`, all owned by `node-72e09d180ec675855992b3cbfb59e9e8`.

## Remaining work

At this receipt's original boundary, the change prevented newly generated oversized exports; older pretty notebooks still required a separate bounded recovery path. The subsequent [legacy recovery receiving record](NOTEBOOK_LEGACY_RECOVERY_RECEIVING_96cd8115.md) documents that follow-up, including token-boundary preservation and unchanged scientific validation. Startup continues to preserve the original stored text.

The attempted dedicated issue creation `estate-root-96cd8115-worldlaw-claim` on service owner `node-2b8c9803b6069b758adef320e07b48ed` has no confirmed receipt and was not replayed. The confirmed native parent-issue comment carries ownership. Existing science/integration owners and PR 9's manual hold remain in place.
