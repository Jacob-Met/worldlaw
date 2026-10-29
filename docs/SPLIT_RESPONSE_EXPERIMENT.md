# Explicit split-response comparison

The existing Studio response comparison offers two explicit numerical representations. The default remains a training origin plus increment. The split-coefficient option uses bounded scale continuation for the same inspected terms and final declared soft-L1 scale. Neither option replaces the selected law, changes hypothesis ranking, or supplies an automatic fallback for ordinary discovery.

## Mechanism and receiving

The experimental solver retains each coefficient as a high/low pair. Product decomposition and compensated residual accumulation preserve increments that can disappear when coefficients or predictions are collapsed into one binary64 number. A bounded sequence of larger soft-L1 scales supplies initial iterates, then the requested final scale is solved. A result is converged only after its normalized gradient at that original final scale meets the maintained tolerance. This is a numerical stopping condition, not an interval certificate or physical validation.

The isolated native solver copy exposes its last coefficients on unresolved iteration/line-search outcomes without changing their failure statuses. The continuation wrapper independently checks the final residual gradient; intermediate failures are never relabeled as successful final fits. The ordinary maintained v1 optimizer remains unchanged.

Before initial QR or optimization, the shared-iteration wrapper reserves initial QR, bounded scale calls, at most 64 total native optimizer iterations, and explicit compensated residual and final-gradient work. The reservation cannot exceed the maintained 250-million work limit. Intermediate scales receive one correction of at most four iterations; the final scale receives at most three corrections, each capped at 32 iterations within the same total budget. Exhaustion is never success unless the original-scale gradient independently passes. Low declared work limits refuse without a model. A 4096-row aliased small-origin native control fits inside the smaller reservation and correctly refuses for rank deficiency. The browser large-origin 4096-row source requires more scale stages and still refuses the complete work cap.

The actual existing prediction, evaluation, prepared predictor, and RK4 consumers recognize only the explicit experimental schema. Evaluation reports stable and rounded residuals separately. Prepared predictors snapshot the coefficient pairs. RK4 receives ordinary rounded torque values; the representation does not grant higher-precision dynamics. Other derivative/model-family consumers have not been qualified for this schema.

## Original source transfer

`worldlaw.split-torque-source/v1` retains exactly normalized original training/challenge rows, fixed term IDs, and scale. Reopening recomputes; supplied results/models are refused. This source does not replace parent notebook/acquisition identity. Unsupported training weights, sparse inputs, invalid coordinates, excessive source size, and excessive work refuse explicitly.

The Studio method or scale controls retire accepted output and downloads. A pending file read cannot restore results after a later method/scale edit or file replacement. Native source reopening restores its declared method and original inputs while preserving the selected workbench hypothesis.

## Qualification

Fresh controls cover 60 unfamiliar authored cases and 98 maintained-feature subsets, with independent 70-digit Decimal gradient checks. In the latter course ordinary fitting converged on 9 subsets and continuation on 98; this is a numerical authored course, not a statistical or physical accuracy claim. Independent transformed-case checks cover row order, signed feature scaling, and work refusal.

Actual nonlinear-feature receiving evaluates held-aside angles without fitting them. Prepared prediction and actual RK4 controls preserve ordinary rounded-output behavior, including a case with stable residual -1e-13 but rounded residual zero. Existing centered-response controls remain passing.

Sandboxed browser receiving covers both default centered and explicit split modes, actual original-source download and native reopen, selected-law isolation, stale pending reads, malformed replacement, scale invalidation, and complete-work refusal. The narrow selector overflow found during receiving was repaired. Native and browser receipts must remain bound to their exact candidate hashes; this candidate has not been published or merged merely because local receiving passed.
