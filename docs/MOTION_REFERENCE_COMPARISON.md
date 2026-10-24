# Separate source-frame marks in Motion Lab

Motion Lab retains image positions and tracking diagnostics. A high correlation score does not establish where the physical marker really was. The source-frame comparison lets a separate, fallible marking account challenge those retained positions without rewriting the notebook.

Open **Compare this notebook with separate source-frame marks** from the measurement ledger, or visit `/motion-reference.html`. Choose the notebook and a reference JSON, then explicitly compare. Save inputs to keep both complete raw accounts, or export the derived report. Attach the original video to inspect the source pixels.

## What a comparison means

Each target uses its own evidence. `marker` means the notebook's retained marker position. `pivot` means the independently retained pivot measurement when the notebook uses tracked mode; otherwise it means the **fixed pivot declaration**. A fixed point does not become a measurement because a reference mark is nearby.

The original notebook is admitted through the maintained Motion validator. The reference is admitted by the unchanged CHRONOS shared reference validator, pinned with its upstream commit and exact Git blob in `src/motion/vendor/reference-source.json`. The consumer supplies only the allowed target IDs and the notebook's source/raster context. No tracker, fitter or second annotation format is added.

The two accounts must declare the same original video SHA-256 and native pixel raster. Both native dimensions must have been recorded in the notebook, and the measurement raster must equal those dimensions. A reduced raster is refused; positions are not silently scaled. The current maintained video decoder limits its working raster to 960 × 720, so larger recordings must first acquire an explicitly supported original-raster path before this comparison can accept their reduced Motion notebooks.

Labels join retained times at the shared microsecond key. Colliding retained timestamps are refused. There is no nearest-time borrowing or interpolation. An explicit reference time that has no retained frame remains visible and unscored, as do retained times without labels. Hidden or unidentifiable marks, missing/rejected positions, nominal measurement clocks, and reference frames outside the declared time-difference limit stay unscored. Diagnostic candidates never supply an observed point.

For a scored row, distance is the Euclidean distance between the retained coordinate and the separately marked coordinate. A declared marking radius `r` produces the interval `[max(0, distance − r), distance + r]`. This interval describes only the authored disk around the reference mark. It excludes timing error, calibrated tracker error, calibration uncertainty, physical accuracy and probability. The original pixel-match score is displayed separately and never weights the mark or shrinks its radius.

## Reference input

Use `chronos-independent-reference/v1`, native-video-raster coordinates, pixels and video-relative seconds. The only accepted target IDs are `marker` and `pivot`; either or both can be supplied. Each visible label needs its requested label time `t`, actual extracted frame time `frame_t`, decoded PNG SHA-256, center and explicit radius. `occluded` and `unidentifiable` labels must not contain visible coordinates.

```json
{
  "format": "chronos-independent-reference/v1",
  "source": {"sha256": "<original video SHA-256>", "width": 476, "height": 476},
  "position_unit": "px",
  "time_unit": "s",
  "coordinate_frame": "native-video-raster",
  "annotation": {
    "independent_of_tracker": true,
    "method": "Describe the actual separate marking method and the basis for its radius."
  },
  "tracks": [{"id": "marker", "labels": [{
    "t": 2,
    "frame_t": 2,
    "frame_sha256": "<decoded original PNG SHA-256>",
    "status": "visible",
    "x": 288,
    "y": 140,
    "uncertainty_px": 5
  }]}]
}
```

The placeholders above must be replaced with real hashes. The default maximum frame difference is 0.005 s; a caller may explicitly set a value from 0 to 0.05 s. Editing this limit stages a change until Compare is pressed. A reference is capped at 2 MiB, and a saved input case at 4 MiB, in addition to the maintained notebook limits. The shared validator also bounds label counts and field lengths. Reference annotation independence, positions, frame times and PNG hashes remain producer declarations, not authenticated truth.

The maintained CHRONOS `evaluation/bin/extract-reference-frames.py` can extract unannotated original PNGs and a marking template. Its separate verification mode checks original bytes, actual frame indexes/times and the resulting PNG hashes. Nonzero PTS origins need an explicit mapping. Mark the PNGs separately; do not copy tracker positions into a purported independent reference. The application does not infer positions or marking uncertainty from that template.

## Source inspection and custody

The reference page uses the existing local-video decoder. Attachment verifies the original file SHA-256, native/working dimensions and duration within 0.001 s of the notebook. A failed attachment preserves an already verified source and the accepted comparison. Source media is never uploaded or included in a saved comparison.

