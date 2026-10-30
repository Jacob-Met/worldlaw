# WORLDLAW demo script (draft, not rendered)

Source: `demo/demo.json`. Screens: `demo/steps/NN.png` (taken by a headless dry run at 1440 by 900, the step's actions applied).
Dry run result: every selector existed when its step ran; no console errors.

| Step | Narration | What is on screen |
|---|---|---|
| 1 | WORLDLAW helps you find the rule behind a moving machine, using measurements alone. | Top of the page: the mechanism panel with the virtual pendulum, and the "Ask a better question" panel. |
| 2 | This demo uses a virtual pendulum with a geared joint. You need no hardware. | Same screen. The mechanism is labeled "Virtual geared pendulum". |
| 3 | The top panel shows the machine. The numbers beside it show the angle, the speed and the torque being commanded. | Same screen. Commanded angle, speed and torque shown in the upper corners. |
| 4 | The next experiment panel suggests a state worth testing. Press the green button to load it into the form. | "Use suggested state" is pressed. The notice reads "Proposed inputs are ready. Run the instrument to obtain a new observation." The position field now holds the suggested state. |
| 5 | The form now holds the suggested position, rate and command. Press Run virtual experiment to take a reading. | "Run virtual experiment" is pressed. Fit observations go from 64 to 65. The leading law changes to a sine-gravity term and held-out error drops from 1.645 to 0.000957. |
| 6 | The new reading joins the notebook. The fit count goes up by one. | Same screen. Fit count shows 65. |
| 7 | Competing laws are ranked by how well each one explains every reading so far. The leading law is at the top. | The ranked "Competing laws" list, leading law highlighted. |
| 8 | The leading law appears as an equation. Each term has a number you can read. | The equation for the leading law, with its term values. |
| 9 | Training error shows how well the law fits the readings it learned from. Held-out error checks it against readings it never saw. | Training and held-out error figures in the model panel. |
| 10 | Now let the learned law move the pendulum. Press Run dynamics. | "Run dynamics" is pressed. The status line reports the numerical run. |
| 11 | The predicted path is drawn from the law alone. Treat it as a hypothesis until a new reading agrees with it. | The predicted angle-over-time chart. |
| 12 | If a reading surprises you, undo removes it, and the explanation returns to its earlier state. | The "Undo last observation" button in the evidence trail. Not pressed in the demo. |
| 13 | That is the loop. Measure, compare the laws, then test again. | Page top, the mechanism panel. |

Length: 13 steps. Narration is about 230 words, roughly 90 seconds at 150 words per minute, within the 60 to 120 second target. This length is an estimate; the voice timing is set when the audio is rendered.

Open points for the lead:
- The position field shows `2.400000000000001` after "Use suggested state". This is an unrounded float in the input and is visible on screen. Not changed (app logic, not styling).
- Step 12 scrolls to Undo but does not press it, so the narration describes a feature that is shown rather than used.
