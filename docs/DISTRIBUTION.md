# WORLDLAW source distribution

The ZIP contains the maintained browser application, local Node server, scientific source, examples, tests, and documentation. It does not bundle Node, Python, browser automation, downloaded runtimes, or third-party dependencies. The application itself has no npm runtime dependencies and requires no install step.

## Launch on Windows, macOS, or Linux

1. Install Node.js 20 or newer if it is not already available. Check with `node --version`.
2. Extract the ZIP. Open a terminal in the extracted `worldlaw` directory, where `package.json` and `server.mjs` appear.
3. Run `node server.mjs` (or `npm start`).
4. Open **http://127.0.0.1:4193** in a current browser. Keep the terminal running. Press Ctrl+C to stop the server.

On Windows, PowerShell works; on macOS and Linux, use the usual terminal. Open the HTTP address instead of double-clicking `index.html`, because the application uses JavaScript modules. If the port is occupied, use `PORT=4194 node server.mjs` on macOS/Linux or `$env:PORT=4194; node server.mjs` in PowerShell, then open port 4194.

The default source is a clearly labeled synthetic virtual instrument. Imported observations remain in the local browser. The scientific scope and limitations are described in [SCIENTIFIC_CORE.md](SCIENTIFIC_CORE.md); source-telemetry conversion is described in [TRAJECTORY_ADAPTER.md](TRAJECTORY_ADAPTER.md). Export a notebook before moving to another browser or origin: browser storage does not automatically transfer between them.

## Included workbenches

The studio header opens **Motion Lab** and **Trajectory Challenge** on the same origin. The trajectory route includes both controlled synthetic examples and the attributed measured PASCO example. Select a training method, run the comparison, inspect the recorded source and model failures, then save and reopen its input notebook. Measured angular models retain unknown physical inertia and report acceleration units.

Motion Lab also links to **Motion Reference**. Its comparison of retained observations with separately marked source frames uses the maintained CHRONOS admission module; the Motion path-reference proposal uses the maintained MECHANISM geometry module. Both exact source snapshots and their provenance records are included. Their original projects remain the owners. Reference comparisons preserve unscored gaps and the distinction between a measured pivot and a declared fixed location.

The source package includes all three original CSV recordings, the complete dataset license, extraction/receiving programs and `research/PHYSICAL_TELEMETRY_92be.md`. The independent trajectory entry point remains available with `npm run trajectory`; `npm run trajectory:build` creates the separate self-contained HTML when an installed esbuild module is supplied.

The small-angle trajectory example also supports a complete synthetic release
experiment: **Plan a release**, inspect the numerical screen and forecasts,
acquire the recording, then explicitly **Learn from this run**. Acquisition
leaves training unchanged until application. A failed numerical screen blocks
new acquisition while keeping previously acquired evidence usable. The source
ZIP includes the planner, independent instrument, session, shared qualifier,
controller adapter, test fixture and reproduction studies. See
[the experiment release record](TRAJECTORY_EXPERIMENT_RELEASE_92be.md).

## Build a reproducible package

Packaging needs Python 3.9 or newer and Git. It uses only the Python standard library, makes no network request, and never stages source files. Run from a source checkout:

```sh
python3 scripts/package.py --source-commit FULL_40_CHARACTER_COMMIT --output ../worldlaw-release.zip
```

On Windows, replace `python3` with `py -3` if appropriate. The default command reads the exact commit's Git objects, independent of unstaged changes. The commit must contain the complete application and this packaging script. A missing required application file causes refusal. The output must be a fresh ZIP filename outside the source directory.

For a pre-publication receiving candidate, explicitly package the current working files:

```sh
python3 scripts/package.py --source-commit FULL_REFERENCE_COMMIT --working-tree --output ../worldlaw-candidate.zip
```

This mode records **working-tree-candidate** and labels the supplied commit as an unverified reference. It does not claim that uncommitted bytes belong to that commit. A candidate must be regenerated after publication with the actual source pin.

If source publication used a Git API and the remote commit object is unavailable locally, an integrator may independently verify the published commit's complete Git tree, stage the identical local source, and use:

```sh
python3 scripts/package.py --source-commit FULL_REMOTE_COMMIT --working-tree --expected-tree FULL_REMOTE_TREE --output ../worldlaw-release.zip
```

This mode requires the local index tree to equal the independently supplied remote tree, no unstaged tracked changes, and every included file to be tracked and byte-identical to its indexed blob. It records **verified-tree**, the matching tree, and that the commit-to-tree association was supplied by the caller. The command cannot independently authenticate a remote commit unavailable in local Git objects. The integrator must retain the remote commit/tree verification receipt.

