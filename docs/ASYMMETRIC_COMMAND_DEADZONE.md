# Compare separate command thresholds

In the existing Studio **Investigate a static command dead zone** instrument,
select **Compare separate negative / positive thresholds**. Supply a finite
width grid containing zero. Every ordered pair from that grid is tested:
negative magnitude n and positive magnitude p define mapped command

- u − p when u > p;
- u + n when u < −n;
- zero otherwise.

This is a memoryless continuous input map. It does not represent backlash,
hysteresis, actuator dynamics or a calibrated sensor correction. Original
commands, torque readings and other coordinates remain retained unchanged.

The comparison reuses the maintained full structure discovery, option admission,
reading loss, scaled QR and solver. All Cartesian candidates reserve their
complete discovery and robust-iteration work before any fit. An oversized
comparison refuses as a whole. The existing symmetric comparison and its v1
source envelope retain their behavior. The diagonal of the new Cartesian grid
matches that symmetric comparison exactly.

The full table shows every candidate, original training errors, separate
receiving errors and adequacy. The zero mapping and best symmetric candidate
remain explicit. Ranking uses training readings only; receiving readings do not
choose thresholds, terms or settings. Scores condition on offered mappings and
do not charge for searching the threshold grid. They are heuristic comparisons,
not calibrated probabilities or proof of physical asymmetry. Exact ties prefer
symmetric mappings, then smaller total thresholds and smaller negative threshold.
Gain, bias and mechanical terms can compensate for a wrong mapping. Without
independent command excitation, several thresholds may remain indistinguishable.

The existing response sweep and residual view use original command coordinates.
Conditional motion uses the maintained solver with the selected constant mapped
command. This does not silently adopt the candidate as the Studio law. Changing
threshold declarations or family choice retires the result and disables saving.

Save comparison inputs downloads a `worldlaw.asymmetric-command-deadzone-inputs/v1`
envelope containing the original portable Studio notebook and width declarations.
Reopen restores that source and the explicit family choice; compare again to
recompute. Derived model verdicts are neither saved nor accepted on reopen.

## Receiving

    node --test tests/command-deadzone.test.mjs tests/asymmetric-command-deadzone.test.mjs
    PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs BROWSER_EXECUTABLE_PATH=/path/to/chrome BROWSER_ARTIFACT_DIR=/tmp/asymmetric-command node scripts/asymmetric-command-deadzone-browser.mjs

Independent authored courses use unequal thresholds (.71,.23) and (.19,.83),
97 training rows and 83 separate receiving rows. Controls preserve the symmetric
family's mismatch, compare every symmetric diagonal model exactly, mutate held
outcomes without changing the fit, test whole-work refusal and solver parity,
and retain an omitted nonlinear command response as a failure. These are authored
numerical controls, not physical measurements. Exact executed revisions and
browser results belong to native issue329 and its integration PR.

The [executed receiving record](receipts/asymmetric-command-329/receiving.json) pins the tested source files. All 15 affected native tests passed, including refusal of accidental asymmetric input to the symmetric predictor. The composed Studio passed its application smoke check and eight asymmetric browser groups; the existing symmetric consumer passed all ten browser groups. Desktop and 390-pixel views were visually inspected. Saved source reopening, zero-baseline inspection, valid/refused conditional motion and stale-import replacement were exercised through the actual instrument. Original authored comparison inputs and browser receipts are retained beside the record.
