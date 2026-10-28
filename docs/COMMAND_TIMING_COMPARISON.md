# Compare competing command-response predictions

The command-timing instrument can show how its training-competitive explanations predict motion on the **same original separate recording**. This helps you see where plausible timing explanations agree or diverge without changing recorded angles, timestamps, fitted models, or training ranking.

## Show the comparison

1. Load a known-inertia recording bundle, or use one of the instrument's controlled oscillator examples. The examples are synthetic demonstrations.
2. Declare the pre-recording command and the offered delays. To compare gradual response as well, include positive response times alongside zero. Run the comparison.
3. In **Command and motion**, choose the **Separate recording** and enable **Show competing predictions**.
4. Inspect the blue prediction span alongside the original recorded motion, the inspected prediction, and the reference prediction. Change the inspected candidate or recording to examine the same retained study from another view.

The caption reports how many training-competitive alternatives were retained, how many have complete predictions on this recording, and how many are unavailable. Unavailable alternatives remain listed with their identities and reasons. In a joint delay/response study, each identity contains both the delay and response time.

The comparison control is hidden in **Whole delay comparison**. Returning to **Command and motion** restores your display choice. Turning the overlay off changes only the display. Saving timing inputs retains the source notebook and study settings; reopening recomputes predictions. The overlay choice is not part of the saved scientific inputs.

## What the span means

At each original timestamp, the lower and upper edges are the smallest and largest predicted angles among the **available complete forecasts** selected by the existing training-only heuristic. In a joint study, membership uses exact delay/response pairs. Separate-recording errors do not choose the family. The caption’s maximum sampled spread is the largest upper-minus-lower prediction difference at an original recording timestamp; it is not a continuous-time bound or an error estimate.

A candidate contributes its entire forecast for the selected recording or none of it. Missing rows, changed timestamps, nonfinite predictions, and failed execution are reported as unavailable. A forecast can be complete on this recording even if it failed on another recording; its overall challenge score may therefore remain unavailable.

With one complete forecast, the display shows its outline and explicitly reports that no between-forecast spread is available. With none, there is no prediction span. Identical complete forecasts can also produce zero width. Neither zero width nor a missing forecast establishes low error or certainty.

## Limits of interpretation

- The span is **not a probability, confidence, or credible interval**. It has no calibrated coverage guarantee.
- It describes only the offered finite model family and the declared heuristic ambiguity range. Unoffered explanations and missing forecasts are not covered.
- Pointwise edges may come from different candidates at different times. An edge need not be the trajectory of one executable model.
- A better prediction does not identify the physical cause of delay or gradual response. Clock alignment, actuator behavior, and compensating model error can remain competing explanations.
- Changing study settings after inspecting separate-recording results is exploratory reuse, not blind validation.
- Predicted curves and span boundaries are model outputs, not additional angle observations. Numerical resolution agreement does not establish physical validity.

This display compares predictions on existing recordings. It does not propose or choose a new experimental command course.
