# Exact fitting-support ambiguity

The Coupling Lab inspector constructs distinct declared affine response hypotheses when the maintained fitter refuses an offered family for insufficient excitation. It does not fit those refused families, search a bounded feasible coefficient set, select a new structure, or modify acquisition planning.

On the maintained collinear course, all32 fitting coordinates satisfy q1=q2. An executable independent response can be extended by reciprocal or directional coefficients that yield exactly the same response at those coordinates. The inspector shows their admitted coefficients and contrasts at the original permitted coordinates. Its normal is dimensionless with maximum absolute component1; the supplied illustrative coefficient amplitude is in N·m/rad. It is neither an inferred parameter nor a physical bound.

For fitting support n·q=c, the attempted extension is ΔK=a v nᵀ and Δb=−a v c. The reciprocal construction uses v=n only when the base matrix is symmetric; the directional construction uses an axis vector chosen to create unequal off-diagonal terms. Both must pass the maintained executable model admission. Every ACTUAL materialized coefficient and bias is then converted by the maintained exact binary64-to-dyadic primitive and evaluated on every retained fitting coordinate. A symbolic construction is insufficient: rounding can break equality. Such constructions are explicitly refused. Floating rank refusal likewise does not establish exact collinearity.

The exact polynomial responses use the actual stored binary64 coefficients as exact inputs. Ordinary executable floating evaluation can differ by a last bit because operation order differs; it is not the equality certificate. Exact torque contrasts are retained as integer×2^exponent values. No noise threshold, detectability or confidence claim follows from a nonzero contrast.

Only initial training and separately acquired fitting revisions construct witnesses. Separate checks remain retained but unused. A new off-support coordinate can remove the exhibited direction; this is narrower than global identification. The unchanged acquisition controls own acquisition provenance and refitting.

The256 complete fitting-row cap refuses larger questions without trimming. Single-coordinate support, no executable base, no maintained rank refusal, absent exact line certificate, and failed coefficient materialization publish no witness. The bounded generator is deliberately incomplete: failure to construct a witness does not prove identification.

Save/reopen retains only the original notebook and explicit amplitude/units. Derived coefficients, support certificates and result claims are recomputed. Edits, committed notebook replacement and new acquisitions invalidate prior results; asynchronous saved-question reads cannot overwrite a later source. Loading a saved question is independent of the main notebook and is labeled as such.

Native receiving: `node tests/excitation-witness.test.mjs`. Browser receiving is integrated behind `WORLDLAW_EXCITATION_RECEIVING=1` in the maintained Coupling Lab course, including desktop/390px, actual save/reopen, late-import invalidation, and actual off-support acquisition.