## Included content and provenance

`scripts/package.py` contains the explicit inclusion policy: root app files, source modules, maintained scripts, tests, Markdown/JSON documentation, JSON examples, and explicitly listed receiving evidence. Repository collaboration configuration is omitted. Unknown tracked paths cause refusal until deliberately covered by the policy. Tracked secret-like names, key material, binary runtimes, archives, caches, dependency directories, and output directories also cause refusal. Untracked content outside the allowlist is ignored. The packager does not inspect user home directories or claim to detect every secret in arbitrary source text; maintainers remain responsible for the reviewed source.

Named historical test logs and evidence archives listed in `NON_DISTRIBUTED_TRACKED_RECEIPTS` remain in the repository but are never read or copied into the ZIP. These exceptions match complete paths. Another log or archive still causes refusal; extending a receipt directory does not extend an exception.

Before packaging a changed source checkout, run:

```sh
python3 scripts/package-policy-test.py
```

This checks the current Git index against the explicit policy, required runtime and fixture coverage, exact omitted receipts, unknown-file refusal and file/directory symlink refusal. It needs Git metadata and is a source-checkout check, separate from receiving the extracted application. After adding or removing maintained source files, review their distribution treatment instead of broadening a wildcard merely to make this check pass.

Every included source file appears in `worldlaw/SOURCE_MANIFEST.json` with its relative path, byte length, and SHA-256. The manifest records the source commit, verification method, and Git tree when verified. The generated manifest cannot recursively hash itself; the archive SHA-256 printed by the command binds the complete archive, including the manifest.

ZIP entries are sorted, use a fixed 1980 timestamp and normalized regular-file permissions, and are stored without compression. The same source bytes, source pin, and verification mode produce the same ZIP bytes without depending on a compression-library version. The packager does not add its build-host paths or build time to generated ZIP metadata; retained source and evidence may contain their original paths and timestamps. No symlinks are packaged.

## Retained research sources and evidence

The package retains the reviewed recovery sources, original inputs, acquisition records and historical results under `recovery/` and `docs/receipts/`. These preserve earlier calculations, failed trials and source identities. Some historical programs refer to their original `/tmp` or `/dev/shm` locations or neighboring files from those runs. Their inclusion does not make every historical program a portable reproduction command. Use the maintained application launch and receiving commands in this document; a retained result is not a newly executed scientific result.

The Giessler angular-state example includes its three original CSV files, article metadata, download receipt, derived input and attribution in `examples/physical-giessler-28271405/`. Its README records the CC BY 4.0 source and selected channels. The additional Damped Pendulum Dataset recordings retain their pinned acquisition URLs and hashes; the full Apache 2.0 license and original author README are retained in `recovery/held-condition/`. Derived notebooks preserve their source declarations. Repeated nested representations of a recording do not create additional independent observations.

## Receive the extracted application

Extract into a new directory, then launch `node server.mjs` there. `http://127.0.0.1:4193/health` should identify `worldlaw`. In the browser, use the proposed experiment in the default virtual notebook, run it, and inspect the changed model and held-out prediction error. Export and reopen the notebook to check replay. These actions exercise packaged modules through the real application; a ZIP integrity check alone does not establish a working product.

For a native smoke of the extracted source, run `npm run smoke`. The scientific and session tests are available with `npm test`. Optional browser automation requires a separately supplied Playwright installation and browser; those tools are intentionally absent from the source ZIP. A distribution receipt should record the exact archive SHA-256, source pin/tree, runtime, actual launch, and observed result. An archive is a runnable source delivery, not a claim that the full research vision or contest submission is complete.

On Linux, `node scripts/distribution-browser.mjs` reuses the maintained Studio receiver and then opens Motion Reference through its ordinary Motion Lab link. Set `PLAYWRIGHT_MODULE`, `BROWSER_EXECUTABLE_PATH`, and `BROWSER_ARTIFACT_DIR` to the installed Playwright module, Chrome binary, and an output directory outside the extracted source. The receiver requests Chromium's sandbox and requires the same browser to report active namespace and seccomp protections; this specific admission check is Linux-only. It records raw-input download/reopen, an independently calculable authored 3–4–5 discrepancy, forged-answer and wrong-source controls, unscored gaps and narrow keyboard operation. Those authored coordinates are software controls, not physical-video evidence.
