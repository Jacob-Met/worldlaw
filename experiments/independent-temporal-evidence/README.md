# An independent temporal-order and residual assay

This experiment freezes 192 weak-beam models from Worldlaw run 45293746667 and tests each on newly generated sensor noise. The twenty mathematical laws, coefficients and test forcing schedules are the same as in the public source course. The assessment adds one independently acquired verification recording for each model. It makes no claim of a new family holdout.

The observed first eleven time samples initialize each forecast. Subsequent state values are excluded from the integration path. The recorded future command schedule is known. For the order test, correlate the centered predicted and observed state over every common cyclic shift of the observed suffix. The identity shift's conservative one-sided rank must be at most .005. Under a uniformly shuffled suffix, conditional on its contents and the earlier information, this is a finite randomization test. A constant forecast carries no order information.

For the misspecification test, center the residual at each site, split time into eight equal nonoverlapping blocks, and sum squared block totals over sites. Compare to 255 fixed-seed permutations of the complete spatial rows. Require a right-tail p-value above .01. This test detects structured residuals, including those from inaccurate fitted coefficients and noisy starting states. Failure to reject does not establish a governing law. Centering makes the structure statistic insensitive to a constant channel bias. The two tests have different nulls.

Separately, an initialization ablation applies spatial Fourier power shrinkage to the same eleven-point causal cubic extrapolation for periodic fields. The sine/cosine pair noise power estimate is 4σ²(113/143)/N. The coefficient 113/143 is the sum of squares of the known cubic endpoint weights. The real Nyquist mode has power σ²(113/143)/N; the spatial mean is retained. The noise estimate uses temporal second differences of the prefix only. Both archived active and random PDE models receive the same intervention. All four 24-case means, including regressions, remain in the receiver. The gate requires active plus shrink to beat .035847301 and both random controls.

Registrations are 194496 and 194505. The frozen subset retains every weak-beam row of the original two independently authenticated archives. Their SHA-256 digests are bb46c019e980608fbf5377eb5eaca0e20eb2e514695b5ac88c98ce5ef75bd8f9 and 5f4d1c72100a8819ccf04026fe091fca0831feaa36e68aae12e00a005afc42b5. The extraction retained world, kind, control, SNR, acquisition, query, model and old status. No old scores or predictions entered the new evaluator. Stable seed 614113+1000×world_index+100×SNR_index uses the producer's original SNR ordering 40/25/15. Omitted mechanisms add 300000. Only the sham arm permutes measured states, with a separate seed offset of 701. Clean reference states are opened only to score saved periodic forecasts. A failure of the science gate remains a measured result.

From the repository root:

    node --test tests/temporal-evidence.test.mjs
    node experiments/independent-temporal-evidence/course.mjs /path/to/nullgarden/src/state-operator-course.mjs
    node scripts/verify-temporal-model.mjs < model-and-independent-recording.json

The CLI input has a symbolic evolution model in model and an independent state trajectory in recording. Numerical code is unchanged from the package's own RK4 evolution. The experiment uses Nullgarden commit 4af7717a866e0246e7c0bcd81977cea53cddbd8c. A strong predictive score and a structural certificate remain distinct.
