# Challenge the additive scalar library

The scalar Studio's **Challenge the additive law library** instrument is mounted
beside the original repeated-state diagnosis. It uses the current notebook's
original fitting rows. It does not change fitting, ranking, observations,
held-out data, discovery options or the notebook schema.

## What this tests

Every current scalar candidate is a sum of functions of separate inputs:
`f(command) + g(position) + h(rate)`. This remains true of the optional cubic
position term. At two distinct values of each of two inputs, holding the third
input exactly fixed, the four-corner torque contrast must be zero:

`tau(x0,y0) - tau(x1,y0) - tau(x0,y1) + tau(x1,y1) = 0`.

This is a necessary test for **any** additive response, including functions not
offered by the current finite library. A nonzero source-supported contrast can
therefore challenge the whole additive assumption rather than just a coefficient
fit. It does not identify a physical interaction, hidden mechanism or cause.
Input error, changing conditions and incorrect reading bounds remain alternative
explanations. All coordinates must be explicitly assumed exact for this screen.

The visitor chooses two varied inputs, one exact value of the third, and an
absolute error bound for every torque reading. This bound is not automatically
copied from the fitted noise standard deviation. All complete rectangles in the
selected slice are enumerated. No source values are rounded into matches and no
missing corners are interpolated.

Repeated rows at the same exact state remain identifiable by their original
notebook row indices. Their torque intervals are intersected, because a single
deterministic response must satisfy every declared bound. Empty intersections
are reported as incompatible repeats, separately from additivity exclusion.
Rectangles involving such a corner have no calculated contrast.

For remaining rectangles, addition and subtraction use outward adjacent
binary64 bounds. The rounding helper is adapted with provenance from the
maintained `src/science/input-enclosure.mjs`; that owner's implementation is
unchanged. A contrast is excluded only when the complete enclosure is strictly
above or below zero. Touching or enclosing zero is **not excluded**, not a claim
of equality or existence of a globally compatible additive law. Passing every
local interval test need not establish joint feasibility across shared readings.

## Source inspection and continuity

The four-corner view shows original input coordinates and contrast signs. The
second composition compares the effect of changing one input at the two values
of the other. The table exposes every original torque reading at each corner.
The source label/classification travels into the screen. Authored controls remain
authored; a fitted law or screen result is never imported as an observation.

Changing a screen declaration clears its previous conclusion. Adopting another
notebook or refitting recreates the instrument. Save/reopen uses the original
Studio notebook and recomputes its observations. Screen assumptions must be
explicitly redeclared after reopening; they are not persisted silently.

## Bounded operation

The core reuses `validateRows` from `src/data.mjs`: at most 4096 rows, finite
coordinates and torque bounded to magnitude 10^6. A complete screen admits at
most 200000 pair/intersection/enumeration steps and 1024 output rectangles.
Exceeding either bound throws with no partial screen. These limits cover the
selected slice only. Missing rectangles remain missing evidence; no result is
invented to fill them.

## Executed controls

`node tests/separability.test.mjs` executes eight native groups, including 50
independently enumerated Cartesian grids, exact-coordinate mismatches, bounded
reading intervals, touching zero, repeated-reading conflicts, full-work refusal,
source nonmutation and original session save/reopen.

The maintained fitter on the authored nine-state grid `command,position ∈
{-1,0,1}`, `rate=0` selects `command+spring` for both `tau=2u-3theta` and
`tau=2u-3theta+u*theta`. The additive control has numerical residual about
5.13e-16 N·m. The interaction control has RMSE 2/3 N·m and is flagged by the
existing residual diagnostic. Its nine exact nominal contrasts are
`[1,2,1,2,4,2,1,2,1]` N·m; every contrast excludes zero with a declared ±0.01
N·m bound per reading. The additive control excludes none. These are authored
mechanism counterexamples, not physical instrument qualification.

## Actual receiving

The current implementation passed the actual Studio receiver using Chrome
156.0.8078.47 with namespace/PID/network/seccomp sandboxing verified through
`chrome://sandbox`. The unchanged product server served its real application.
Six receiving groups cover both authored file imports, explicit assumption
refusal, every complete rectangle, original corner readings, changed-bound
invalidation, keyboard rerun, unchanged notebook bytes, download/reopen and
the additive negative control. No page exceptions occurred.

Both four-corner and paired-effect compositions were inspected at 1440px and
390px viewports. All four actual captures fit the panel width. The four-corner
view remains the default because the matched coordinates and signed contrast
are easiest to inspect together; the paired view emphasizes the difference
between two source-supported input effects. The original source torque values
remain visible in both. This is a scientific inspector, not a claim of a
reconstructed physical mechanism; its current placement inside the existing
model pane can require substantial vertical scrolling on phones.

The [receiving record](receipts/separability-9e01d4dd/browser.json) and the four
captures preserve the executed output. The first harness attempt incorrectly
treated an empty HTML `open` attribute as false and closed its own panel; that
harness check was corrected before the successful receiving. The first visual
pass exposed hidden torque values and small inherited text; the received UI
shows those values directly and increases the reading text size.

