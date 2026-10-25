# Quadratic response in both directions

The optional known-inertia Window fit adds `rate_squared`, the even feature
ω², alongside the existing odd feature ω|ω|. Its coefficient has units
N·m·s²/rad². This permits unequal quadratic responses for positive and
negative motion without replacing the original library. No dissipative sign
constraint or physical drag interpretation is imposed.

With odd coefficient a and even coefficient b, the quadratic torque is
`(a+b) ω²` for positive velocity and `(-a+b) ω²` for negative velocity.
Observations confined to one velocity sign cannot identify a and b separately.
The maintained normalized QR retains that rank failure. The column uses the
existing local cubic rate estimator and compact-window integration; supplied
initial rates remain reserved for forward prediction.

The explicit `directionalQuadraticLoss` input option is admitted only for
known-inertia weak fitting. The original default library and maximum terms per
candidate remain unchanged. Opted-in source notebooks use v3, which older
readers refuse. Both new options can coexist. Ordinary notebooks remain v1;
command-position-only notebooks remain v2.

The existing integral estimator and three-coefficient rate-power checker
explicitly refuse the new feature. Their refusal is not a physical finding,
and the UI must retain it rather than imply that a familiar certificate applies
to this expanded law. No conditional-rate-fit algorithm is changed.

## Independent analytic control

Two training courses solve `v' = -k v²`, with positive initial rate 1.8 and
k 0.37, and negative initial rate −2.1 and k −0.13. Exact positions are
`theta0 + log1p(k*v0*t)/k`. No maintained rollout generates those observations.
The learned odd/even coefficients are approximately −0.2499999802 and
−0.1199999903, compared with authored −0.25 and−0.12.

Separate starts 1.1 and −1.3 rad/s produce forecast RMSE 6.41e−8 and 6.07e−8 rad.
An odd-only model retains errors 0.5792 and 0.2309 rad. In the actual consumer's
full original library with at most two selected terms, the negative-course
baseline is 0.184111 rad versus 6.07e−8 with the expanded family. These are
authored numerical controls, not physical data or blind validation.

`node tests/weak-directional-loss.test.mjs` also checks one-direction
nonidentifiability, source-only v3 reopening, legacy checker refusal,
initial-rate noninterference and held-out position noninterference.
`scripts/weak-directional-fixture.mjs` regenerates browser receiving inputs;
`scripts/weak-directional-browser.mjs` exercises the visible opt-in and
export/reopen at desktop and narrow widths. The executed receiving course is recorded below.

Independent review found and repaired an actual shared-consumer defect before
integration: the input-enclosure path originally treated the newly executable
term as position. It now uses outward squared-rate bounds with a zero-crossing
minimum, including the joint-position-refinement path. The reviewer checked
20,280 direct predictions across 120 configurations without an escaped value
or false nominal exclusion. This is numerical testing, not formal proof of
all floating-point behavior. Seven dedicated groups pass after that repair;
the omitted cubic-rate analytic control remains a training mismatch with
separate forecast error. A source-only virtual-plan replay with both explicit
expansions enabled also passed through v3.


## Actual consumer receiving

The lead executed the maintained Studio browser course in normally sandboxed
Chrome 156 with Node 22.23.4. At both 1440 and 390 pixels, enabling the option
changed displayed separate-course position RMSE from 0.1841 rad to 6.07e−8 rad.
Keyboard toggling, source-only export and reopening, and hiding the option for
the unsupported integral method passed with no page exceptions. The harness
reopens the actual exported Blob; it does not establish completion of the
browser's native download workflow.

The control and help text were fully inside the settled viewport, the checkbox
retained keyboard focus, and document scroll width equaled viewport width.
The lead visually inspected both viewport images and found the label, help,
and focus indicator legible. See the [desktop image](receipts/directional-quadratic-1d6c/desktop.png),
[narrow image](receipts/directional-quadratic-1d6c/narrow.png), and
[machine-readable receiving record](receipts/directional-quadratic-1d6c/browser.json).

The first complete remote focused run passed 57/57 tests with no failures or
skips in 2759.310212 ms. It covered the directional feature, existing forced
and command-position weak fitting, torque discovery, integral trajectories,
and angular weak fitting. This is a focused regression run, not the entire
repository suite. Analytic trajectories are authored software controls, not
field measurements, physical drag identification, or blind validation.

Before publication, incoming periodic-phase support on main
`8a3f35d3a2d906beae61762ecb0383c61efbbc3b` was composed into the shared torque,
input-enclosure, integral, weak-operator and application files. Both optional
cosine and squared-rate terms remain supported by their respective consumers;
the changed angular/reference runtime dependencies are retained. A direct
local periodic-phase run passed all five cases after composition.


The final composed remote run passed **62/62 tests**, with zero failures or
skips, in **2916.300894 ms** on Node 22.23.4. It includes the prior six focused
files plus the five incoming periodic-phase cases. The full browser course
and precise control screenshots were rerun against this composition at both
widths: all controls, reopening, predictions, focus, and overflow checks passed
again, with no page exceptions. The lead inspected the refreshed screenshots.
The earlier 57-test result remains historical evidence for its earlier source
boundary; the 62-test result qualifies this composed candidate.

A separate local composition check exercised cosine, even squared rate, and
odd quadratic rate together in the maintained bounded-input consumer. Across
18 position/rate/refinement configurations and 441 direct predictions per
configuration, all **7,938 predictions** remained enclosed and no nominal
point was falsely excluded. This is an independently constructed numerical
control for the combined features, not a formal proof or physical evidence.
