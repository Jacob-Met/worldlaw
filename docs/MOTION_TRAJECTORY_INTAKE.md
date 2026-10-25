# Motion recordings into executable angular laws

Use the existing **Trajectory Challenge** page and open **Use two Motion Lab recordings** in the source column. Save each recording from Motion Lab after tracking its original video and accepting an angular reference. Choose one notebook for training and a separately acquired original video for the challenge. Choose one continuous course in each file, declare its origin and starting angular rate, and explain the starting-rate basis. Declare the common physical angle zero/direction/fixed camera orientation and unforced scalar dynamics before applying the pair.

The maintained angular fitter learns from training angles only. The maintained forward solver uses the challenge's initial angle and caller-supplied rate; its later derived angles are compared with the prediction. No inertia, torque channel, resampling, recentering or new fitting policy is introduced. The page retains ordinary model ambiguity, failed trajectories, residuals and no-learning baselines. A bad challenge remains a bad challenge; it never silently selects a better model.

## What is preserved

The trajectory notebook contains the original derived times and unwrapped angles, original video SHA-256, the exact UTF-8 Motion input byte digest, calibration, selected course, original observation indices, source declarations, and a bounded reference-history summary/digest. Original point measurements, revision records and reference-fit membership remain in the identified Motion notebook. Retain that notebook for measurement and revision reinspection, and retain the separately identified original video for pixel reinspection. Original video pixels are not embedded in the Motion notebook. A digest identifies the bytes supplied; it does not authenticate acquisition, physical origin or independence.

Angle references fitted from the same recording are explicitly disclosed in the visible source description and retained provenance. Such calibration can use later source frames, including challenge frames. This is a retrospective comparison conditional on that calibration, not a prospectively calibrated physical test. The reference error and its correlation with the observed marker are not included in a calibrated physical uncertainty claim. Separate source hashes do not prove independent physical evidence.

## Admission and limits

- Only fixed-reference Motion notebooks with identified original video bytes enter this autonomous scalar intake. The separate moving-pivot angle workflow remains available in Motion Lab.
- Every selected observation needs a decoded-media timestamp, or an explicitly synthetic time for a synthetic source. Nominal seek positions cannot establish a dynamics clock.
- Rejected observations and gaps remain separate courses. Multiple courses require an explicit selection; no hidden bridge is added.
- The starting angular rate and its basis must be supplied. A zero rate is accepted only as an explicit caller declaration; it is never assumed from the first frame or fitted from later challenge positions.
- The same original video cannot serve both roles, even if its notebooks have different names, edits or selected courses. Maintained angular evidence checks also screen complete copied trajectories and long copied subwindows; these checks do not prove independence.
- Existing Motion input (2 MB), angular sample/duration and source-metadata (32 KB per run), and portable trajectory notebook (3 MB) bounds apply. A rejected intake preserves the loaded challenge. Changing a prepared source clears its rate and common setup declarations.

Reopen the normal exported trajectory notebook to reconstruct models and predictions from the retained angular inputs. The original Motion file is separately required to reconstruct point-measurement-to-angle derivation. The separately identified original video is required to inspect or repeat measurements of its pixels.

## Executed authored control

Three independently encoded synthetic oscillator movies were decoded and tracked by the real Motion UI, each yielding 160 accepted observations. The training-selected law was approximately
`alpha = -0.22952 * rate - 5.7682 * angle`.
On a separate movie using the same authored dynamics, the forward position RMS error was 0.0111 rad, versus 1.2704 rad for both initial-angle and initial-rate baselines. A third movie with different restoring dynamics produced 0.6815 rad RMS error with the identical training-selected law. The test therefore retains both successful predictive transfer and an informative failed transfer.

The source construction used a closed analytic damped oscillator independently of the WORLDLAW fitter/solver. These movies establish software behavior, not measured physical accuracy, arbitrary law discovery or blind external validation. The fitted coefficient values also retain video/reference/estimation error; they are not exact recovery.

## Reproduce

```sh
node --test tests/motion-intake.test.mjs
node scripts/generate-motion-intake-fixtures.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs \
BROWSER_EXECUTABLE_PATH=/absolute/path/to/sandbox-capable/chrome \
node scripts/motion-intake-browser.mjs
npm run verify
```

The browser receiver uses actual file inputs, encoded-video decode and tracking, reference acceptance, notebook downloads, intake, existing model execution, portable reopen, shared-source refusal preserving the prior result, a different-law negative control, narrow layout and keyboard activation. Chromium sandboxing is enabled.
