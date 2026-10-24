# Choosing and receiving a recovery wait

Native ownership: [WORLDLAW #39](https://github.com/Jacob-Met/worldlaw/issues/39).
This extends the accepted fixed-preparation recovery workbench from #31 / PR38.
It chooses a waiting delay, executes or receives a separate paired recording,
and reevaluates the original training hypotheses without fitting those future
observations. Preparation duration and the continuous-tau analysis retain their
separate meanings and ownership.

## Actual workflow

Open UNKNOWN LAB, then **NEXT / CHOOSE THE WAIT** inside the recovery section.
Load the early-training course. Its two independent recordings at 0 and 0.1 s
leave several finite recovery hypotheses alive. The default request chooses
1.5 s, costing 128 declared seconds for 32 pairs. Execute independent virtual
acquisition: the small-step Euler instrument produces new paired readings with
a fresh noise seed, and the retained challenge leaves `decay:2` compatible.
Repeat acquisition to retain another independent recording. Exporting a request
saves training and settings only; reopening recomputes the request.

For supplied evidence, import a recovery study and the actual paired readings
through the existing workbench, declare a unique recording ID, and receive
those readings at the requested wait. This operation trusts the user's declared
source, protocol and delay; it does not establish physical provenance or drive
a physical device. An imported measured course has no connected virtual oracle.
The authored instrument will only execute against exactly reproduced authored
training and challenge lineage. Editing source or readings invalidates that path.

Settings or training changes invalidate the displayed request. A receiving call
also recomputes the complete request from current training/settings and refuses
stale or altered requests. Separate challenges do not change the training fit.
Actual pair count, counterbalancing and contrast radius are checked after
acquisition. Failed request checks and their observations remain visible.

## Shared decision rule

`src/experiment-design/interval-separation.mjs` contains the pair arithmetic and
ranking extracted from the existing duration planner. That planner imports the
same helper; its schema, outputs, acquisition costs and policy are preserved.
For prediction intervals `[aLow,aHigh]`, `[bLow,bHigh]`, the gap is
`max(0, aLow-bHigh, bLow-aHigh)`. A pair separates when the gap exceeds twice
the declared future contrast radius (with the existing numerical threshold).
The reported margin is gap minus twice that radius.

Only affordable waits that separate at least one pair are eligible. Prefer a
wait separating every surviving pair, then the greatest number of separated
pairs, then the lowest acquisition cost, then the smaller wait. The cost is
`pairs × (2 × wait + overheadPerPair)`: both pair members wait. Overhead is the
user-declared time for the complete pair's preparation, reset and readout. This
is a declared acquisition budget, not a timed physical measurement. All offered
waits remain inspectable, including over-budget and uninformative alternatives.

The forecast uses complete surviving training amplitude intervals, not only
representative curves. Candidate delays are a bounded discrete grid; it does
not solve a continuous experiment-design optimum. The future radius is an
assumption checked against the acquired observation, not a calibrated confidence
level. The recovery estimator's finite-family, chronology and excitation
qualifications remain in force.

## Comparison with a largest-pair baseline

Run `node scripts/recovery-planner-comparison.mjs` to regenerate
`docs/RECOVERY_PLANNING_RESULTS.json`. The script uses the actual production
planner against an independent small-step Euler instrument over 72 authored
courses: true time constants 1/2/4 s, amplitudes 0.25/0.6, per-reading noise
0.01/0.03/0.08, and four independent seeds. Training is at 0 and 0.1 s.

The baseline chooses the greatest gap for any one pair. Both methods use the
same offered waits, 32-pair acquisition, 500-second budget, positive-separation
eligibility and independent acquisition noise seed. Thus the baseline cannot
select an unaffordable 60-second wait. Neither method reads the future challenge
before selecting. Every refusal and per-course outcome is retained in the JSON.

| Outcome, all 72 courses | Shared interval policy | Largest-pair baseline |
| --- | ---: | ---: |
| Offered acquisitions | 56 | 56 |
| Refused as uninformative/unavailable | 16 | 16 |
| Unique correct hypothesis after offered acquisition | 50 | 27 |
| True offered hypothesis excluded | 0 | 0 |
| No compatible candidate after acquisition | 0 | 0 |
| Observed radius exceeded declared radius | 0 | 0 |
| Mean selected wait among 56 offered acquisitions | 2.018 s | 5.491 s |

The matched comparison contains all 56 offered courses: unique correct outcomes
are 50/56 and 27/56. These are authored finite controls, not physical validation,
calibrated uncertainty or proof of universal planner superiority. No observation
is counted for a refused request.

A separate changed-response control deliberately violates the training response
after acquisition. At the selected wait it can reject the original decay while
leaving the persistent candidate compatible. The product displays that outcome;
a unique finite-family survivor is not evidence that the mechanism is true.
Tests preserve this misleading-survival example rather than tuning it away.

## Verification and receiving status

Local source base: merged PR38 `b53b34c4ba8416a71e0d9dec227094968ad8febd`.
The full local suite completed with 319 tests: 318 passed, one existing skip,
zero failed. Nine new planner controls cover budget/partial/refusal behavior,
training-only plans, altered/stale requests, wrong delays, retained acquisition
check failures, exact virtual lineage/reopen, misleading survival, two-radius
interval boundaries and malformed settings. The full test command used
`node --test --test-isolation=none tests/*.test.mjs` (Node 24.19).

An additional 48 full-output parity comparisons against the frozen pre-extraction
duration planner passed, covering signed effects, noise levels, budgets and
screen radii. Independent peer source review and the planner test suite found
no scientific blocker; that review did not cover UI/browser behavior.

`scripts/recovery-planner-browser.mjs` exercises the actual served workbench,
input-only replay, supplied recordings, acquisition, invalidation, native Enter,
changed-response survival and clipped 1440/390 layouts. Root-relayed actual Chrome 156 / Node 22.23.4 receiving passed all 11 new planner
groups and all 10 accepted recovery groups. The duration regression command
initially used the incorrect filename `scripts/duration-planner-browser.mjs`
and failed with MODULE_NOT_FOUND; that attempt did not run or pass a browser
suite. The corrected `scripts/unknown-duration-planner-browser.mjs` then passed
all 11 groups. The successful runs reported no JavaScript exceptions or outside
requests. No runtime changes occurred between these runs. Root visually inspected the actual clipped 1440- and 390-pixel planner captures:
controls, offered waits and paired costs, selected row, acquired result and
export/reopen are visible. The narrow table scrolls inside its container.
The corrected duration planner run exited zero in 1.67 seconds. Main was read
back at the same b53b34c base after receiving; all 180 unowned baseline blobs
were independently verified byte-exact against its native Git tree. These
receipts qualify this source candidate; they do not assert publication or merge.
