# Bounded continuous relaxation comparison

The Unknown Lab section **Between the grid points** addresses a specific finite
model limitation. A single-exponential response at tau 1.5 s can contradict all
seven offered grid values even though an intermediate parameter explains it.
The maintained finite-grid result stays visible; this additional screen does not
silently replace it or imply that missing grid points establish missing physics.

## Numerical contract

Training uses the existing matched-state validation and counterbalanced contrast
intervals. At least three distinct training durations and four pairs per order
are still required. For `a (1 - exp(-t/tau))`, the user declares positive tau bounds,
subdivision resolution and a box-evaluation budget. Coupling remains bounded at
−100 to 100 N·m. Zero duration is handled explicitly. Positive durations below
1e-8 s are refused rather than entering unstable division.

For a tau interval, the response factor is monotone in tau. Endpoint quotients
of each observed contrast interval give a conservative amplitude enclosure.
Intersecting these enclosures across all training runs can reject a box. Retained
boxes are subdivided until the requested tau resolution or work limit is reached.
Their bounds are inflated for numerical roundoff by a relative/absolute 1e-12
factor. This is a numerical screen, not a formally certified interval-arithmetic
proof or a calibrated statistical confidence region.

A retained rectangle is only **possible**: its coordinates need not correspond
to any one parameter pair satisfying every observation. A separately evaluated
witness fixes one midpoint tau and one amplitude, then directly checks every
training contrast interval. Only those checked pairs are called witnesses. If
none is found, possible boxes remain possible; they are not silently fitted or
rejected. Budget exhaustion retains unvisited child domains with their parent's
conservative amplitude enclosure. No region disappears merely because work ran
out. A coherent zero-amplitude witness leaves the entire offered tau domain
unidentified, so subdivision is deliberately skipped.

Future prediction intervals propagate the frozen training boxes. Their union,
not just its displayed overall span, determines individual overlap. Overlap with
an outer envelope is not proof of compatibility. A separate joint numerical
screen searches the original training domains against all qualified challenge
intervals at once. A coherent witness must satisfy one shared parameter pair
across training and every qualified challenge. Known qualified contradiction
survives missing order qualification. Budget exhaustion leaves domain resolution incomplete. A checked coherent
witness can still establish existence within that incomplete search. Challenge results never alter the original training boxes, witnesses
or prediction intervals. Training and joint searches have separate bounded work
counters using the declared per-screen limit.

## Actual consumer

The new panel reads the same duration study used by the finite comparison. It
shows finite-baseline outcome, possible boxes, actual witness counts and separate
challenge results. The plot zooms to retained domains and distinguishes numerical
boxes from checked points. Long outputs retain complete counts and input-based
recomputation; the table shows the first 16 entries and the plot explicitly
reports any display subsampling.

Controls execute off-grid, zero, high-noise and sign-changing virtual examples.
They reuse the existing paired-history generator for visible states, reading
noise and balanced chronology at zero memory, then add an independently declared
duration-response contrast. The original zero-memory simulation metadata is
removed because it would misdescribe the amended samples. Their source note
states the alternate oracle, tau, coupling, seed and noise. Exported study inputs
retain actual readings; no physical acquisition or authenticated custody is
claimed. The off-grid series uses distinct training and challenge seeds.

Input-based continuous comparison export preserves settings and observations.
Open validates and recomputes before replacement, ignores fabricated derived
verdicts and fences stale asynchronous reads. Changing study inputs or numerical
settings revokes export until recomputation. Saved comparisons must retain all four explicit finite numerical settings; omitted or null fields cannot silently use fresh-call defaults. Existing notebook formats and the
finite duration/acquisition panels remain available.

## Evidence at local freeze

Thirteen new independent analytic tests pass on Node24 with explicit test isolation
disabled. Controls include off-grid positive and negative response, bounded noisy
readings, zero identification refusal, sign/zero-duration contradictions, coarse
outer-only cases, one-box budget exhaustion, challenge-invariant training and
predictions, no per-challenge parameter switching, qualified contradiction beside
unqualified evidence, invalid settings and input-based roundtrip.

The actual off-grid virtual control produces finite `none-compatible`, 17 possible
outer boxes, 14 checked training witnesses after 69 evaluations, and a coherent
joint challenge witness. Zero response retains the full tau range with one box
and a zero-amplitude witness. The sign-changing control excludes all boxes after
one evaluation. These are bounded synthetic results, not whole-family physical
identification or calibrated uncertainty.

`node scripts/unknown-continuous-browser.mjs` supplies an actual consumer course
for off-grid comparison, changed challenge invariance, import/export, budget
exhaustion, zero/contradictory controls and 1440/390/320 px focus/layout. It has not
yet been run at this local freeze; remote browser receiving is required before
integration. Use the existing `BROWSER_EXECUTABLE_PATH` and
`BROWSER_ARTIFACT_DIR` environment variables.
