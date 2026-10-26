# Investigating missing scalar terms

The Studio's **Challenge the feature library → Investigate missing terms** compares
the applied scalar library with the complete maintained eleven-term library.
It uses original training readings only. It does not ask an investigator to name
the omitted term, use held-out outcomes to choose a proposal, or change the
current executable model until **Apply candidate library** is selected.

Try `examples/scalar-library-cubic.json`, an authored synthetic course. Import it
through ordinary Studio intake, investigate, inspect the original and expanded
equations and their competitive structures, then apply the proposed cubic term.
The existing residual plots, held-out comparison, dynamics and acquisition use
the revised executable law. The original observations and baseline remain in
history. Checkboxes allow a person to correct the proposed library before apply.

## Numerical contract

The comparison reuses `discover` and the existing feature definitions, keeping
the applied estimator, noise floor, ambiguity threshold and maximum term count.
It enumerates all admitted subsets in the expanded library, not merely a
residual-correlation shortlist. A proposal requires the selected expanded model
to use a new term and improve the training complexity score by more than the
applied ambiguity threshold. The complete comparison reserves at most 25 million
declared row/column work units; refusal does not return a partial ranking. The
soft-L1 comparison reserves both complete searches together against the shared
250 million optimization-work limit before either fit starts; its numerical
refusals remain intact.

The proposal exposes both training adequacy and ambiguity. A better relative
score may still leave a large residual mismatch, multiple competitive structures,
weak excitation or a wrong physical interpretation. The noise-floor score is
a heuristic, not a probability, calibrated confidence or independent accuracy
guarantee. All eleven terms may still omit the necessary mechanism. The search
does not discover arbitrary equations, hidden state or physical geometry.

## Source custody and replay

The existing command-position option remains separate. The additional optional
`cubic`, `cosine` and `rate_squared` choices are explicit `additionalTerms` in
ordinary option-revision events. A library-bearing notebook requires the v5
envelope. Original source inputs and complete options are saved; proposal output
and fitted models are never replay authority. Reopen recomputes the actual law.
Old notebooks retain their supported envelopes and semantics. A revision resets
the displayed investigation; failed investigations leave no prior proposal.

## Evidence and retained failures

Native receiving covers unfamiliar authored cubic, cosine, even-rate and
interaction courses, unchanged-law and omitted-family controls, complete budget
refusal, altered-holdout noninterference, ordinary apply/reopen/undo and later
measurement intake. These are authored software qualifications, not measured
physical-law recovery.

Independent review used a separate LCG-authored noisy 113-row course with 83
held-aside readings. Baseline→expanded RMSE was 0.028946→0.007172 for cubic,
0.382047→0.007248 for cosine, 0.382669→0.007096 for even rate and
0.431984→0.007234 for interaction. The cubic improvement was 4.04 times, rejecting
an initial tenfold-improvement expectation, and the expanded explanation
remained ambiguous. The unchanged law did not propose a revision; an omitted
sin(7u) response remained mismatched at 0.96054. Reversing the cubic sign only
in held-aside observations worsened error 2.442315→2.445341 while training still
proposed a revision. This retained failure demonstrates why a training proposal
is not a generalization claim.

Actual browser/current-source receiving and published integration are recorded
in the native issue/PR; this document alone is not evidence those steps passed.
