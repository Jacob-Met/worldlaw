# Two original affine calibration references

Two zero-centered correction intervals may be retained together in an affine group. Declare the existing first reference fields, then secondReferenceReadout, secondReferenceBasis and sameTwoReferenceCorrection:true. Both radii are torque quantities: radius/basis describe correction at the first reference; offsetRadius/offsetBasis describe correction at the second. They do not describe fractional gain in this mode.

At readout y, correction is (upper-y)/(upper-lower) times the first correction plus (y-lower)/(upper-lower) times the second. This same pair applies to all original readings and explicitly associated actual readings. Outside the reference interval the weights extrapolate, possibly with opposite signs; absolute weights determine preparation bounds. Original readings are never shifted or replaced.

References must be finite, ordered and bounded in magnitude by1e6. Correction bounds must be nonnegative and their sum plus a conservative arithmetic allowance must be smaller than the reference separation, preserving a strictly positive affine factor throughout the box. This restriction can refuse near-boundary sources. Separate original residuals remain separately declared and charged.

The authored central readout1.04±.001 can be explained using reference0 alone or reference2 alone with gain±.1, but not using both reference corrections±.001: their midpoint correction cannot exceed.001. Widening both corrections±.05 restores a publicly checked witness. This is a conditional linear calibration family, not evidence that supplied standards are accurate or physically independent. Existing QR/engineering-arithmetic qualifications remain.
