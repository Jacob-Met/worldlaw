# Compare zero-restoring affine responses

The retained-origin affine consumer can now compare a fitted constant-force response with no restoring spring, with or without nonnegative viscous damping. Both compensated spring coefficient components must be exactly zero; the adapter does not discard an unresolved or tiny spring. Existing successful restoring comparisons return unchanged.

For `u'' + d u' = F` and zero initial displacement, the helper evaluates `u = v0 t phi1(-dt) + F t² phi2(-dt)` and `v = v0 exp(-dt) + F t phi1(-dt)`. A bounded 30-term small-argument series preserves the zero-damping limit, and expm1 supplies the remaining bounded domain. Time is at most1000 and `dt <= 700`. Negative damping, nonfinite outputs and unsupported declarations refuse this comparison.

The finite-horizon envelope `|u| <= |v0|T + |F|T²/2`, `|v| <= |v0| + |F|T` conservatively bounds nonnegative damping without dividing by a small damping coefficient. Original coordinate/rate limits, the complete250M work gate and1024 operations per output remain. The ordinary adaptive RK4 trajectory, original local tolerances, selected discovery law and shared numerical kernel are unchanged.

The Studio labels sampled zero-restoring discrepancies and retains original-only source export/reopen. The comparison is an independent evaluation of the declared equation, not physical validation, coefficient identification or a certified global error bound. Series, coefficient and transcendental rounding remain.

Owner numerical qualification covers40 original-binary64 cases against a Decimal120 closed form (maximum absolute error3.98e-23), four split-time composition controls and five refusal controls. Native original-source tests cover constant acceleration, tiny damping, existing restoring output parity, held-aside isolation, replay and aggregate work refusal. Authored torque observations remain synthetic evidence.
