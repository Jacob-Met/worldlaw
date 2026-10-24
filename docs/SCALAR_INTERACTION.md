# Revise the scalar feature library

WORLDLAW's scalar Studio can explicitly admit the command–position product `uθ`
after the original additive library fails. The new option uses the maintained
bounded subset search, scaled QR fitter, model ranking, planner, prediction and
RK4 execution. It does not infer arbitrary symbolic structure or a physical
mechanism. The default seven-term additive library is unchanged; the optional
cubic position term remains a separate existing API option.

## Actual course

1. Import `examples/scalar-command-position.json` in the Studio. It is an original
   authored mathematical control, **not measured physical evidence**. Nine fit
   readings follow `τ = 2u − 3θ + uθ` at three commands and three angles, with rate
   zero. Nine separately supplied receiving points are retained as held-out rows.
2. The default fit selects command and spring, with training RMSE `2/3` N·m and
   held-out RMSE `0.4323643011268263` N·m. The additive separability instrument
   continues to challenge the original source's additive assumption under its
   explicit coordinate and reading-error declarations.
3. Under the current explanation, select **Admit command × position (uθ)** and
   **Revise candidate library**. The existing fitter searches the expanded finite
   library. It selects command, spring and interaction, with coefficients about
   `2`, `−3` and `1` (interaction coefficient unit `1/rad`). Separate authored
   receiving RMSE becomes approximately `7.63e-16` N·m.
4. The original failed fit and all source values remain in notebook history.
   Changing held-out torques cannot change the fitted model. Admitting the term
   does not force it: the additive control keeps command and spring, while a
   constant-command control retains spring/interaction aliasing and the
   insufficient-excitation warning.
5. **Let the model move** now has a fixed-command control. It feeds the maintained
   RK4 solver instead of hardcoding zero command, which would conceal `uθ`'s
   effect. Motion is a prediction of the selected model. The existing no-actuation
   and extrapolation qualifications remain. Invalid commands refuse execution.

The feature-revision control lives beside the executable explanation, so the
existing alternatives, original observations, residuals, receiving error and
history stay in the same workbench. A separate interaction-only demonstration
was considered and rejected because it would detach revision from the existing
notebook and actual prediction path. Desktop and narrow browser captures show
the implemented composition. This increment improves the current Studio; the
larger visual goal of confronting multiple moving laws remains open.

## Interval compatibility

A core-only new feature is insufficient. The former input-enclosure consumer
mapped unrecognized position-like terms to angle alone: `u=2, θ=3, c=1` gave
nominal interaction torque `6` but an enclosure near `[3,3]`. That would falsely
exclude the source reading. The maintained consumer now evaluates all four
endpoint products of the declared command and position intervals, rounds the
extrema outward, and retains coefficient scaling and addition rules.

When the existing joint-position refinement is active, the interaction range is
added as a separate conservative term to the refined position sum, then
intersected with the independently valid complete range. Shared coordinate
dependence can make this loose; it does not make a tighter interval claim.
Existing transcendental engineering qualifications, finite-domain limits and
work refusal are unchanged. This narrow compatibility change does not take over
the separately owned uncertainty planner.

## Notebook compatibility

`includeCommandPosition` is an explicit boolean session option. Its presence is
not inferred from the data or an additive-screen result. Default additive-only
notebooks remain byte-compatible `worldlaw.session/v1`. Histories that ever
enable the option export `worldlaw.session/v2`, even if a later revision disables
it. Export stores original evidence and explicit choices, not derived models or
redundant term arrays. Replay refits the same history. Undo removes the final
revision and restores the preceding model and evidence.

The new reader accepts v1 and v2, rejects a v1 history falsely carrying the new
option, and rejects unsupported v3. Accepting additive-only history in a v2
envelope is deliberate; subsequent export canonicalizes it to v1. The prior
reader rejects v2 explicitly. This prevents its otherwise silent omission of an
unknown option and reconstruction of the wrong additive model. The prior
virtual-notebook test used v2 as an unknown envelope; its refusal control moves
to v3 while seed, row-identity and finiteness tests remain unchanged.

## Qualification

