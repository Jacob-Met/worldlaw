# Joint position and supplied-rate trajectories

The optional Motion study fits a declared smooth angular law against original position and supplied angular-rate rows. Position errors are divided by a declared position scale in radians; rate errors by a declared rate scale in rad/s. The score is the dimensionless RMS of these two residual components over all original rows, including initialization. These scales define an objective, not independent standard deviations, likelihood, sensor calibration or confidence. Each original course must retain a rate provenance declaration with dependence explicitly not assumed independent.

The source-only notebook recomputes the original full-six predictive comparison, maintained fixed refinement and position-only sensitivity fit. Only original training courses enter the added fit. Both channels of a separate challenge are evaluated after freezing coefficients; neither can select weights or the winner. Missing supplied readings refuse the optional branch without erasing the original comparison. Cached fitted results are not inputs. The current supplied-row join expects original IDs to match normalized IDs; surrounding-whitespace IDs may refuse rather than silently misassociate channels.

## Numerical and resource admission

The receiver captures the same two forward executions made by the maintained resolution comparator. It adds a maximum angular-rate difference at the same sample timestamps; no extra solve is performed. Both maximum position and rate differences must satisfy declared positive screens, each no greater than0.001 in its own units. Numerical comparison excludes only the initialized sample; fitting residuals include every original sample. Two-resolution agreement is not a calibrated error enclosure.

The existing bounded damped finite-difference search retains finite coefficient bounds, at most12 iterations and at most4 smooth terms. Its complete `1+iterations*(2*n+4)` all-course reservation precedes evaluation. Doubled residual-row count must not exceed262144; integration steps remain capped at4million. Incomplete perturbations cannot make a Jacobian, incomplete candidates cannot win, and nonfinite scaled residuals refuse. Separate challenge work is fully reserved before forecasts. Stage budgets are explicit rather than a claimed global cap.

## Independent authored controls and retained negatives

With an explicitly added angle-only artifact and accurate independently authored rate observations, a separately authored release gives0.00201793rad from the joint fit versus0.01139179rad from position-only sensitivity fitting. This is an additional-information comparison, not equal-input superiority.

An explicitly biased rate channel reverses the outcome:0.01303179rad from the joint fit versus about1.43e−9rad with clean positions alone. The consumer includes this negative as a separate explicit action. Both screens and all original comparisons remain visible. A native control also imposes an extremely strict rate screen: the position screen passes but the optional joint seed remains unresolved.

The consumed measured small-baffle recording remains negative for the previously frozen models. Against its original supplied rate channel, maintained refinement has0.2835120rad/s error, predictive0.3495709 and pooled sensitivity0.4511266. Their rate numerical differences are about1.3e−5rad/s; the weak full-six result is unresolved. No rate observations were invented or derived for this check, and no measured joint-fit gain is claimed. All earlier measured transfer and prefix-calibration losses remain in their original source/evidence packets.

## Consumer

The maintained Motion page provides explicit authored-positive and biased-rate-negative actions plus source-only import/download. It displays scales and their basis, channel provenance/dependence, both numerical screens and measured differences, original comparisons, and angle/rate plots. Parent intent retires pending source reads; frame and file completions check source activity, epoch and connection before recomputation/adoption. This separate study never applies a law or replaces parent observations.
