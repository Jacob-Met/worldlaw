# Geometry notebook controls on narrow screens

Four native file controls in Trajectory Challenge's geometry studies could exceed their containing column. At a 320px viewport they were 301px wide inside a 252px column, expanding the document to 335px. This inherited defect was reproduced before the repair, including in the standalone artifact.

The repair adds `max-width:100%` only to `#geometry-receiving`, `#geometry-open`, `#shared-geometry-calibrations` and `#shared-geometry-open` in `trajectory.css`. Native controls, existing labels, import/replay behavior and scientific modules are unchanged. The existing Studio `#experiment-receipts` rule remains separate.

## Receiving

The repair was received on base `0ffda6d590663b8c9e0756128dbcf3e8018feb72`. The repaired `trajectory.css` is 29,785 bytes, with SHA-256 `b4f193e33e1900023109d6198dd95eb952d1aaeae5309872e5770685cd8981f8`.

Receiving used Node v22.23.4 and Chrome 156.0.8078.47 with the sandbox active. The standalone used esbuild 0.27.3.

The maintained trajectory course passed 21 groups in the served application and 23 groups in the offline artifact. The geometry course retained its original assertions and added actual keyboard Space → native chooser → supported original-input receiving for all four controls. Its 64 assertions passed in both forms, including source-only save/reopen, ignored cached coefficients, invalid replacement refusal and delayed-input retirement. These are the same assertions exercised in two delivery forms.

At 320, 390 and 1440px, document width equals viewport width with all four controls enabled. At 320px the controls shrink to 252px; at 390px and desktop their 301px native width remains available. Actual final screenshots at 320, 390 and 1440px were visually inspected. The rule fixes intrinsic sizing without hiding content or changing motion.

The received candidate standalone is 1,547,854 bytes, SHA-256 `f652c24ad3dd3357bd2f16d1e18ccb13cb07710cfab14ddca917c53e4b266e93`. Its 158 captured source inputs include the exact repaired stylesheet. A later clean-source release build has its own provenance and digest; this candidate digest does not identify that later artifact.

## Qualification limits

An Enter-only harness attempt opened the first chooser but timed out on a later chooser; that observation is retained. Space activation was qualified for all four controls. This is narrow layout and original-input workflow qualification, not a comprehensive accessibility audit. Preexisting labeling and presentation limitations remain separate.

An initial browser launch hit a temporary-directory socket-path limit; the maintained short temporary location resolved it without changing product code or sandbox settings. Original receiving failures were retained.

The numerical fitting receipt's original inherited failure remains valid historical evidence. This subsequent change repairs that receiving defect without changing the optimizer or any scientific model.

## Subsequent shared-geometry chooser label

A separate correction associates the existing visible reopening sentence with `#shared-geometry-open` using a native label inside the original paragraph. The wording, paragraph wrapper, input position, handlers and scientific processing remain the same. The visible text now activates its corresponding native chooser and supplies the control's accessible name.

The correction was received on base `23cff1bdd97a7be95a0c8b72fba108b9da178b91`. Its `src/shared-geometry-law/panel.mjs` is 8,559 bytes, SHA-256 `d703d177231ba7c088b3a7b27cf3701a38d1bc88ff7106d9a088a04fbce59a02`.

The focused course passed the same 34 assertions in both served and standalone forms. Actual Chrome accessibility-tree inspection confirmed the exact name and native label association. Activating the visible label opened the intended chooser; supported original input reproduced the canonical comparison. Space activation and cached-result refusal also passed. All four enabled file controls remained contained at 320, 390 and 1440px, with the browser sandbox active and no browser errors.

A local comparison decoded section screenshots with the label and with the original plain text in the same enabled state. It found zero different pixels at all three widths: 763,308 pixels at 320px, 852,510 at 390px and 1,555,672 at 1440px. This is automated pixel comparison, not a claim of human visual inspection. An initial missing optional image-library dependency was retained as a receiving failure; the comparison completed using standard-library PNG decoding without changing product code.

This qualifies the specific control's name, activation, reopening and rendering. It does not establish complete accessibility coverage or resolve the separate full-source distribution intake.
