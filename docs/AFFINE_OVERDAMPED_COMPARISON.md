# Separated overdamped affine comparison

The retained-origin Studio comparison extends the qualified undamped and underdamped paths to separated stable real roots. Prior successful comparison results are returned unchanged. The shared adaptive dynamics kernel and local tolerances remain untouched.

For u''+d u'+w²u=F, a=d/2 and g=sqrt(a²−w²). This experiment requires positive w²,d,g and g/a>=1e-4; critical or nearly repeated real roots are explicitly unavailable. Compute the slow root as−w²/(a+g), avoiding subtraction of nearly equal values. The impulse response uses exp(slow*t)*−expm1((fast−slow)*t)/(slow−fast). Its integral supplies the constant-force displacement. At max(w,d)t<.125, the bounded30-step direct recurrence retains small displacement and velocity without subtracting exponentials.

The finite stable-system envelopes used for source admission are |u|<=|F|/w²+|v0|/d and |v|<=|F|/d+|v0|. They follow from the positive overdamped impulse response, its integral1/w², maximum at most1/d, and unit-bounded homogeneous velocity response. The existing1024/output complete work allowance covers the recurrence; original coefficient mapping and source fitting remain unchanged. Nonfinite output refuses.

Research preserves a concrete failure: a direct exponential difference lost essentially all tiny initial-velocity displacement. Across36 original-binary64 courses, the recurrence/expm1 correction reduces maximum relative displacement discrepancy against Decimal90 direct exponentials from approximately1 to2.444e-15. These are authored equations and numerical comparisons, not certified error bounds or physical validation.

Original-source tests cover refitting/reopen, held-aside isolation, work refusal, undamped/underdamped exact-result parity and unsupported/overflow controls. The first overflow test fixture actually remained finite and correctly did not throw; that failed test is retained, then replaced by a demonstrably overflowing long-time small-stiffness case. Actual Studio receives a refitted overdamped source, renders and reopens its full comparison while preserving selected-law authority. The390px render was inspected.
