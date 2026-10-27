# One declared calibration offset across original and actual readings

The existing shared-calibration inquiry optionally associates each retained challenge row with an original calibration group. The association is a complete ordered array of `{eventIndex,rowIndex,groupId,basis,sameAdditiveOffset:true}`. Use an existing group ID or explicit `null` when no original calibration correction is shared. Blank retains the independent-source interpretation. No association is inferred from equal names, timestamps, residuals, or instrument labels.

When this option is used, the separately sourced challenge radii describe residual reading error after the shared calibration component. They are not automatically derived from total instrument uncertainty. The UI identifies every retained challenge row and explains this changed interpretation before search. Edits retire prior results and pending replay.

## Executed distinction

Original bias-only readings equal1 and an actual reading equals1.03. Treating original±.02 and actual±.021 as independent source bounds admits a checked witness. If the same calibration correction applies to both, it cancels: corrected actual minus independently refitted bias remains.03. With separately declared residual±.001, the maintained envelope checker returns separation with gap about.029. This conditional statement does not establish which source relationship is physically true.

## Reused mechanism and limits

For a challenge row associated with group g, the normalized group influence is the original-fit influence minus that group's radius. The same latent component corrects all original rows in its group and the explicitly associated challenge readings. Optional independent original residuals remain separate components. Every complete latent dimension is charged to the maintained search budget; no challenge row or original model is silently omitted.

Witness verification reconstructs original summed offsets, independently refits all original rows, then checks the ORIGINAL actual readings corrected by that same calibration component against the supplied residual bounds. It never uses an original row's independent residual as an instrument-wide correction. Source keys bind complete association order, basis, original rows/model, and every radius; replay reconstructs rather than trusting saved verdicts.

The correction-radius magnitude is included in the uncancelled engineering rounding allowance; corrected observations also receive an arithmetic allowance during independent checking. These are numerical engineering checks, not rigorous QR-error bounds, physical feasibility proofs, posterior confidence, or measured calibration. Contact and budget exhaustion remain unresolved. Original notebook fits, ranking, received evidence and prospective promises are unchanged; the result does not adopt a new law.
