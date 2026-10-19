# Screened trajectory experiment release

## Consumer and scientific scope

This increment connects the trajectory planner, separately implemented synthetic
instrument, evidence session and numerical screen to the actual workbench.
Open `npm start`, follow **Trajectory Challenge**, and load **Small-angle
ambiguity**. In **Plan the next run**, choose **Plan a release**, inspect the
training-model forecasts and screen, acquire the recommended recording, and
choose **Learn from this run** to apply it. Pending evidence can be saved and
reopened before application.

The planner considers a bounded training-ranked subset of a declared library.
Its RMS position-disagreement score is a heuristic in radians. It reads no
reserved observations or instrument truth. The independent virtual instrument
uses its fixed explicit equation and fresh declared noise stream; it accepts no
learned model. Acquisitions are synthetic. The measured PASCO angular mode has
no connected physical instrument and retains unknown inertia and torque scale.

Application refits from all retained training runs with unchanged fit settings.
The selected revision is retained even if its prediction worsens or fails. The
comparison uses the same named reserved recording before and after; inspecting
it during development is exploratory reuse, not fresh blind validation.

## Numerical screen and recovery

The shared qualifier from [PR 7](https://github.com/Jacob-Met/worldlaw/pull/7)
checks the same retained designs and models at the declared solver step and
half that step. It preserves ranking and failures. A sensitive or unavailable
screen blocks new acquisition. Already acquired observations remain applicable,
exportable and replayable. Qualification is recomputed from inputs on reopen.

The default grid reserves 210816 planning steps plus 594432 screening steps.
The 250000-step planning and 750000-step screening allowances are separate.
Two-step agreement is not convergence, an accuracy bound, physical safety or a
guarantee about motion between sampled timestamps.

In **Release limits and observation time**, the user can change **Maximum solver
step** and **Minimum model spread** explicitly. Imported planner settings are
preserved. A pending recording remains available for **Learn from this run**
when its former recommendation fails a new screen.

## Exact qualified artifact

The received standalone is
`.receipts/trajectory-experiment-screened-standalone-92be.html`:

| Item | Qualified identity |
| --- | --- |
| HTML size | 580448 bytes |
| HTML SHA-256 | `6412a71ed6cf64f67318cb4bfda717af30e4eb3ed8650b04fa76d15bfa7dc5db` |
| Local source freeze | `26950770245528182e40d35c32c263ad8f605bf5` |
| Local source tree | `db2b11ad0d08c964345e8caae5917c965848482a` |
| Captured build inputs | 26; all matched frozen Git blobs before and after receiving |
| Builder | Node 24.19.0; installed esbuild 0.27.3 |
| Full served receiving | 21 groups, Chrome 155 |
| Independent full offline receiving | 23 groups, Chrome 131; zero external requests or page errors |
| Focused offline recovery | Chrome 155 at 320px; keyboard, invalid settings, recovery, pending Apply/export/reopen |

This local source freeze preceded publication. The publication receipt maps all
26 consumed input digests to the remote consumer commit; it does not represent
the local hash as remote history. The seven upstream qualifier files remain
byte-identical to reviewed PR 7 head
`4b95fb8557c678ecd0dad5640c23ab6b01e7677c`.

The standalone preserves the prior V1, measured V2 and unscreened V3 files. It
embeds the complete measured-data license and exact selected JSON. The source
ZIP also supplies the original CSV recordings, extraction code and audit.

## Receiving evidence and retained failures

The full browser course covers both synthetic examples, measured cumulative
failure and weak fitting, numerical resolution, model selection, notebook
transfer, storage refusal, mobile layout, planning, acquisition, pending replay,
explicit application, failed refits and numerical-screen recovery. The ordinary
release changes training from 322 to 523 samples and displayed position RMSE
from about 0.5644 to 0.000442 rad on the unchanged 161-sample reserved recording.

A real threshold case uses score 1.303591552902 rad, two-step sensitivity
0.0000265715723 rad and threshold margin 0.0000115529018 rad. It is refused,
retains all eight model forecasts and reopens with the same recomputed decision.
A real earlier pending recording remains applicable despite that refusal.

The high-noise case with seed base 50021 and acquisition seed 50024 selects
`rate+spring+gravity+bias`; its revised prediction fails with `runaway_state`.
The recording and failed selected revision remain applied after reopening.
There is no fabricated curve, zero RMSE or fallback to a better challenge model.

Independent offline receipt SHA-256:
`6aa77c3f935401c9af3d1a6866f160924d4dda2479665f7bf592a2d6dbe91273`.
Source/receiver binding SHA-256:
`99dd0378afa07f7398ebf510d3518d6c04cfbbd4fe4afec5b3e20fee0152796f`.
The first offline attempt passed 20 groups before a receiver callback race.
The maintained browser harness now explicitly waits for its deliberately
delayed file read to start before importing the newer notebook. Existing
overwrite assertions remain intact. The corrected full run passed without an
application source change.

## Actual browser video

The 41.20-second VP8 recording at 1360 by 1000 shows the actual passed screen,
independent acquisition, explicit learning and fixed-recording comparison.
It is captured from the real app and visibly labels synthetic provenance and
reused evaluation. All 33 recorded source hashes stayed unchanged.

Video SHA-256:
`9f5fbceec10621c25b02641ac66c99ee752c84f93f887eae478277c901d358d7`.
Earlier recordings remain separate checkpoints.

## Integration and reproduction

This consumer is composed over the actual merged main after trajectory PR 4,
measured PR 6, standard launch PR 8 and shared numerical screen PR 7. Every
replaced owner file is checked against the accepted V2 bytes; already merged
upstream files are compared without replacement. Studio and accepted Motion
remain part of the integrated application.

Run `npm run verify` for native and launched-server checks. Actual browser
receiving uses `scripts/trajectory-browser-92be.mjs` with separately installed
Playwright and Chromium; set `TRAJECTORY_OFFLINE_FILE` to the HTML for offline
receiving. `scripts/build-trajectory-92be.mjs` records consumed source digests,
and `scripts/package.py` builds the complete source ZIP from an exact Git pin.
The final PR and distribution record supply actual remote source/tree pins and
the integrated native result. No GitHub Actions runner or synthetic status is
used. Unknown mechanisms, topology, physical acquisition, calibrated uncertainty,
cross-apparatus transfer and full human acceptance remain open.
