# Undamped affine analytic comparison

The explicit retained-origin execution panel adds a bounded comparison when the fitted response has negative spring and an exactly zero rate coefficient. It preserves the maintained RK4 result and all local tolerances. It does not change the selected law or the shared adaptive evaluator.

For displacement u from the original position, write u'' + w²u = F, with u(0)=0 and u'(0)=v. Compensated coefficient products retain F when the absolute spring and bias nearly cancel. Each requested time is evaluated independently as

u(t) = (F/w²) 2 sin²(wt/2) + (v/w) sin(wt),
u'(t) = (F/w) sin(wt) + v cos(wt).

This avoids subtracting nearly equal cosines and avoids accumulated stepping phase error. Coefficient division, frequency rounding, phase multiplication and transcendental evaluation remain binary64 calculations. This is not a certified enclosure or global-error guarantee. The displayed maximum differences are discrepancies between methods at stored times only, and do not validate the inferred physical law.

The comparison refuses nonzero damping, unsupported terms, nonnegative spring, phase above one million radians, or a conservative original-coordinate envelope outside existing one-million state bounds. At most10001 samples are compared. Source admission reserves128 additional scalar work units per output before fitting, within the existing250million complete-course gate. Unsupported comparisons do not erase a valid native execution; their reason is displayed explicitly.

Qualification: nine unfamiliar authored oscillator courses (frequencies137/521/1031rad/s, durations.13/.53/1.03s) reduce final-rate error by at least100000 relative to maintained RK4. Constant forcing and initial velocity have a separate analytic control. Sign, damping, inertia and phase negatives refuse. Three retained source/envelope test files pass. Actual maintained Studio passes seven groups including original source replay, invalid replacement, full work refusal and parent retirement; desktop and390px output inspected. The1024rad/s fitted-source course shows sampled rate discrepancy2.0305801342233937e-10rad/s. No field acquisition or uncertainty calibration is claimed.
