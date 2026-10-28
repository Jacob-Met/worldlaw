# Authored exposure pixels through NCC and angle conversion

Closes #467. This bounded research connects an authored observation operator to the maintained tracker and angle consumer. It does not change Motion acquisition, its UI, or the acquisition work owned under #238.

## Result and interpretation

All five declared cases remain in the evidence, including the complete-turn low-texture refusal. The stationary case returns zero. The 0.2, 0.8 and 2.4 quadratic cases return accepted angles about 0.0628595, 0.0966149 and 0.0967439 rad. Their ideal continuous-centroid approximations are about 0.0666440, 0.2651989 and 0.7547598 rad. These are different observation operators; an accepted correlation match is not a centroid or a mean angle. Current Motion copy already states that score is correlation, not probability or a position-error bound. No UI correction or estimator change follows from this experiment.

The authoritative report is sensitivity.json. It applies the declared minimum ideal-centroid radius of 2 px; the complete turn has no admitted ideal angle. The initial exploratory report and executed script are preserved under provenance, including their unqualified atan2 of a numerical near-zero centroid. That historical number is not an admitted result. The active reproduction uses the single render.mjs implementation; the historical script is evidence, not a runnable repository entry point.

## Exact source and limits

protocol.json records source main 753c82265d7fb291053af3e1363a0e40ca32d25b, tracker blob bf30e5ff61a6d608fa883c2aae9e96b3f84d2e90 and measurement blob bc2679939ceeb0ba98bae235e79dea2395ff471b. Scripts import those maintained repository paths; no duplicate tracker or measurement is published. Protocol freezing followed exploration, not blind discovery.

Each 128×128 opaque grayscale raster samples a Gaussian at integer pixel coordinates, averages constant-brightness temporal midpoints over an explicitly declared [0,1] interval, then quantizes once to Uint8ClampedArray. There is no pixel-area integration. All tracker statuses, reasons, candidates and settings are retained. The three finite grids (128, 512, 2048) produced identical quantized pixels and full tracker outputs for these five cases. This is finite-case sensitivity evidence, not a temporal error bound.

PNG receiving used actual lossless encoding, browser createImageBitmap/canvas decode, and unchanged maintained grayscale/NCC. It did not use Motion's HTMLVideoElement acquisition. The angle adapter explicitly ingests each accepted estimate into a separate synthetic notebook through the manual measurement API. No candidate from a refused match is promoted. Report time 0.5 is the authored exposure midpoint, not shutter duration inferred from cadence. Zero pixelSigma is an authored calibration declaration, not tracker accuracy evidence. No rates, physical law, camera characteristics or cross-case trajectory are fitted.

## Reproduction

From repository root:

```sh
node research/authored-exposure-ncc/reproduce.mjs
node research/authored-exposure-ncc/receive-angle.mjs
```

Both commands recompute and deep-compare frozen evidence without overwriting it. Fresh repository-relative receiving passed all 15 tracker reports and all five angle/refusal cases. review-worldlaw.json records independent native/source review of the original qualification files; its hashes are historical, not hashes of the adapted entry points.

Optional browser fixture generation uses Node plus Pillow:

```sh
node research/authored-exposure-ncc/prepare-pixels.mjs
python research/authored-exposure-ncc/encode-png.py
```

Run browser-png.mjs from repository root with PLAYWRIGHT_MODULE, CHROME_BINARY and OUTPUT pointing to an existing private output directory. Use a nonroot browser with its sandbox enabled. The harness starts and closes its own server/browser and compares all five decoded tracker reports. Generated PNG hashes are verified against their newly generated manifest; decoder RGBA identity is checked as well. PNG encoder-version changes may change compressed byte hashes. The retained png-receiving.json records the original five-case Chrome 156 sandboxed receiving. repository-png-receiving.json records a fresh focused run of the repository-relative harness with those same six PNGs: all five decoded tracker reports matched the frozen native reports exactly. It records every served file SHA256 and Git blob, and Namespace/Seccomp sandbox evidence. Both browser and server closed. No Motion acquisition or UI was exercised. Private QA directories and generated image payloads are excluded from publication.
