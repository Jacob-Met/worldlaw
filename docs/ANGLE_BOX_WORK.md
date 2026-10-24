# Bounded-angle polygon work

The angle-box receiver is an additive consumer on Cycle Work. It answers whether the signed work of the declared ordered polygon excludes zero after accounting for independent angular and torque boxes. It preserves the nominal calculation and does not pass uncertain angles to curvature refinement.

## Input contract

The input schema is worldlaw.cycle-angle-boxes/v1. It retains the complete existing nominal cycle, a positionRadii array in radians, a radiusSource description, and assumption independent-row-boxes-with-shared-first-last-angle. The nominal cycle retains its exact-angle declaration solely as the original nominal comparator. The outer schema explicitly overrides that interpretation for the separate bounded-angle calculation.

Centers and radii are interpreted as their exact binary64 values. Endpoints are exact center minus radius and center plus radius, constructed before any rounding. Angular centers and radii are bounded separately by the maintained center limit and a radius limit of one million radians; their endpoints may lie outside the nominal center limit. Torque bounds retain the original source radii. These are declared deterministic boxes, not confidence intervals or calibrated measurements.

All interior row angles and all row torques are independent variables. The first and last angle are one shared variable: their nominal centers and angular radii must match. Their torque readings remain independent. Interior repeated nominal angles are separate variables and do not assert exact zero-angle jumps. Boxes may permit a different sign of angular travel from the nominal segment. Arbitrary correlations or monotonicity constraints are unsupported.

## Exact finite-polygon extrema

For each segment, twice the work is (theta[next]-theta[current])*(torque[next]+torque[current]). The complete work is multi-affine in the bounded variables, including the shared return-angle variable, so extrema occur at endpoint assignments.

Each row has four angle/torque endpoint states. A dynamic program retains minimum and maximum accumulated work per state for each of four fixed initial states. Final states must share the initial angle endpoint. All sixteen edge costs are evaluated once per adjacent row; the four initial-state courses retain shared readings instead of independently bounding segments. Predecessors reconstruct the extreme assignments.

Inputs are decoded into exact integer coefficients on common dyadic grids for angle and torque. Edge products, path sums, comparisons and separate integration-allowance expansion use BigInt. There is no floating-point sign test. Display strings are approximate and do not decide conclusions.

Witness corner flags are angle-upper*2 + torque-upper. evaluateAngleBoxWitness reconstructs exact endpoints from the raw inputs and flags; no displayed decimal is parsed. angleBoxWitnessRow exposes exact integer/power-of-two endpoint values for an original row. Each result also internally reevaluates both witnesses. Witnesses are mathematical assignments, not acquired data.

## Receiving limits and evidence

The full maintained 3–4096-row range is retained. The algorithm reserves sixteen edge evaluations and at most64 predecessor transitions per segment; predecessor storage is linear. A local4096-row stress course mixing Number.MIN_VALUE with maximum admitted centers/radii completed in approximately102–130ms. That is local qualification, not a universal browser timing guarantee. Both exact witnesses were retained and reevaluated. Import is capped at2MB of UTF-8; export retains only normalized inputs.

An authored three-row control has central positions0,1,0 and torques0,2,4. The uncertain middle torque cancels exactly even with radius1e12. Angular radii1/8 produce work[-2.5,-1.5]J; radii1/2 produce[-4,0]J. A separate control preserves independent repeated interior angles.

The result describes the ordered polygon and its declared boxes. The original integration allowance expands the interval separately and does not change witness polygon values. Shared return angle does not establish hidden-state closure. No claim of continuous-path work, physical dissipation, calibrated sensor uncertainty or conservativity follows automatically.

Tests include exact endpoint construction below a center's ulp, zero-angular-radius reduction, witness replay, closure mismatch, independent repeated rows, order reversal, allowance separation, input-only replay, resource admission and maximum mixed-exponent rows. The browser receiver exercises real download/reopen, input mutation, stale-file completion, keyboard witness inspection and narrow layout.
