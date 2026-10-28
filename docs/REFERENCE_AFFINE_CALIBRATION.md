# Sourced affine calibration reference

An optional affine group may declare `referenceReadout` in N·m, `referenceBasis`, and `sameReferenceCorrection: true`. The correction is then `gain * (reported torque - referenceReadout) + referenceCorrection`. `radius` bounds the fractional gain; `offsetRadius` bounds the additive correction at the reference, with its separately supplied `offsetBasis`. The fractional bound remains strictly below one. Reference readout magnitude is bounded by 1e6 N·m.

The reference need not be exact: its stated correction radius remains explicit. The app does not measure calibration or authenticate the reference source. Independently bounded gain/reference components describe a parallelogram in zero-origin gain/offset coordinates, not an unconstrained zero-origin rectangle. The original observations and model structure remain unchanged.

Original/actual associations use the same affine declaration and both components. Separately sourced residuals remain independent. Search and public replay use the original full rows and independent refit. Complete work and numerical engineering qualifications remain those of the maintained inquiry; no rigorous QR or physical adequacy certificate is claimed.