The viewer requests the reference frame when one exists, otherwise the retained measurement time. It shows each overlay only when the actual displayed decoded timestamp is within the accepted limit of that overlay's own time. Retained positions additionally require a decoded measurement clock. A reference can therefore be visible while a rejected or differently timed position stays hidden, and vice versa. If the browser supplies only a nominal seek clock, both overlays are hidden with an explicit caption. A pink cross/radius identifies the reference, a cyan circle identifies a retained observation, and a yellow diamond identifies a fixed declaration.

Browser-decoded pixels are not authenticated against the producer's PNG hash; decoding paths can differ. The PNG hash stays visible as declared provenance. Attaching the original video gives a useful source inspection path, not an endorsement of annotation identity or correctness.

Input reads and source attachment retain generation guards. A newer user choice cannot be replaced by an older file read. Row changes cancel the previous decode and serialize the next request; stale pixels cannot be painted under a newer selection. The table renders at most 50 rows per page, with explicit filters and full scored/unscored counts.

Saved `worldlaw.motion-reference-case/v1` files contain only the original notebook, reference and comparison options. Reopening runs both admissions and recomputes the comparison. Supplied computed answers are ignored. The derived `worldlaw.motion-reference-comparison/v1` report retains explicit reasons for unscored rows, original scores, frame timing, annotation method and limitations. Neither path edits measurements, revisions or angular exports.

## Receiving evidence

The original recording was [Double-pendulum-metastable-mode.webm](https://commons.wikimedia.org/wiki/File:Double-pendulum-metastable-mode.webm), by Frank Stollmeier and Manuel Schottdorf, under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Original SHA-256: `fbec4761d153c6a5bf486e88ff333aef9cd32b64e1fc87488a594d22b18c9bad`; 476 × 476, 25 fps, 182.6 s. The original video and extracted PNGs are internal receiving inputs and are not bundled with this change.

The previously frozen full-candidate-confirmation profile retained 246 rows through 10 s (one manual anchor and 245 accepted tracked points). These are the actual retained decoded times, not a claim that every nominal requested sample produced a distinct row. No profile tuning was done for this comparison.

Four unannotated original PNGs were extracted at 2, 4, 6 and 8 s with the unchanged CHRONOS extractor. The assistant visually estimated the red-rimmed disk centers **before reading the retained tracker coordinates at those times**, then recorded an authored 5 px radius. This is a sparse, fallible visual comparison; the radius is not calibrated and the exercise is not a blind identity study. The source-frame hashes were separately re-extracted and verified before receiving.

| Actual time / s | Separate mark / px | Retained position / px | Center distance / px | Declared-radius interval / px |
| --- | --- | --- | --- | --- |
| 2 | 288, 140 | 288.013155, 141.029170 | 1.029254 | 0–6.029254 |
| 4 | 220, 130 | 219.972116, 131.044444 | 1.044816 | 0–6.044816 |
| 6 | 146, 185 | 145.975869, 186.075253 | 1.075524 | 0–6.075524 |
| 8 | 340, 272 | 339.986193, 273.009935 | 1.010029 | 0–6.010029 |

The four mean/max center distances are 1.039906/1.075524 px. The other **242 retained rows remain unlabeled and unscored**. These four marks do not establish full-trajectory accuracy, general marker identity, calibrated tracking uncertainty or physical-model correctness.

Six native groups cover an independent 3–4–5 distance oracle, gaps/visibility, time mismatch and nominal clocks, pair independence/fixed declarations, source/raster/identity/duration/collision refusals, and raw-case custody. On the complete current source based on `1e2b875a57ca2702bb5581537f3288122ddf3944`, 681 native tests completed: 680 passed, zero failed, one inherited optional skip. Both launched product/trajectory smoke courses passed.

Eight actual sandboxed Chrome groups cover the ordinary Motion link and four original frames; completed raw/report downloads and independent distance calculations; an explicit +40 px offset control despite a high recorded score; gaps and overlay clocks; independent paired/fixed targets; source/refusal/delayed-read/rapid-seek custody; 390 px fresh reopen and keyboard inspection; and actual nominal-clock fallback with both overlays hidden. No browser exceptions or off-site requests occurred. The numeric receipt and source hashes are retained at `docs/receipts/motion-reference-e898/actual-browser.json`; the original separate labels are alongside it. Desktop and narrow source views were visually inspected. Altered controls are explicitly authored software tests, not additional natural-scene measurements.

Run the receiving course with the original local video, the frozen notebook and the retained reference file:

```sh
node --test tests/motion-reference.test.mjs
node scripts/motion-reference-browser.mjs ORIGINAL_VIDEO NOTEBOOK REFERENCE NEW_OUTPUT_DIRECTORY
```

Set `PLAYWRIGHT_PATH` and `CHROME_BINARY` for installed runtime locations when necessary. The browser sandbox remains enabled. A receiving output directory must be new so an earlier failure or receipt cannot be overwritten.
