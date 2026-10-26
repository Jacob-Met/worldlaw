# Conditional responses that disappear in an average

UNKNOWN LAB's original paired-history screen estimates a mean preparation contrast. A response that changes sign with rate can have a zero mean despite being reproducible. The existing fixed-probe investigation requires each recording to stay at one probe state. The mixed-state consumer instead uses each original matched pair directly, avoiding manual regrouping or invented constant-state measurements.

In UNKNOWN LAB, import an original history notebook, describe its fixed preparation/readout protocol, then use **What disappears in the average? → Freeze models from current pairs**. Receive a separately acquired history notebook to score the frozen predictions. Saving and reopening preserves original inputs and recomputes; it never trusts cached coefficients. Editing the active source or protocol retires the current comparison.

## Executable scope

For pair `i`, the finite hypotheses are

`conditioned torque − reference torque = response(command, position, rate) + drift × order`

where `order` is the original adjacent acquisition-index difference (+1 or −1). The response is any subset of constant, command, sine of position, and rate. All sixteen subsets are solved with WORLDLAW's maintained column-normalized QR, with the drift nuisance column included in every candidate. Rank failures remain visible. The physical meaning of command is inherited from the original observation convention; this does not calibrate actuator units.

The selection score is `n log(max(MSE, 2 sigma²)) + k log(n)`, where `sigma` is the supplied reading-noise assumption and `k` includes drift. The selected model also retains an explicit library-mismatch diagnostic when training RMS exceeds three times the declared paired reading-noise scale (3√2 sigma). A ranked winner can therefore coexist with an inadequate library. This diagnostic is heuristic.

This is a finite heuristic score with a declared noise floor, not a calibrated posterior, likelihood test, confidence interval, or physical identification. Challenge values never enter fitting or selection. Both response coefficients and instrument-drift coefficient stay frozen during challenge scoring; a changed drift can therefore cause a retained forecast loss.

This path requires exactly equal within-pair current-state coordinates, original adjacent chronology, and at least four pairs in each order. The original tolerant matched-pair screen is unchanged. Exact matching does not prove calibration or remove hidden confounders. Fixed preparation/readout, additive state response, stable per-reading drift, absence of carryover and source provenance remain declared assumptions.

## Reproducibility

- `fitMixedResponse(trainingNotebook)` accepts only the original training notebook and returns every candidate plus the selected executable model and unchanged original mean result.
- `predictMixedResponse(model, state)` evaluates the conditional preparation response. Acquisition drift is intentionally separate from that response.
- `analyzeMixedStudy(study)` validates the complete source and scores each admitted frozen candidate on a separate course.
- `worldlaw.mixed-state-response/v1` stores `protocol`, `training` and optional `challenge`. Both notebooks retain original history observations. Exact shared original reading evidence between training and challenge is refused even after pair renaming; this screen does not authenticate acquisition independence. Independent equal or quantized readings can also collide and be conservatively refused.

Run `node --test tests/mixed-state-response.test.mjs` for authored controls. Run `node scripts/mixed-state-browser.mjs` with separately supplied `PLACEMENT_PLAYWRIGHT_MODULE` and `CHROME_BINARY` for sandboxed actual-app receiving. This browser command requires the maintained UNKNOWN LAB import closure, not merely the new modules.

## Evidence and limits

The authored sign-changing control selects the rate response and predicts a separately generated course below 0.001 N·m RMSE; the constant-response baseline exceeds 0.5 N·m. A different authored offset+command+sine law is also recovered. A deterministic antisymmetric course remains inconclusive in the original mean screen while the conditional rate law is recovered. Zero response with instrument drift selects no response. Order/state confounding produces rank refusal; an omitted oscillatory response, changed mechanism and changed instrument drift retain large challenge losses. These are authored software experiments, not independently measured apparatus validation.

The UI keeps the existing paired evidence apparatus and confronts original separate observations with frozen predictions, using the established amber observation/cyan hypothesis grammar. It is an incremental scientific control within the existing lab, not a new application or general physical reconstruction. Browser and published-source receipts belong on the native issue/PR once actually executed.

The separate authored `node experiments/mixed-state-receiving.mjs` generator
uses 32 training/challenge seed pairs per mechanism, 48 original pairs per
recording, independent reading noise and randomized balanced orders. Its first
local run gave mean separate-course errors 0.004275 versus constant 0.519317
N·m for the sign-changing response, and 0.004396 versus 0.794610 for the mixed
response. It selected an unnecessary rate term in one mixed course and a
spurious response in two of 32 unchanged courses. The omitted oscillatory law
remained inaccurate: 0.708318 versus constant 0.705838 N·m, a small average
loss. These retained failures are why selection is described as heuristic.
The experiment passes no challenge coordinates or values into model selection.
Local mean complete-analysis times ranged about 3–12 ms by mechanism on this
run; these are execution observations, not browser latency guarantees.