An independently authored exact-binary-rational receiver additionally checks
600 cases, including subnormal values, large cancellation, repeated readings
and zero bounds, against Python `Fraction`. The source is
`independent-review/separability-oracle.py`; run it from the repository root.
Its [executed output](receipts/separability-9e01d4dd/exact-oracle.json) preserves
the counts and scope. The unchanged torque-discovery regression passes all
13 groups; the unchanged session regression passes all 7 groups after the
maintained telemetry fixture was received. An earlier session run had 6 passes
and one missing-fixture error, not a behavioral failure. The original
launched-product smoke also passes its asset/refusal
checks and discovery → virtual measurement → revision → notebook reopening.

```sh
node tests/separability.test.mjs
python independent-review/separability-oracle.py
node tests/torque-discovery.test.mjs
node scripts/smoke.mjs
# Installed browser dependencies are explicit; no sandbox disabling is used.
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
BROWSER_EXECUTABLE_PATH=/absolute/path/to/chrome \
BROWSER_ARTIFACT_DIR=/writable/receipts \
node scripts/separability-browser.mjs
```

## Initial source distribution receiving (bb2924)

The maintained packager explicitly lists distributable paths. This increment
adds only the new stylesheet, authored example directory, independent oracle
source and this receipt directory's text logs to its inclusion rules, and
requires the stylesheet and both runtime modules.

A full current-tree check also exposed existing receipt-path refusals. The
coordinated compatibility fix reuses the exact nine current-main receipt
inclusions and single historical gzip omission from [owner PR98](https://github.com/Jacob-Met/worldlaw/pull/98),
head `0a5bf7057ad715913407c9b6a07882751c758180`. The explicitly omitted
`docs/receipts/branch-response-20261024/native-tests.txt.gz` is retained in
source but never read into or distributed in the ZIP. All other original
refusals remain intact. The three requirements belonging only to the owner's
separate PR94 feature are not adopted. Five changed-input refusal controls
still reject another gzip, secret-like paths, an unlisted nested Markdown file
and traversal.

On complete current runtime source, `npm run verify` passes 594 tests:
593 passed, zero failed, one inherited opt-in test skipped. Both original
launched-product smoke courses pass. The complete [native output](receipts/separability-9e01d4dd/full-verify.txt)
retains the exact results. Archive extraction and packaged browser receiving
are recorded separately from source-checkout receiving.

The portable receiving archive uses the packager's supported
`working-tree-candidate` mode. One unchanged historical receipt image,
`docs/receipts/branch-response-20261024/desktop.png` (1,122,713 bytes), could
not be received through the available binary source route and is absent from
that local candidate archive. It is not runtime code or a test input. The
remote source blob must be preserved untouched on publication; no placeholder replaces it, and
the archive does not claim to reproduce the complete remote Git tree. Every
other received base blob is checked against its current Git identity. All
runtime code, actual tests and this increment's four screenshots are included.

The actual candidate ZIP contains 458 source files (18,832,392 bytes), with
SHA-256 `40e22e226c52c1a91a7279ee4eab5f8c0e641cf1dbbc36752f0009d13a2fa44d`.
Every member hash was checked before fresh extraction. From that extraction,
`npm run verify` again passes 593 tests with one inherited skip, both product
smokes pass, and all six sandboxed browser groups pass. Its four screenshots
are byte-identical to the already inspected source captures. The
[distribution receipt](receipts/separability-9e01d4dd/distribution.json) records
the artifact, actual runtime hashes, limited owner-patch reuse and the precise
historical-image limitation. The publication adds this receiving evidence
after the tested archive was built; no runtime source changed afterward.

## Current-main composition receiving (fc390452)

The qualified scalar runtime is unchanged while composing onto main
`fc390452ec7e01fd5d3ce6c99539fadae9bfef93` (tree
`6256f807aa11d0d8b7c7469d6007a26945d2cf11`). The README retains the new
Coupling Lab circulation section alongside this feature. The current-main
packager now explicitly omits three historical archives: the gzip above and
`prediction-contrast-195c0e2a/authored-inputs-and-notebook.tar.xz` and
`shared-training-195c0e2a/retained-source-evidence.tar.xz` under
`docs/receipts/`. This current policy supersedes the earlier nine-inclusion
adaptation; the composition preserves it exactly and adds only this feature's
four inclusion patterns and three required runtime paths. Five unrelated
secret/output/unlisted-path refusal controls still pass.

Focused receiving passes all 34 tests: separability (8), incoming circulation
(9), incoming stiffness knot profile (11), and incoming serial-order planning
(6). The actual extracted candidate also passes these 34 tests, both maintained
launched-product smoke courses and all six sandboxed separability browser
groups. Its four captures exactly match the visually inspected originals.
The earlier full-suite result remains qualified on bb2924; it is not relabeled
as a full-suite run on the newer composition.

The latest explicitly labeled working-tree candidate contains 482 source
files, 19,293,935 bytes; SHA-256
`90083c37642fa6a3a29d195d8462e6806fcc0218560ab3e70fd64373ed548b23`.
All 482 member digests were checked. Its source-tree field remains null: the
known unavailable historical branch-response image is not fabricated, and its
remote blob must remain untouched. The two incoming stiffness captures are
received and Git-identity verified. Runtime
source and tests are present. This final receiving prose and updated receipt
are added after the tested archive; runtime bytes are unchanged.
