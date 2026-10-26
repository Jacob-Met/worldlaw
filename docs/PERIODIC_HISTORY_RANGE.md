# Bounding a preparation offset without identifying one parameter vector

After the complete-pair check, **How much preparation offset remains possible?**
uses the same original observations, fixed-period sensor components, drift bound,
pair-discrepancy radius and preparation-offset prior. It shows how much of that
prior remains compatible, rather than treating one feasible vector as an estimate.

The result distinguishes a witness-supported **inner interval**, a conservative
numerical **outer bracket**, and the original **declared prior**. A boundary that
reaches a compatible prior edge is explicitly prior-limited. Neither interval is
a confidence interval or evidence of a physical preparation cause. All source,
matching, error-bound and fixed common-sensor qualifications from
[the complete-pair model](PERIODIC_COURSE.md) remain in force.

## Why these bounds are meaningful

For the existing fixed finite periods, predictions are linear in the shared
history offset, linear drift and sine/cosine coefficients. The admissible
parameter set is the intersection of the history/drift intervals, one amplitude
disk per periodic component, and every original pair-discrepancy strip. This set
is convex; its projection onto the history offset is an interval, possibly empty.

The maintained course checker first searches for a compatible parameter vector.
Each subsequent query fixes only the history offset in the **model context**.
Original observations are never shifted, replaced or refitted into another
notebook. The fixed coefficient contributes signed `h * sum(weights)` to a
separator's support. Every fixed-context certificate is independently checked
against the original endpoint readings and its declared context.

Suppose an offset `h0` has a compatible witness, and a lower fixed offset `h1`
has a checked numerical separator. Any compatible offset below `h1`, together
with the witness at `h0`, would yield a compatible point at `h1` by convexity.
That contradicts the separator. The same argument applies above `h0`.
Bisection therefore retains both compatible endpoint witnesses and excluded
outer offsets. Convex combinations of the endpoint vectors support the inner
interval; numerical exclusions and the prior support the outer bracket.

This proof **does not apply to a generally nonconvex union of model alternatives
or to unknown frequencies moving within continuous bands**. The range contract
accepts only the existing fixed-period components that may coexist. The
prospective continuous-band investigation remains a different capability; its
results are not silently treated as this convex parameter family.

## Preserved refusal and work semantics

If the whole course has a checked contradiction, no offset interval is invented.
If no compatible point is established, the result remains unresolved and retains
only the declared prior. A failed search is not an exclusion. Numerical contact,
zero-radius boundaries, exhausted fixed queries and exhausted global search work
remain visible with the bounds already established.

The input declares desired bracket width in N·m, at most 64 fixed-offset queries,
and a global estimated iterative matrix-term budget. The budget includes the
initial search and every subsequent fixed-offset search. Each also respects the
parent course's per-query iteration and matrix-term limits. Input admission,
bounded QR/rank diagnostics and final raw-source checking are separate bounded
work; no claim is made that the matrix count measures total CPU operations.

The arithmetic screen remains an engineering numerical qualification, not
certified interval arithmetic or calibrated coverage. Ordinary complete-course
v1 calls and certificate source keys remain unchanged. New named fixed-history
APIs bind their additional context explicitly; old ordinary certificates cannot
be silently reinterpreted as fixed-offset proofs.

## Consumer and replay

The range instrument consumes the complete-pair inspector's retained source
snapshot. Changing any parent observation or bound retires dependent results.
The chart confronts the declared prior, outer bracket and witnessed inner
interval on one offset axis, with zero explicitly marked. Named endpoint
parameters identify the history coefficient, drift units, phase origin and each
periodic sine/cosine coefficient. These are constructed witnesses, not uniquely
identified physical parameters. Every query's outcome and work remain inspectable.

Saving writes only original source inputs and range settings under
`worldlaw.periodic-history-range/v1`. Reopening recomputes the range and labels it
as an independent snapshot without replacing parent inspectors. Changing only
range work settings recomputes that same reopened source; a parent observation
or declaration change retires it. Late file reads
cannot overwrite a newer source or setting change.

Try [the authored shuffled-order input](../examples/periodic-history-range-shuffled.json)
with **Reopen range inputs**. It contains source rows and assumptions, not cached
interval endpoints. The exact synthetic control has history offset 0.25 N·m,
linear drift 0.04 N·m/step and period-four sensor amplitude 0.3 N·m. Under the
declared 0.01 N·m pair-discrepancy bound, this particular shuffled course brackets
the analytic history interval [0.24, 0.26] N·m. The corresponding alternating
course remains broadly aliased: its lower edge is
`0.55 - 0.3*sqrt(2) - 0.01`, and its upper edge reaches the offered 0.8 N·m prior.
This demonstrates schedule-dependent identifiability in an authored model, not
a guarantee that shuffling any real experiment identifies a preparation effect.

## Verification boundary

`node --test tests/periodic-history-range.test.mjs` checks analytic alternating
and shuffled controls, independent fixed-context certificate checks, convex
midpoint witness construction, changed-source/context refusal, source replay,
incompatible-course handling, query/global-budget exhaustion, and refusal of
unsupported band declarations. The inherited complete-course groups remain
unchanged. Independent review also checked a negative-offset analytic control:
observed difference −0.25 N·m and radius 0.01 N·m produce a bracket containing
[−0.26, −0.24] N·m, including a negative signed fixed-term support value.

`scripts/periodic-history-range-browser.mjs` is the actual consumer receiving
course. It reuses the maintained same-browser sandbox admission helper, then
checks original intake through both parent instruments, keyboard operation,
named witnesses, raw download/reopen, source invalidation, prior-limited and empty
outcomes, budget exhaustion, nonconvex-family refusal and desktop/390px layouts.
Exact source and executed browser receipts belong to the integration PR; authored
scripts alone do not establish browser acceptance or physical validation.