Independent retained-worker review accepted the exact frozen fitter,
input-enclosure and session files. Its `Fraction` oracle checks **62,500** exact
polynomial point predictions over **500** arbitrary-binary signed, cross-zero
and zero-radius input boxes, using all five existing refinement settings and
positive/negative interaction, spring and cubic coefficients. Every exact value
lies inside its outward enclosure. Twelve complete default virtual sessions and
exports match the prior implementation exactly; v2 replay, undo and old-reader
refusal also pass.

The direct native tests additionally check held-out nonleakage, maintained
planner predictions, non-wins, alias ambiguity and agreement of the actual RK4
trajectory with an independent analytic forced-oscillator solution within
`1e-9`. Full `npm run verify` passes **624 tests: 623 passed, zero failed, one
inherited opt-in skip**, followed by both maintained launched-product smokes.
The initial regression failure was the obsolete v2-as-unknown test assumption;
its output is retained rather than represented as a passing run.

Actual sandboxed Chrome under `nobody` receives the authored import, keyboard
revision, fixed-command dynamics, moving canvas/reduced-motion freeze, history
and local reload, actual notebook download/reopen, undo, invalid-command refusal
and desktop/narrow layout. Eight browser checks pass with no page exceptions.
The screenshots and exact output live in `docs/receipts/interaction-9e01d4dd/`.

Reproduce core and browser checks with:

```sh
npm run verify
node tests/interaction.test.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
BROWSER_EXECUTABLE_PATH=/absolute/path/to/chrome \
BROWSER_ARTIFACT_DIR=/tmp/worldlaw-interaction-browser \
node scripts/interaction-browser.mjs
```

The independent oracle runner needs an explicit prior session module to compare
against the qualified additive implementation (`worldlaw-current`, composed on
`fc390452ec7e01fd5d3ce6c99539fadae9bfef93` plus #107; session file unchanged from
that main):

```sh
BASELINE_SESSION_MODULE=/absolute/path/to/prior/src/session.mjs \
node independent-review/interaction-review.mjs
python independent-review/interaction-oracle.py
```

The independent review, numerical fit and authored receiving control do not
establish physical cause, confidence intervals, general mechanism topology or
transfer to an independently acquired physical system. A small residual remains
conditional on the offered features and supplied evidence.

## Portable receiving

The explicitly labeled working-tree archive contains 496 source files
(19,794,434 bytes), SHA-256
`908743e6901c27b53734a9b1b5d8487fb84e55144fffb54949e92a847c102472`.
All member hashes were verified before receiving the extracted app. Its 15
focused interaction/additive/replay tests, 62,500-point rational oracle, both
launched-product smokes and eight sandboxed browser checks pass. Both model
captures exactly match the visually inspected source captures.

This archive is composed on main fc390452 plus received #107 and this feature;
it does not claim an exact remote source tree. The prior unavailable historical
`docs/receipts/branch-response-20261024/desktop.png` remains absent locally and
must remain untouched remotely. All runtime and test inputs are present.
The package retains main's exact historical archive omissions and adds only
explicit independent-review files and this feature's text receipts. Final
receiving docs/receipts follow archive construction; no runtime bytes change.

## Composition on merged #107

The successor is composed on merged commit
`6bbac9d5796c8abd34413af5c1228c2bf77135fe`, tree
`17749a242e2dc38930761554ab3bb64277faa3c2`. The README preserves the newer
coupling-observable section. Incoming duration-acquisition, coupled-observable
and grid-tracker source remains byte-identical to the merged Git blobs. The
accepted interaction core and all runtime changes are unchanged.

Proportionate current receiving passes 23 focused tests (interaction4, duration6,
coupling-observables5, tracker8), both launched-product smoke courses, and all
eight interaction browser checks from the newly extracted distribution. The
exact merged #107 Studio separately passes its six browser groups. The complete
earlier624-test run is not relabeled as a new full-suite run.

This current working-tree ZIP has515files and21,095,195bytes, SHA-256
`329960a064580241194bc0a2065f492077d7c36db7f958d0da5c7a098c23e9e2`.
All515member hashes were verified. Only the previously unavailable historical
branch-response desktop image remains absent locally; its remote blob is
preserved, and no exact-remote-tree archive claim is made. Final receiving
prose and receipt follow archive construction with runtime unchanged.
