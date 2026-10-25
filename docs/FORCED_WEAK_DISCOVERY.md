# Compact-window torque discovery

Trajectory Challenge offers **weak** fitting for known-inertia scalar recordings alongside the existing integral and derivative estimators. The same source recordings and separate forward challenge are retained. The default remains integral fitting.

For each bounded time window, the estimator multiplies the equation `I θ'' = Σ c_j f_j` by `φ(x)=x²(1−x)²`. Both the test function and its first derivative vanish at the endpoints. Integration by parts therefore eliminates the supplied initial angular rate from fitting. Forward simulation still uses each challenge recording's supplied starting rate.

The implementation shares the maintained angular weak-window operator. Position is represented piecewise linearly; nonlinear features use piecewise-linear quadrature. The command channel uses the existing left-sample zero-order-hold convention. Linear damping integrates the position slope against the test function without pointwise rate estimation. Coulomb and quadratic terms require the maintained local cubic rate estimate. The optional command-position interaction is not admitted by this estimator.

Rows are divided by their position-target noise gain. Feature columns additionally divide by the declared inertia of their original run, so one physical coefficient vector can be fitted across different declared inertias. Residuals remain in radians. The maintained column-normalized QR fits every admitted subset; zero, failed-rank and unexecutable candidates retain their existing roles in diagnostics. Challenge values do not enter coefficient estimation or ranking.

The window settings bound duration to 0.02–60 seconds and stride to 0.01 seconds through the duration. Every window requires at least nine samples; complete analysis requires 8–2048 windows. Source admission requires explicit units, positive inertia, increasing clocks and bounded recordings. Inputs are never silently thinned to satisfy the limits.

## Interpretation

A small weak residual is not a successful forward prediction. Overlapping windows, noise in regressors, uncertain inertia, command alignment and nonlinear quadrature can bias coefficients. Row normalization is not a full covariance treatment, and scores are not calibrated probabilities. Compare separately supplied challenge trajectories and inspect sampling sensitivity. Changing window settings after inspecting a challenge is exploratory reuse.

The authored native controls exercise constant acceleration on uniform/irregular clocks, different inertias sharing one command gain, starting-rate invariance, switched held commands, missing excitation and malformed evidence. These are numerical software controls, not measured physical identification. Actual browser receiving and integration receipts belong to the associated pull request.
