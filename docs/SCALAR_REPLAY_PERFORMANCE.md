# Reuse fresh scalar fits when assumptions change

The Studio now reuses its freshly computed scalar fits when a revision changes
only the declared noise floor or ambiguity threshold. These settings affect
ranking; the observed coordinates, torques, offered term order and maximum
term count determine the QR fits. The user still sees the same models, scores,
failures, history and executable predictions.

`refitDiscovery` is equivalent to `discover(discovery.observations, options)`.
It can reuse only a private in-process record created by this module. Every
source row is validated and compared exactly before reuse. Changed rows,
counts, order, term order or maximum term count run complete discovery.
Serialized discovery objects also run complete discovery. Public model and
metric mutations are never taken as evidence. Private fits do not share
mutable data with returned results and stay in original enumeration order,
which preserves the established tie-break when a changed noise floor ties
previously different scores. Weak references avoid an accumulating global
source cache.

The notebook format remains input-only. Reopening recomputes the initial
source fit; later eligible assumption events reuse that fresh work. No saved
derived answer is admitted, no QR algorithm is replaced, and no observations
or candidate families are omitted.

## Executed comparison

Retained baseline: `29b117100c57c5f132d45c53edda2febc0cd9926`.
Owner/task: [WORLDLAW #242](https://github.com/Jacob-Met/worldlaw/issues/242),
team `hamon-7ce19039-20261025`.

An authored numerical course contains 4096 fitting rows, 31 held-out rows
and 24 revisions of noise/ambiguity. The actual maintained session consumer
creates, revises, exports and reopens the notebook. Each measurement uses a
fresh Node 22.23.4 process on the same authorized Linux x64 host; version order
alternates across three repetitions. This is a numerical workload, not new
physical inference or measured instrument accuracy.

| Median, three fresh processes per version | Baseline | Candidate |
| --- | ---: | ---: |
| Initial source fitting | 287.98 ms | 273.49 ms |
| Apply 24 assumption revisions | 5237.13 ms | 44.98 ms |
| Reopen original-input notebook | 5509.01 ms | 259.85 ms |
| Complete create/revise/export/reopen | 11031.55 ms | 575.85 ms |
| Process CPU during the complete comparison | 12405.85 ms | 759.39 ms |
| Process peak RSS | 132964 KiB | 110568 KiB |

The median replay improvement is 21.20 times. All six executions produce
identical input, exported-notebook and complete-result SHA-256 values. The
[complete measurements](receipts/scalar-replay-7ce19039/performance.json)
retain each run rather than just the median.

The same notebook passed the real Chrome 156.0.8078.47 application: actual file
opening, all 25 history entries, source-only export, keyboard noise revision,
invalid-assumption refusal, reload, 390 px layout, changed original evidence
and deliberately forged saved fits. The final instrumented browser course
measured 4059.79 ms to open on baseline and 654.33 ms on candidate. These are
single browser observations, separate from the repeated native measurements.
Both displayed the same fitted terms and held-out error and exported identical
notebooks. [Browser receipt](receipts/scalar-replay-7ce19039/browser.json).

Desktop and narrow captures were inspected. The existing mechanism, evidence
and source labels render correctly. On narrow screens the mechanism remains
below the opening source section; this increment makes no layout or visual
quality improvement claim.

## Correctness and regression evidence

- 240 complete discovery/refit results match the independently retained
  baseline byte-for-byte over varied source sizes, libraries, term order,
  noise floors and zero/nonzero responses.
- Eight new native groups cover changed source coordinates/torques/order/count,
  canonical ties, expanded libraries, maximum-term changes, rank failures,
  unexecutable coefficients, malformed values, public mutations, serialized
  forged models, exact input-only replay/undo and held-out isolation.
- Complete native suite: 974 tests, 973 pass, zero failures, one inherited
  optional skip. Both launched-product smokes pass.
- The maintained original Studio Chrome course passes seven groups, including
  source import, a real virtual experiment, structural revision, notebook
  persistence, refused dynamics and 320–1440 px layouts.
- The benchmark refuses child-process execution errors. The local sandbox
  disallowed child creation; the complete benchmark and browser receiving
  therefore ran through the supported authorized remote execution route.

## Reproduce

Obtain a complete checkout/archive of the exact baseline above. From the
candidate repository, with Node 20 or newer:

```sh
node --test tests/discovery-refit.test.mjs
node experiments/scalar-refit-parity.mjs --baseline-root=/path/to/baseline
node experiments/scalar-replay-performance.mjs --baseline-root=/path/to/baseline --output-dir=/tmp/worldlaw-replay
npm run verify
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs BROWSER_EXECUTABLE_PATH=/path/to/chrome BROWSER_ARTIFACT_DIR=/tmp/worldlaw-replay-browser node scripts/scalar-replay-browser.mjs --baseline-root=/path/to/baseline --input=/tmp/worldlaw-replay/input.json
```

The numerical input generator is checked in with the benchmark and writes its
exact original input beside the receipt. Original Node22 input SHA-256:
`24404b69f332fbdda7ee92d99c2928257157c9c6e37ffeaaf3a2d77ec988b4c1`.
Notebook SHA-256:
`4fbdeefdfd3fb743eb11077f60222e60a97dcef5ce9840e30d366fe5990c823c`.
Complete result SHA-256:
`9eee2597955155b34bc2c9d92211763b26ccd86503ea66b46b3c18b786618fc4`.

Fresh source creation and evidence-changing revisions still pay complete
fitting cost. Cache reuse is intentionally local to live results and does not
accelerate unrelated trajectory, coupled or physical models. No installation,
deployment, cloud qualification, physical acquisition or submission is claimed.
