# Collect a matched-history acquisition

The **Take the question to your instrument** worksheet in Unknown Lab connects a prospective balanced AB/BA sequence to the existing paired-history comparison. It creates no torque readings, sends no commands to an instrument and does not establish that declared measurements are authentic.

## Use the worksheet

1. Open `/unknown-lab.html`, then **Declare a new acquisition** in the acquisition instrument. Supply a course identifier, an even count from 8 to 128 pairs, order seed, declared sensor noise, target command/angle/rate, preparation and reset procedure, and measurement source.
2. **Freeze a new blank worksheet.** The chronological sequence contains an equal number of reference-first and conditioned-first adjacent pairs, shuffled reproducibly using the declared seed and pair count. The course identifier changes pair labels, not the order. Target values are shown separately. All four actual-value cells in every row are blank.
3. Use an independently suitable measurement arrangement and record the actual command, angle, rate and joint torque for each slot. A worksheet is a plan and record, not permission or a safety qualification for hardware operation. Preparation, reset, observation timing and instrument suitability remain the investigator's responsibility.
4. **Save worksheet** downloads a portable acquisition JSON, including partial readings. **Open worksheet** restores those inputs. Nothing is saved automatically. Keep this file as the full acquisition record.
5. After all readings are present, explicitly declare that they were obtained in the displayed order with the stated preparation. **Apply complete measurements to the comparison** passes admitted readings to the existing root paired-history evaluator. It replaces the current paired comparison; it does not append to an existing experiment.

A changed setup requires a new worksheet. Editing the declaration form does not rewrite an already frozen request. Replacing a worksheet with unsaved edits asks before discarding them. A failed import or application leaves the previous valid work available.

## What completion checks

The course retains deterministic pair identifiers, preparation labels and unique adjacent measurement indices. Reopening validates these against the frozen request; array order alone does not change chronology. Missing or substituted slots are refused. Every actual value must be present, finite and within the supported numerical bounds. Each actual command, angle and rate must agree with its declared target within 0.001 in the corresponding units; the unchanged paired-history validator also requires the two readings in each pair to match within its 0.001 tolerances.

Even accepted small state differences can change torque. The numerical tolerance does not establish physical equivalence or bound torque bias from residual mismatch.

The order-confirmation checkbox is a user declaration, not a verified instrument clock. Editing an actual reading clears that declaration; unchanged exact reopening preserves it. If the actual acquisition differed, keep the original draft and its failure; do not relabel a different chronology to make it pass. The root evaluator retains its original requirements and three-standard-error screen.

## Portable records and interpretation

The acquisition file uses `worldlaw.history-acquisition/v1`. Its request, declared schedule, actual readings and chronology confirmation are inputs. Reopening does not trust saved statistical conclusions. Partial drafts retain `null` for unknown values rather than converting them to zero.

Applying creates a `worldlaw.history-challenge/v1` notebook with `source: "measured"`, meaning **user-declared measurements**. The paired-evidence export remains compatible with the existing workbench. The root notebook retains only the user source note and worksheet identifier, alongside the paired readings and noise assumption. It does not preserve the entire preparation description and acquisition request: retain the completed worksheet alongside the paired notebook. Neither file authenticates custody, proves that an instrument was used or distinguishes a copied number from an independently measured observation.

Balanced order supports the existing linear-drift correction under its assumptions. It does not establish physical memory, remove nonlinear drift or carryover, calibrate probability, or ensure that any randomization is appropriate for a particular mechanism. Seeded shuffling is reproducible; it is not a guarantee against every phase-locked artifact. A challenged memoryless relation remains a conditional conclusion under the maintained scientific model.

## Verification status

The implementation must be received through its actual Unknown Lab entry point and extracted source package before integration. Required courses include a partial draft round trip, complete declared measurements, missing readings, mismatched state, missing chronology confirmation, unchanged prior evidence after refusal, asynchronous file-read ordering, keyboard operation and narrow layout. Execution receipts identify the exact source, commands, browser admission, inputs and outcomes; this document alone does not claim those checks passed.
