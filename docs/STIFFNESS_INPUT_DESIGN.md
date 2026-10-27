# Input support before a response can be estimated

WORLDLAW #89 adds an input-only diagnostic to the existing Stiffness Lab. It helps inspect a specific failure: declared coefficients may be inseparable because the observed inputs vary together, even when many observations are present. The existing forecast-disagreement planner remains unchanged.

## Inspect one offered structure

Choose **Global**, one explicitly offered hinge angle, or the explicitly added cubic origin when that family has been declared. The diagnostic uses the same basis terms as the maintained stiffness fitter, including the current nuisance terms. It cannot silently introduce a different hinge or cubic origin.

Only command, position and rate coordinates enter the diagnostic. It does not fit or predict torque. Changing response values can change fitted explanations while leaving this diagnostic unchanged. Separate check values do not enter its ranking.

The chosen structure is temporary inspection state, not a new saved experiment setting. Inspecting another structure does not rewrite the family declaration, pending request or sequential history. Saved experiment inputs already retain the complete offered family, permitted states and acquisitions needed to recompute the diagnostic.

## Read rank and support together

The panel shows:

- **Numerical rank / coefficient count:** independent basis directions under the declared numerical tolerance, followed by the remaining unresolved count.
- **Maintained fitter rank check:** whether the actual fitting routine admits this input design. It uses a zero right-hand side solely to test rank; these diagnostic coefficients are never exposed as a torque model.
- **Position support:** the separate observed-angle gates. A hinge requires three distinct positions on each side; a cubic requires four distinct positions. Numerical rank alone does not waive these gates.

If the two rank diagnostics disagree, the panel says so; fitter admission remains necessary. Normalization and numerical conditioning matter. Numerical rank under the stated tolerance may even decrease when an extreme new input rescales columns, and numerically regressing inputs are not promoted.

Every admitted permitted state remains inspectable. Its row shows rank after adding those coordinates, rank change, unresolved coefficients, fitter admission, position support, qualification and extrapolated axes. Narrow screens present labeled state cards; a bounded scroll region retains all rows.

The proposal is a one-step heuristic for this selected structure. It prefers admitted improvements, then supported designs, rank gain, fitter admission and position-support gain, using declared index to break remaining ties. It is not a globally optimal experimental design or a probabilistic information-gain estimate. A proposed input may help while leaving other coefficients unresolved.

## Freeze, receive and replay

**Freeze proposed input state** and the per-row actions use the existing experiment request path. They do not send a command. Existing executable competitive forecasts, if any, remain the only forecasts in that request; inspecting a structure does not create an executable model for it.

When the original fit is unidentifiable, the frozen request explicitly contains no predictions. A later supplied reading can make coefficients estimable, but it must not manufacture an earlier forecast or residual. The historical request and error list stay empty where no forecast existed. Only subsequent supported requests can acquire forecasts.

The authored **Confounded command and angle** course demonstrates this transition. Its 17 initial rows satisfy `command = 2 × position`, leaving the global bias/command/position design at rank 2 of 3. One permitted state stays on that line; the other uses command 1 N·m, position 0 rad and rate 0 rad/s. The latter raises prospective rank to 3. The explicit analytic generator supplies torque 1.4 N·m, after which the fitter recovers bias 0.2, command coefficient 1.2 and position coefficient −3.

Those are authored controls, not physical measurements or a blind experiment. Virtual receiving is enabled only by explicitly loading the course; imported source labels do not grant that capability. Supplied coordinates must match the frozen permitted state. Actual readings and their source labels follow the existing acquisition validation.

Save/reopen preserves the pending request, original observations, acquired observations and complete permitted declaration. No new notebook schema is introduced. Replay recomputes supported forecasts while retaining the absence of earlier unsupported forecasts. Source labels and input records do not authenticate instrument identity, experimental independence or recording-time history.

## Refusal states and limits

`proposed` means one declared state improves admitted rank or position support. `already_supported` means the current design already passes those gates. `no_gain` means no single declared input supplies an admitted improvement; `no_permitted_inputs` means there are no candidates to inspect.

`work_limit` withholds the entire prospective scan. It does not silently select or thin permitted states. The estimated work is `3 × (input rows + 1) × (permitted states + 1) × coefficient count²`, capped at 2,000,000. The bounded baseline diagnostic precedes that gate. These are work bounds, not a wall-clock deadline.

The API admits 1–4,096 input rows; maintained studies retain their existing minimum-row requirements. At most 512 distinct permitted states are admitted, with finite coordinates within ±1,000,000. Existing acquisition and replay limits remain in force.

When one more reading would exceed the maintained 32-acquisition, 4,096-observation or replay-work limit, the prospective diagnostic remains visible, including any rank or support improvement. Input-design proposal and row freeze actions are disabled with the original admission reason, and their handler also refuses the action. The read-only check reuses the existing replay-work guard with the next acquisition count; it does not fabricate an observation, fit a model or change a frozen request. Start a new experiment within those limits before requesting another reading. Existing saved-request and receiving contracts remain unchanged.

Passing rank and position gates does **not** establish response adequacy, physical identifiability, confidence, physical safety, causal structure or authority to actuate. Torque observations are still needed to test the offered response. A full-rank but inadequate family may remain a training mismatch. Extrapolated states are flagged rather than declared safe or physically valid.

## Reproduction and source integration

Run `node --test tests/stiffness-design.test.mjs`, `npm run verify`,
`npm run stiffness:browser` and `npm run stiffness:experiment:browser`.
The experiment browser course uses Node.js and the explicit `BROWSER_EXECUTABLE_PATH` for Chrome; it does not require Playwright. The separate `stiffness:browser` course uses its existing Playwright configuration. On Linux the experiment course requires the same browser target to report active sandbox protections before application navigation.
The complete consumer course must also run against a fresh extraction from
`python3 scripts/package.py` before this composition is described as received.

This integration reuses the authored input-design mechanism from
[PR #94, head 39217211e366cd087957a353e52edc08173ea68c](https://github.com/Jacob-Met/worldlaw/pull/94)
by team `hamon-254045933ca8-20261023`. The underlying fitter, acquisition/replay
contracts and neighboring scientific work remain maintained on current main.
Historical component and browser results are retained on that original PR;
they are not new receiving evidence for this composition.

The prior dependent package repair from PR #98 is already maintained through
PR #111. This composition preserves the maintained packager and adds the three
input-design runtime/document requirements. Recovery on current main also
adds 36 exact existing receipt paths and six exact historical-log omissions
needed for its strict distribution check; no wildcard, matcher or refusal
rule is broadened. It does not reintroduce older shared-training modules,
receipt archives or their old allowlist.

The native integration record carries the exact composed commit/tree, commands,
actual desktop/narrow captures, archive identity and any remaining failures.
No source-local patch alone establishes successful receiving or deployment.
