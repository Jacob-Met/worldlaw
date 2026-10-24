# Sequential stiffness investigations

The Stiffness Lab at `/stiffness.html` can propose a state from an explicitly declared finite set, freeze the current model forecasts, receive a labelled observation, score those forecasts, and then refit. The existing response field and torque gauge show the current fitted laws; the sequential history retains the forecasts made **before** each new reading entered training.

## Use the actual consumer

1. Open observations, a legacy stiffness notebook, or a complete experiment with the main **Open observations / experiment** control. Ordinary observations and legacy notebooks start a new experiment with no permitted inputs. Alternatively, explicitly choose an authored course and press **Start authored course**.
2. Expand **Declare the finite permitted input states** and enter an array such as `[{"command":0,"position":0.3,"rate":0}]`. Units are N·m, radians and rad/s. Inspect ranked spreads, individual model predictions and extrapolated axes. “Permitted” records your declaration; it does not establish physical safety or authorize hardware operations.
3. Freeze a declared state. The pending section shows its revision, coordinates, competitive forecasts and planning status. A manual choice remains possible when the heuristic withholds a recommendation; the recorded status is not changed into an automatic recommendation.
4. Enter an acquisition ID, source label, declared source kind, actual state and measured torque. The received coordinates must exactly match the frozen state. Submit **Score frozen forecast, then refit**. Unsupported, duplicate, mismatched or stale input is refused without replacing the accepted experiment.
5. Expand each history entry to inspect every prior prediction, the supplied torque, residual (`observed − predicted`), source declaration and extrapolation status. Return to the response plot to inspect the updated fit, then choose the next question.

**Receive authored virtual reading** is enabled only after explicitly loading an authored course in the current page session. It calls the local analytical fixture for that course. Imported source labels, even labels naming the same authored course, never enable this capability. Reopening an experiment restores its data and pending forecast but leaves virtual receiving disabled. Manual provenance is also a declaration: the page does not authenticate an instrument, source identity or observational independence.

## What chooses the next state

The planner evaluates the current training-competitive models at each declared state and ranks `maximum predicted torque − minimum predicted torque`. Exact ties retain the input declaration order. A proposal requires at least two competitive models, no diagnosed training-family mismatch, and a largest spread strictly greater than twice the declared torque-noise assumption. Empty permitted sets, unidentifiable fits, model mismatch and insufficient spread have explicit non-proposal states.

This is a finite-model disagreement heuristic, not information gain, calibrated confidence or a guarantee that the next observation identifies a physical mechanism. The underlying comparison offers a global response and continuous single-hinge responses at declared angles, using the same nuisance terms. Piecewise candidates need three distinct observed positions on each side and full numerical rank. All conclusions remain conditional on that offered family, grid and assumptions.

Extrapolation marks command, angle or rate outside the current training ranges. It is reported rather than silently discarded; being inside those ranges is not a safety or accuracy certificate. Only the explicitly supplied states are considered. No actuator command is sent.

## Preserve or start a new investigation

The main **Save complete experiment** control downloads `worldlaw-stiffness-inputs.json` with schema `worldlaw.stiffness-experiment/v1`. It retains the initial study, permitted states, ordered acquisitions with provenance, and the pending state index. Reopening recomputes sequential forecasts, errors, fits and the pending request from these inputs; stored conclusions are not accepted as authoritative results. This is an input-replay notebook, not an authenticated log of when values were originally recorded. Legacy `worldlaw.stiffness-notebook/v1` inputs and ordinary observation JSON/CSV remain supported.

**Replace separate checks** changes only the initial study's held-out observations and check-source metadata, then replays the same acquisitions. It does not change training, candidate ranking, proposed states, frozen forecasts or sequential history. Check values are excluded from fitting, grid generation, competitive-set selection and request binding. Check evaluation changes are visible in the comparison table. A check labelled “separate” is not thereby proven independent.

Loading a different observation source or fitting changed model settings explicitly starts a new experiment. Changing settings uses the currently displayed training rows as the new starting dataset; the old pending request and sequential history are not carried into that new question. Save the old experiment first. Before the first acquisition, the permitted declaration can be changed. After the first acquisition, the entire declaration is fixed: even appending an unused state could retrospectively change a historical planning status. A changed declaration is refused while the accepted history and pending request remain intact. Applying an allowed declaration, including an unchanged one, clears the pending forecast so a fresh request can be frozen. To use a different declaration after acquisition, explicitly load a new observation source or start a new authored course. New panel actions, including acquisition, invalidate older asynchronous main-file reads so a late file cannot overwrite the newer investigation.

## Bounds and refusals

- At most 512 distinct complete permitted states; the editor accepts at most 200,000 text characters.
- At most 32 sequential acquisitions and 4,096 total training rows, including acquired rows.
- The replay fit-work estimate `(acquisitions + 1) × (initial rows + acquisitions) × (knots + 1)` must not exceed 2,000,000. This is a fit-work bound, not a wall-clock guarantee.
- Notebook text is capped at 2,000,000 characters; the file picker also rejects files larger than 2,000,000 bytes. Existing study admission applies, including finite coordinate/torque magnitudes at most 1,000,000 and at most 101 declared knots.
- Acquisition IDs must be unique. Every reading needs provenance labels and complete finite coordinates/torque. Modified forecasts, stale requests, incompatible coordinates, unsupported notebook/result fields and exceeded bounds refuse rather than silently truncating the investigation.

## Authored course result and reproduction

The deterministic ambiguous course in `src/stiffness/experiment-fixture.mjs` starts with eight authored training rows. With its declared grid and settings, sequentially taking the proposed state produces:

| Retained training | Next proposed angle | Largest permitted-state spread | Competitive hinge angles |
|---|---:|---:|---|
| Initial eight rows | 0 rad | 0.346946072 N·m | 0, 0.1, 0.2, 0.3, 0.4 rad |
| After the authored reading at 0 rad | 0.3 rad | 0.180717920 N·m | 0.1, 0.2, 0.3 rad |
| After the authored reading at 0.3 rad | No proposal | 0 N·m | Only κ = 0.2 rad |

The final planner status is `uninformative`: its current competitive set has one model. This is not proof that the true physical law has been discovered. The omitted smooth-response course instead exposes a training-family mismatch. Both are authored numerical controls, not physical measurements, blind validation, provider execution or competition qualification.

From the repository root, reproduce native and actual-browser controls with:

```sh
node --test tests/stiffness-experiment.test.mjs
node --test tests/*.test.mjs
BROWSER_ARTIFACT_DIR=/tmp/worldlaw-stiffness-experiment node scripts/stiffness-experiment-browser.mjs
BROWSER_ARTIFACT_DIR=/tmp/worldlaw-stiffness-regression node scripts/stiffness-browser.mjs
```

The browser receivers use the maintained product server and actual Chrome; they require Node's built-in WebSocket support (Node 22+) and default to `/usr/local/bin/google-chrome`. Set `BROWSER_EXECUTABLE_PATH` to the installed Chrome path when needed. The sequential receiver writes `stiffness-experiment-browser.json` plus `experiment-frozen-1440.png`, `experiment-refit-history-1440.png`, and `experiment-proposal-`, `experiment-pending-`, and `experiment-history-` screenshots at both `1440` and `390` widths. The maintained lab receiver writes `browser.json` and response/gauge screenshots. Numerical assertions, browser receiving, authored generator behavior and physical validation are separate evidence levels.
