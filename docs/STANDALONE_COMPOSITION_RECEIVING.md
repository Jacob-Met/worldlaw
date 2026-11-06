# Combined application compilation and the standalone return-bound worker

## Executed result

Native esbuild 0.27.3 compilation of the actual trajectory application entry succeeded against the exact combined runtime source at `3f70a51626e31b70751271d3bbf8d7ee5456cc5d`. All **149 compiled input files** match their Git blobs in tree `cbb89c6aa4f6a8dc8a042fe95c85f2f91a209c6b`. Both the delegated joint-state fitter and corrected bounded helper contribute code to the output.

The supported `write:false` API returned one JavaScript output, with no remaining output imports:

- Bytes: **1,129,698**.
- SHA-256: `7657898d6bf0592208bee0068f126fc12b4340854c055fcb4ea47e1337fc3c14`.
- Node: v24.22.1.
- Installed esbuild module SHA-256: `b090fe57c79c677256a242703ea07bb2191eced357bece2f9a25539443da070c`.

The compiled bytes stayed in native process memory. They were not saved, emitted or transferred. This record preserves source and result metadata only.

There was **one compilation warning**, `empty-import-meta`, in `src/trajectory/equal-angle-bounds-job.mjs` at line 3, column 67. A separate native control confirms that its IIFE-compiled worker launcher fails during relative URL construction before reaching a Worker constructor. This inherited limitation remains an explicit receiving boundary.

## What was compiled

The harness uses the maintained builder's real browser/IIFE/ES2022 options, including UTF-8, inline legal comments, no minification and no source map. It uses the maintained source-snapshot plugin approach and esbuild's actual parser, resolver and bundler.

Every actual metafile input must have a snapshot whose Git blob equals the exact combined tree entry. Both changed modules must appear in the metafile and contribute a positive number of output bytes.

| Runtime module | Selected SHA-256 | Bytes attributed in output | Physical source |
| --- | --- | ---: | --- |
| Joint-state fitter | `2915796fe51f98401461f2f084cc5e0836f1ec149a7c9288166f9c6e28a992a9` | 5,178 | Already the delegated fitter |
| Bounded helper | `f9a86ac2529a38d83a9e039c5b43912bf493b681d0464dd299503c4e9e67632b` | 4,984 | Original helper `26536292…`; exact corrected source selected in memory |

The actual local checkout HEAD remains `0a7ba12e58d714a52fd8f5385b87a1a8600c927e`, with the previously preserved joint-state edits. It is not relabeled as a clean combined checkout. The captured compiled bytes, full pinned tree comparison and explicit in-memory selection establish the received composition.

All captured physical source bytes, the installed compiler module, the maintained builder and Git status were checked afterward and remained unchanged. The maintained builder's Git blob is `0891cc2f769fb7242b87c6cc643a0158c54d14f7`.

The [native compilation receipt](receipts/joint-spacing-composition-7912183a/native-bundle-compilation.json) retains the complete 149-input manifest, physical/selected identities, participation counts and warning. The [in-memory compilation protocol](receipts/joint-spacing-composition-7912183a/bundle-compilation-protocol.json) preserves the exact executed driver and its source/composition inputs, with local filesystem locations expressed as explicit replacement fields. Its driver SHA-256 is `acc0b0451956cacd9844195936592b8db5226ff2d85c2ccfb465348f8f2fe684`.

## Why the warning matters

The source launcher constructs a module worker from a relative URL whose base is `import.meta.url`. The maintained IIFE compilation does not supply that native ESM module base. The complete application's metafile also does not include `src/trajectory/equal-angle-bounds-worker.mjs`; this runtime-created worker is not established as an embedded dependency by the static output-import check.

Two independently inspected callers use this launcher:

- The declared return-bound calculation button catches a startup error and reports refusal, restoring its controls without a new exportable result.
- Reopening an equal-angle-bounds notebook calls the same launcher before restoring the report and catches failure.

Those caller consequences are **source-derived**, not a new GUI or browser execution. The launcher is invoked on demand; this finding does not mean the whole application fails at initial load. There is no observed main-thread calculation fallback.

The job source is identical in the earlier `0a7ba12` baseline and the combined source: Git blob `6af94c30d6d3b12ec2bb641de9ac1e1d9f161565`, SHA-256 `95267fc5e783b6d8490f3f7b86c10ccae4005e5043479400de91eca9cf169f3c`. This incompatibility predates the two numerical changes.

## Executed URL-construction control

The separate native control compiles the exact existing job module using the same browser/IIFE/ES2022 settings, adding only a diagnostic global name so its export can be invoked. It evaluates that diagnostic bundle in an isolated native VM with Node's real WHATWG `URL` and a sentinel Worker constructor.

| Arm | Worker constructor calls | Observed terminal event |
| --- | ---: | --- |
| Native ESM job | 1 | The expected module-worker URL resolves; the sentinel deliberately stops before a worker is created |
| IIFE-compiled job | 0 | `TypeError`, `ERR_INVALID_URL`, during relative URL construction |

The sentinel is only an observation point. No worker, calculation, browser, DOM, cancellation course or notebook replay executes in this control. Its payload is the same source-shaped placeholder used by maintained worker-lifecycle tests; the control stops before message submission.

Both native controls exit zero because their expected observations are asserted. The negative IIFE result is retained as a feature limitation, not reported as working standalone behavior. The [URL-control receipt](receipts/standalone-return-bounds-worker-7912183a/native-url-control.json) and [exact driver protocol](receipts/standalone-return-bounds-worker-7912183a/url-control-protocol.json) retain the distinction. URL-control driver SHA-256: `8ef91fdea3e1b2cdea16cbf110f63f00efb74f2ed5369ff1581e23e952e139d4`.

## Existing evidence and ownership

Maintained launcher tests import native ESM with a fake Worker and exercise settlement, cancellation and synchronous submission failure. They keep a valid module URL base. The retained browser receiver opens the served HTTP source application. Neither course establishes the standalone IIFE worker path.

Issue435 and merged [PR442](https://github.com/Jacob-Met/worldlaw/pull/442) identify the retained contributor as `hamon-255cc007-20261025 / WORLDLAW`. PR442 is a verified provenance-linked conversation destination for this receiving finding; its historical attribution does not establish the current native task owner. Directly surfaced adjacent issues492 and594 preserve the return-bound work and are not taken over here.

The maintained contract requires an owned, terminable worker, complete-population handling, cancellation and retirement on source/declaration changes, and source-only notebook reopening through recomputation. A repair must preserve those behaviors. Supplying a different URL base alone does not prove offline worker availability; replacing the worker with synchronous calculation would change its lifecycle contract.

No production source repair or adoption is included in these receiving artifacts. The existing scientific results, source-browser qualification, ownership and explicit PR9/adjacent holds remain intact.

## What remains unqualified

The maintained packaging script's private main function always writes HTML and a separate manifest after compilation. This direct supported API call does not execute its full HTML assembly, embedded examples/licenses, CSS/favicon substitutions, atomic publication or readback. No filesystem writes were intercepted or converted into success.

Clean combined checkout, the remaining filesystem/provenance tests, complete packaging, actual standalone browser behavior and final delivery remain outstanding. The output digest above belongs to the in-memory JavaScript compilation only, not an HTML or ZIP artifact. Existing compiled-export and release holds remain in force.

The actionable handoff is to reconcile the current standalone/return-bounds owner and implement a properly packaged worker with actual lifecycle and source-reopen receiving. Root can continue independent authorized work while that owner decision and unavailable host/storage conditions are preserved.
