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

If the two rank diagnostics disagree, the panel says so; fitter admission remains necessary. Normalization and numerical conditioning matter. Rank may even decrease when an extreme new input rescales columns, and numerically regressing inputs are not promoted.

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

At the maintained 4,096-observation capacity, the prospective diagnostic remains visible, including any rank or support improvement. Input-design proposal and row freeze actions are disabled with an explicit capacity explanation, and their handler also refuses the action. Start a new experiment with fewer retained training rows before requesting another reading; the diagnostic does not bypass acquisition admission.

Passing rank and position gates does **not** establish response adequacy, physical identifiability, confidence, physical safety, causal structure or authority to actuate. Torque observations are still needed to test the offered response. A full-rank but inadequate family may remain a training mismatch. Extrapolated states are flagged rather than declared safe or physically valid.

## Qualification and reproduction

Run:

```sh
node tests/stiffness-design.test.mjs
```

All **10 local controls passed**: the seven core diagnostics plus three consumer controls covering freeze/receive/save/replay without retroactive predictions, response/check-value independence, and inspection-choice nonmutation. The response-mutation control also verifies that fitted coefficients actually change while input-design results remain identical; the check-only control preserves the fit, pending request and history.

The authored course was also exercised through the existing acquisition path and actual maintained-server Chrome consumer. On maintained main `30937e84700bc268db63d5461b2f5f214abcadda` plus this change, receiving passed 546 native tests with one inherited optional notebook-exchange skip, both launched HTTP smokes, all 31 experiment browser groups and all 16 notebook browser groups. Actual checks cover confounding and no-gain states, a helpful but still-deficient proposal, offered-structure inspection, empty historical forecasts through receiving/refitting/save/reopen, delayed-import fencing, full-capacity action refusal, keyboard operation and painted 1440/390 px controls. The new screenshots were visually inspected; no uncaught page errors or outside requests were observed.

Independent MICROVERSE review checked the actual basis/fitter/support gates, numerical-regression handling, work estimate, input-only claims and maintained history. Review exposed the acquisition-capacity edge; the guarded interface repair and actual browser control close it. See [the source receiving record](receipts/stiffness-input-design-254045/verification.json). Complete maintained-packager source receiving and archive identity are recorded separately on the integration PR. These checks qualify authored software workflows, without a deployment or physical-validation claim.

The first complete-tree package attempt retained a useful failure: four tracked shared-contrast receipt files were absent from the maintained distribution allowlist. The packager now explicitly includes those four existing paths (the receipt README, authored input archive and two text logs). The complete final archive is received from its verified Git tree.

Final composition also preserves the subsequent shared-training contribution from maintained `bee2e5354fa321cf79c40498b4d17c9a52e1cc25`. Its three tracked README/text/archive receipt paths receive the same explicit package inclusion. The integration PR records final composed-tree archive identity and fresh consumer results separately from the earlier source counts above.
