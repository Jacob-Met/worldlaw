# Execute the inferred cross-coordinate loss

Coupling Lab's **Let the laws move** experiment can now execute a constant symmetric viscous-loss matrix together with the maintained symmetric inertia and fitted position-dependent torque law:

`q′ = v; M v′ = τ(q) − D v`

The same simultaneous RK4 integrator executes both coordinates, retains every candidate and failure, and compares two nested steps under the existing complete 120,000-step reservation. The mode-coordinate view transforms the full loss matrix; diagonalizing the stiffness does not silently remove coupled damping.

## Ordinary workflow

1. Load or acquire response evidence in Coupling Lab. The fitted position-torque laws remain the source of τ(q).
2. In **Estimate inertia from a separate motion record → Can drag act across the two coordinates?**, open a declared comparison study or try an authored example. Both loss hypotheses and the separate-source result remain visible.
3. For an admitted symmetric training fit, confirm that the training source and response notebook use the same apparatus, coordinates and torque conventions. **Copy symmetric loss into the motion experiment** transfers all six inferred coefficients without manual transcription. Review the dynamic interpretation and declare the experiment, then compare motion from an editable initial state.
4. Inspect the actual computed path or angle traces, playback and transformed coordinates. **Save motion inputs** and **Open motion inputs** preserve the response evidence and numerical declarations, then refit and recompute; saved trajectories are not trusted inputs.

The source-pairing confirmation and dynamic declaration remain expert assumptions. Fitting removes manual coefficient estimation/transcription, not the need to establish compatible torque and coordinate conventions. Copying an admitted hypothesis is not a success verdict: a separate-source failure remains visible and does not refit the training coefficients. Changing source context revokes pending pairing and motion; failed training has no copyable law.

## Contract and compatibility

The additive `worldlaw.coupling-dynamics-input/v3` explicitly declares `position-torque-with-declared-symmetric-inertia-and-symmetric-loss`. Its existing diagonal `inertia` and `damping` arrays are accompanied by scalar `inertiaCross` and `dampingCross`. The complete source-only notebook uses `worldlaw.coupling-dynamics-notebook/v3`. Use the ordinary download for a complete input example.

Versions 1 and 2 retain their original interpretations and readers. Older versions reject cross-loss fields; notebook/input versions must match. With D01=0 the version-3 kernel produces exactly the same complete numerical results as version 2. Existing default inputs stay at version 1.

Inertia remains finite, positive definite and numerically conditioned under the maintained admission. Shared damping admission allows either sign of D01 when D is finite and positive semidefinite. A boundary test exposed that the rounded product `sqrt(.8)*sqrt(.8)` is smaller than `.8`; the sufficient inequality `|D01| <= min(D00,D11)` now admits the exact equal-diagonal rank-one case before the existing general check. No fitted coefficient is clipped or replaced. PSD admission is conditional arithmetic, not physical calibration or established passivity.

## Executed receiving

Eight new native groups cover closed-form damped sum/difference oscillators, independently implemented matrix exponentials for unfamiliar noncommuting M/D, exact zero-cross parity, mechanical energy/loss consistency, full modal acceleration and power, PSD/version/work refusals, numerical failure retention, inference-to-unfamiliar-state prediction and source-only replay. Combined with affected existing dynamics, inertia, modes and viscous comparison groups: **42/42** on Linux/Node22.

For the authored training source from the balance comparison, a separate initial state `q=[−.41,.76] rad`, `v=[.33,−.24] rad/s` under an independently specified restoring law produces the following maximum angle errors across 101 output times over 4 seconds. Reference positions come from a separate Taylor matrix-exponential implementation, not the product solver:

| Inferred hypothesis | Maximum angle error |
| --- | ---: |
| Original diagonal-loss balance | 0.0790825671 rad |
| Symmetric-loss balance | 1.59293e-8 rad |

This is a qualified numerical transfer example with known authored M/D, not measured apparatus evidence or a claim that the extra coefficient always helps. A no-cross course retains both hypotheses, and existing omitted-force/unsupported controls remain failures.

The maintained launched smoke passes. The actual maintained Chrome harness passes **32/32** groups: 15 original product journeys, 9 balance-comparison groups and 8 new inference-to-motion groups. It exercises actual copy controls, changed initial states and loss, original/refused imports, browser download/reopen, rank-loss copy refusal, keyboard activation, playback and reduced-motion behavior. No uncaught exceptions or external requests were observed. Sandbox remained enabled.

Desktop and 390px actual rendered paths and controls were inspected. The newly added equation initially inherited a low-contrast color on the dark motion surface; the final scoped amber style was inspected after correction. The first browser attempt also expected an already-expanded mode view; the receiver was corrected to press the existing **Find coordinates for this motion** button before inspecting it. Neither initial attempt is counted as a successful complete run. Retained screenshots and the machine-readable receipt are in [receipts/viscous-motion-70fa](receipts/viscous-motion-70fa/).

```sh
node --test tests/coupling-viscous-dynamics.test.mjs tests/viscous-comparison.test.mjs tests/coupling-inertia.test.mjs tests/coupling-dynamics.test.mjs tests/coupling-modes.test.mjs
npm run smoke
BROWSER_EXECUTABLE_PATH=/path/to/chrome BROWSER_ARTIFACT_DIR=/tmp/worldlaw-viscous-motion WORLDLAW_VISCOUS_RECEIVING=1 WORLDLAW_VISCOUS_MOTION_RECEIVING=1 node scripts/coupling-browser.mjs
```

Base: `a2089215476a23b1db2ac03e4a259cd11c2e7f4b`. Native issue #318 and its PR retain publication, review and post-merge receiving pins. This adds forward execution; prospective freeze/time-grid/separate-angle receiving remains #71's separate responsibility. No acquisition, physical-device action or deployment is established.
