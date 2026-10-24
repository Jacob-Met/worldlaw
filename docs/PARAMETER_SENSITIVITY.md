# Coefficient sensitivity to declared reading errors

Discovery Studio can inspect how the coefficients of its current scalar structure respond when the training torque readings change. A small fit residual alone cannot answer this question: a spring observed only over a tiny angular span can fit exactly while its spring coefficient remains highly sensitive to small reading changes.

Under the existing inspected-model evidence, choose **Inspect coefficient sensitivity** and declare a nonnegative absolute reading-error radius in N·m. The diagnostic holds every command, angle and rate coordinate fixed, refits precisely the inspected structure, and reports a separate lower/upper range for each coefficient. It changes neither the selected model nor the notebook evidence. Editing the radius, inspecting another model or changing observations clears the former results. Reopen the source notebook and enter the same radius to reproduce the calculation.

## Calculation and interpretation

With the fixed feature matrix X, the maintained column-normalized QR fitter computes the nominal least-squares coefficients and its response to each unit reading perturbation. If w[j,i] is coefficient j's response to reading i, independently changing each reading by at most r gives coefficient j a worst-case shift r times the sum of absolute w[j,i]. Each coefficient discloses an upper-bound witness: change reading i by r times sign(w[j,i]), then refit the same structure. Negating those changes supplies the lower witness.

The centers are conditional least-squares refits, not necessarily the supplied inspected coefficient values. Any material difference is shown. Different coefficients generally need different witnesses: the displayed coefficientwise ranges do not form a jointly achievable coefficient box. The result is a sensitivity analysis of least squares, not a set of all laws consistent with interval observations; it does not require each perturbed fit to pass a residual-adequacy test.

The radius is an explicit assumption, not estimated sensor calibration or a standard deviation. Coordinates are treated as exact. The componentwise box includes any bounded perturbation, including a common offset, and may be conservative when correlations are known. No separate correlation or calibration model is inferred. Uncertainty in coordinates, model selection, omitted structures and physical identifiability are outside this calculation. These are floating-point QR calculations of an analytic linear response, not outward-rounded certified numerical enclosures or statistical confidence intervals.

## Controls and bounds

The full course admits at most 256 readings and the existing finite scalar library. It refuses larger input rather than selecting a favorable subset. Rank-deficient structures and insufficient rows retain explicit unavailable states. A zero error radius is supported; a zero-term model has no coefficients to perturb.

The authored controls compare a symmetric spring-plus-bias model with independently enumerated reading-error corners and refit every coefficient's witness. Another exact-fit control uses angles of only ±0.0001 and ±0.00005 rad: a 0.01 N·m reading radius causes a spring-coefficient shift of 120 N·m/rad, despite the nominal coefficient being 4 N·m/rad. This is an identifiability warning conditional on the model, not evidence that a physical spring has changed sign.

Native controls: node --test tests/parameter-sensitivity.test.mjs
Real product browser course: node scripts/parameter-sensitivity-browser.mjs

The browser script uses the maintained PLAYWRIGHT_MODULE, BROWSER_EXECUTABLE_PATH and BROWSER_ARTIFACT_DIR conventions. It exercises the launched Studio, keyboard activation, witness disclosure, invalid and zero radii, stale-result clearing, source notebook download/reopen and a narrow viewport. A script existing in the repository does not imply that its course has been run; exact receiving results belong in the integration receipt.
