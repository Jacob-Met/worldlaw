# Choose a whole release course against the skew alternative

The Coupling Lab can compare every permitted zero-rate release under all three
training-fitted velocity laws. This is an explicit question beside the existing
diagonal-versus-symmetric loss release comparison. Its schema and results remain
available unchanged.

Load the response notebook and original velocity study, then open **Which
permitted release could separate the skew alternative from both loss-only
fits?** Declare their apparatus/coordinate correspondence and compare the entire
permitted set. No measured coefficient, permitted state or source relationship
is supplied by the planner.

## The question being computed

For every retained response law, simulate three complete courses from the same
permitted angle pair and zero initial rates. The fitted alternatives may have
different M and D as well as G. Compare the skew alternative separately with
each loss-only alternative using Euclidean angle separation at the common output
times. Find each pair's sampled peak. The release score is the smallest of all
those pairwise peaks across every response law and both alternatives.

Thus the question concerns a **whole sampled observation course**. Different
pairs can peak at different times. This is not a guarantee that any one reading
time separates all alternatives, a continuous-time peak bound, or a unique
diagnosis of G. All pair curves, peak times, extrapolation statuses and failures
remain inspectable.

The largest complete score ranks first. The declared tie tolerance retains
near-equal releases in their existing permitted order. A proposed release must
also strictly exceed the declared minimum separation. These settings are
numerical comparison choices, not estimated sensor uncertainty. An equal-to-
threshold score does not qualify.

## Source and numerical accounting

`worldlaw.velocity-release-study/v1` contains only `schema`, `response`,
`velocity` and `settings`. The response and velocity fields retain their original
notebooks, including separately supplied observations. Reopening recomputes from
these inputs; it neither trusts saved scores nor replaces the active workspace.

Response discovery uses the original training/revision observations. The
maintained three-family weak comparison is called with its challenge removed.
Separate response and motion observations never fit coefficients, remove an
alternative, choose settings or rank releases. All three admitted fitted
velocity families and at least one executable response are required. Unsupported
training stays visible; it cannot become a smaller, easier comparison.

All family parameters and permitted positions are admitted before the complete
release × three velocity laws × response laws × two step-size computation is
reserved against the existing 120,000-step limit. The existing simultaneous RK4
solver is reused. No extra integrator or fitter is introduced. Each release is
processed separately so full trajectories from all releases need not remain in
memory. Curves and compact failures are retained. Any refused response prevents
a complete score; failed or step-sensitive paths cannot win. The same original
two-family consumer reuses the common pair-reporting and stable-ranking helpers.

Two step sizes agreeing is not an error bound. The fitted response family may
already have training mismatch, and simulated paths may leave its observed
position range. Neither permission to observe a quasi-static position nor the
software proposal establishes dynamic reachability, safety or observability.

## Explicit adoption

Inspect any retained release and choose its velocity family explicitly. Copying
requires the full current response and velocity sources to match those used by
the proposal. Source/settings changes retire results, and late file reads cannot
revive them. An owned reopened study can be inspected without replacing either
current source; it cannot be copied until both match.

Copying fills the selected state and fitted parameters in the ordinary motion
experiment and clears its declaration. The investigator must review that
declaration and run the same retained response families. Copying the skew family
uses v4. Copying a loss-only family removes G and its unit, restoring the
corresponding v2/v3 input contract. No family is automatically adopted or acted on.

## Reproducible authored control

```js
import {createCouplingCourse} from '../src/coupling/virtual-instrument.mjs';
import {createVelocityExample} from '../src/coupling/velocity-example.mjs';
import {defaultReleaseSettings} from '../src/coupling/viscous-release.mjs';
import {VELOCITY_RELEASE_SCHEMA,proposeVelocityReleases,
  exportVelocityReleaseStudy} from '../src/coupling/velocity-release.mjs';

const source = {
  schema: VELOCITY_RELEASE_SCHEMA,
  response: createCouplingCourse('reciprocal'),
  velocity: createVelocityExample('two-frequency'),
  settings: {...defaultReleaseSettings(), duration: 4, samples: 121, maxStep: .02}
};
const result = proposeVelocityReleases(source);
const originalInputs = exportVelocityReleaseStudy(source);
```

This original authored control reserves 58,320 steps for 81 trajectories: nine
positions, three response laws and three velocity families. Position `[-1,1]`
scores approximately 0.29854522987224424 rad; `[0,0]` scores approximately
0.00684003383934774 rad. These are conditional simulated separations, not new
observations or evidence of a physical skew mechanism.

Independent dense-inertia/damping affine matrix-exponential controls include
both signs of G and a nonsymmetric response law. Maximum sampled separation
differences are below 4e-12 rad for the specified native controls. Matched M,D
with zero G gives exact zero separation against the symmetric baseline. Different
M,D can still separate when G is zero; that negative control preserves the
whole-explanation interpretation.

## Receiving the maintained path

```sh
node --test tests/velocity-release.test.mjs tests/viscous-release.test.mjs
BROWSER_EXECUTABLE_PATH=/path/to/sandboxed-chromium \
  BROWSER_ARTIFACT_DIR=/tmp/velocity-release-receiving \
  node scripts/coupling-velocity-browser.mjs
```

The browser wrapper first exercises the velocity comparison, then the new
release receiver. It requires an isolated browser to report positive live
sandbox admission. It tests real source files and downloads, all three explicit
copy choices, fresh source-only reopening, stale reads, failure/work refusals,
and desktop/phone layouts. No sandbox-disabling fallback is provided.
