# Explicit original calibration groups

This document describes the shared-calibration-only mode (optional residual input left blank). For separately sourced independent reading residuals added to the common calibration components, see [Original calibration offsets plus independent reading residuals](MIXED_ORIGINAL_CALIBRATION.md). In that mode, exact within-group equality applies to the calibration component; actual row offsets also include their declared residual component.

The independent-challenge precision card can now ask whether one sourced additive calibration offset per original training group explains the complete received course. This is a separate source assumption from independent row bounds. It does not infer correlation from residuals, alter the old independent-box result, fit an instrument calibration or adopt a new law.

Each JSON group supplies `id`, `rows`, `radius`, `basis` and `sameAdditiveOffset: true`. Every zero-based original training row index must occur in exactly one group; groups are nonempty and distinct, with at most 128 groups. Radius is a finite nonnegative torque bound up to 1,000,000 N·m. The explicit declaration means precisely the same additive torque offset applies to all readings in that group. Separate groups are independently bounded. Initial controls are empty, and the original challenge precision declarations still apply.

## Grounded distinction

Eight original readings alternate command/position −1 and +1 with torque equal to command. The independent actual reading is 2.02 N·m at command 2, with achieved radius 0.001. Independent original row errors bounded by 0.02 admit a checked command-family witness. One common additive calibration offset across all original readings cancels from the fitted slope; the maintained checker gives separation with zero training support and gap 0.019 N·m. Independently repeated fits at offset −0.02, zero and +0.02 retain slope 1. Declaring separate sourced negative- and positive-command calibration groups admits a checked witness. These are conditional source hypotheses, not measured calibration conclusions.

## Reused numerical mechanism

For each receiving influence row, the adapter sums the original influence coefficients belonging to each group and multiplies by that group's radius. The existing unit-box search therefore varies one normalized offset per group. Original complete row count, preparation bounds and source are retained separately; candidate matrix work uses the actual grouped dimension. Original-source preparation and independent full-row refits remain additional bounded work, as stated in the existing consumer.

A witness certificate stores actual offsets for every original training reading. Admission checks its own row bound and exact within-group equality before independently refitting every original row. A separating certificate uses the grouped influence envelope. The source key retains complete original model/rows, group membership, radius, source basis and achieved receiving declarations. Source-only replay reconstructs and rechecks the result; current-source mismatch refuses attachment.

Grouping uses an uncancelled absolute-term scale and a row-count-dependent engineering arithmetic allowance in addition to the maintained numerical screens. This is not a formal bound on QR error or physical feasibility. Zero radius is preserved. Exhausted search/contact remains unresolved; original unsupported robust/weighted/generated/coordinate-uncertain contexts still refuse. The maintained search and checker modules, original fitting/ranking, prospective promises and notebook event formats are unchanged.

## Receiving

Four focused controls cover common-offset cancellation versus separate-group witness, singleton parity with independent row boxes, complete membership and declarations, zero/work refusal, source replay and forged within-group offset rejection. The current affected native closure passes 131 tests.

Six actual browser groups (three original-row predecessor groups and three common-calibration groups) pass at runtime index `d89895f7f827a83c2c16b9f7d21fe7dc20f1a631a18379ccd5cfca0451fd3de9`, based on merged `b20f9a8386d351bb4b15e21e4356a76250eff82c`. They exercise actual file intake, keyboard actions, export/replay, changed grouping and stale-source/omitted-row refusal. Desktop/narrow captures were inspected. Active sandbox, zero page exceptions and complete owned process-family exit were observed; profile retained.

The first browser course failed because the authored successor receiver reused the predecessor's global object-URL interception variable, causing recursion. Its failed receipt is retained. The successor receiver now captures its original function locally, uses separate state and restores it after capture; the product source was unchanged by this receiving-only fix. No physical apparatus, persistent deployment or full-repository gate claim is made.

Independent SYNAPSE review personally ran all four focused controls and accepted complete partition, actual-offset equality, uncancelled numerical guard, original-source replay, grouped work accounting and direct-control invalidation; no blocker or edits. Browser evidence remains separately attributed.
