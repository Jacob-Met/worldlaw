# Bring a recording to a proposed trajectory experiment

The recorded trajectory workflow lets you propose a release from existing training evidence, inspect a separately supplied recording against the frozen laws, and explicitly choose whether to add it to training. It does not operate an instrument or verify that a recording came from physical hardware.

This workflow supports the original known-inertia torque model family. Angular recordings with unknown inertia and the extended interaction, directional-loss, and contact model families keep their existing workflows. The separate virtual experiment workflow is unchanged.

## Start, propose, and export a request

1. Load the training and challenge runs you want to retain. Choose **Start from current runs** in the supplied-recording instrument. The original notebook, including supported prior virtual experiment history, becomes the base of this recorded workflow. Apply an outstanding virtual recording before starting; starting does not silently abandon it.
2. Open **Declared release limits and planning schedule**. Review the known inertia, constant command, angle/rate bounds, duration, and sampling interval. Prefilled inertia is a retained training declaration. All planning values remain editable declarations, not physical safety limits or permission to operate hardware.
3. Choose **Plan a recorded experiment**. The planner compares predictions from training-compatible laws. An informative proposal identifies a release where those laws disagree. It contains no newly acquired observation. An infeasible or uninformative result is not an executable recommendation.
4. Choose **Export request** to download `worldlaw-recorded-experiment-request.json`. It contains the proposed conditions, units, planning settings, source references, and request/context identifiers. This is an input-only request, not a recording or a saved experiment notebook. A short identity or matching metadata is not an authenticity proof.

The proposal's numerical check describes step sensitivity of its predictions. A missing or unresolved check remains visible. Existing recordings can still be inspected when that check is unavailable; this does not authorize new physical acquisition.

## Receive a separately supplied recording

Use **Open one separately supplied trajectory run (JSON)**. Supply one run object, not an entire bundle, exported request, or experiment notebook. Its fields are:

- `id` and `label`: the run's identity and display name.
- `kind`: `synthetic`, `measured`, or `unknown`.
- `units`: `time: "s"`, `position: "rad"`, `command: "N·m"`, `inertia: "kg·m²"`, and `initialRate: "rad/s"`. Positions are unwrapped radians; convert other units before import.
- `inertia`: a known positive constant, equal to the request's declared inertia.
- `initialRate`: the supplied starting angular rate.
- `source`: metadata including a nonempty `label` and a new `recordingId`.
- `samples`: ordered objects containing finite `time`, `position`, and `command` values. Every command must equal the requested constant command.

Timestamps must increase strictly. The importer does not sort, interpolate, or replace observations. Run and recording identities must be distinct from retained evidence. Reused identities and obvious complete, subset, or shared-window evidence are refused; these screens cannot authenticate a source or prove independent acquisition.

**The supplied initial position, initial rate, duration, sample count, and sampling intervals may differ from the proposal.** These differences are displayed, not silently removed. A recording is not rejected merely because its observations disagree with the laws.

The three source kinds are declarations. Selecting `measured` does not certify a physical measurement; selecting `synthetic` does not make a recording an output of WORLDLAW's virtual instrument. Keep the original source and acquisition context available for inspection.

## Inspect the two comparisons

The main trace instrument shows the supplied path as a solid white line and the frozen laws as dashed lines. Those laws are replayed from the **actual first recorded position and supplied initial rate, at the original recorded timestamps**. No new fit has occurred yet.

The condition table shows the original request alongside the supplied conditions. Source kind, recording identity, clock range, and sampling intervals remain visible. Open **Original proposed release** to inspect the original forecasts separately: they use the original planned initial conditions and schedule, not the conditions of the supplied run.

A completed coarse prediction is not numerical qualification. Each model reports whether its coarse/refined step comparison completed or was unavailable. A failed refinement can leave a coarse curve visible with an explicit warning; a failed coarse prediction has no replacement curve. Even agreement between two step sizes is not a calibrated error bound or physical validation.

## Apply, discard, or refit explicitly

A received recording stays **pending** until you choose **Apply recording and refit**. Application adds it to training, recomputes the laws, and compares before/after predictions on the same reserved challenge recording. The reserved recording is not moved into training. Worse or failed results remain applied and visible; no automatic rollback selects a more flattering result.

This is exploratory reuse of an existing evaluation recording, not fresh blind validation. The supplied path and its frozen pre-refit comparison remain available after application.

Choose **Discard pending recording** to remove only the unapplied recording. It does not change current training evidence. Discarding does not create an applied-history event or retain an archival copy of that pending file; keep the source file yourself if needed.

Apply or discard pending evidence before planning another experiment or changing the fit. The ordinary **Fit & challenge** action records an explicit refit in this workflow's ordered history and invalidates the earlier proposal. Previously applied recordings remain part of training.

## Save and reopen the notebook

The app attempts to save completed workflow transitions in this browser and reports storage problems. Use the ordinary **Save notebook** control for a portable `worldlaw-trajectory-notebook.json` file; exporting only the request is not a substitute.

Use **Open notebook** to restore that file. The notebook retains its base evidence, ordered recording/refit history, any pending recording and request settings, and supported view selections. Reopening recomputes the experiment from that evidence instead of trusting cached fit or prediction results. Supplied recordings are not regenerated from a synthetic oracle. Browser startup also attempts to restore its local notebook; an unreadable saved notebook is reported rather than silently replaced.

## Limits and visible failures

- A supplied training run needs **17–4096 samples** and at most **300 seconds** duration. The original proposed schedule must also contain at least 17 samples before it can receive training evidence.
- The maintained bundle supports at most **four training runs**, four challenge runs, and **8192 total samples**. Once training is full, choose a separate evidence set rather than silently dropping retained runs.
- Planning is bounded to **250,000 complete integration steps**. Actual-condition coarse/refined comparisons share a **750,000-step** budget across the frozen models. Exceeding that replay budget retains the recording while explicitly withholding forecasts.
- Notebook/JSON size is limited to approximately **3 MB**, source metadata to **32 KB per run**, and recorded history to **64 events**. Oversized transitions are refused.
- Invalid units, incompatible inertia or command, stale request/context, repeated evidence, unsupported models, and invalid samples are refusals. Model rollout failures and unavailable refinement remain visible alongside otherwise valid supplied evidence.

These are software and computational limits. Nothing in this workflow grants hardware authorization, establishes safe release conditions, authenticates acquisition, or verifies a physical law.
