# Compositional evolution-law discovery

The maintained torque fitter can now search composed expressions using `discover(rows,{operatorGrammar:options})`. The original fixed-library entry remains available with its existing options. A concrete failure on commands ±1, angles −π, 0 and π, and rates ±1 motivated the change. The difference between the two command responses of any old model is affine in angle. Its centered second difference is zero; the measured law command·cos(position) gives −8. The sum of absolute weights on the six measurements is eight, so every fixed-library model incurs an absolute error of at least one. The tested old entry returned a maximum error of one and flagged residual mismatch.

The new core builds expression nodes by size from +, multiplication, division, sine, cosine, absolute value and tanh. Products can represent quadratic drag or modulation of the command. Periodic field samples also supply centered first and second differences from their two neighbours and spacing. A bounded beam adds candidate columns to a sparse weighted sum; each support refits with the maintained normalized QR. A finite grammar or memory budget can refuse a request. A successful training fit is a candidate under the declared coordinates and tolerances. Several expressions can agree on the same observations.

`src/science/operator-synthesis.mjs` exposes fitting, prediction and measured-response assessment. Its inputs declare either nondimensional oscillator acceleration or one-dimensional periodic-field derivatives. The existing torque entry produces a separately tagged torque model: torque predictions cannot be rolled as accelerations without a physical calibration. Singular divisions on observed inputs are excluded from that training design; application to a new singular input yields an explicit undefined-operator refusal.

`src/science/operator-rollout.mjs` offers RK4 rollout, independent-step refinement comparison and input-only excitation selection. For a supplied finite list of initial states and waveforms, it evaluates every candidate pair and chooses the course with the largest minimum path RMS separation. Candidates may remain indistinguishable throughout the menu. For a forward challenge, both the measured path error and the difference between coarse and refined integration must meet their respective tolerances.

## Independent receiving course

NULLGARDEN supplies the frozen original equations, time-shuffled response controls, three hidden-coordinate counterexamples and independent midpoint-integrated challenge paths. The same four-node, seven-operator menu, two-term support limit and 16-wide beam apply to both positive systems and the controls. Training rows alone determine the models. To replay, use NULLGARDEN at commit `628f480528f00aa84e48e73218fb1574fe3be05d`.

```sh
node /path/to/nullgarden/src/operator-course.mjs > /tmp/operator-course.json
node scripts/receive-symbolic-operator-course.mjs /tmp/operator-course.json
```

The deterministic course recovered command·cos(position) on the oscillator and −field·dx + 0.2·dxx on the periodic field. Held derivative maximum errors were below 10⁻¹⁵. The two refined RK4 trajectories had maximum errors of approximately 3.65×10⁻⁷ and 1.10×10⁻⁸ respectively against the independent midpoint paths; the declared tolerance was 2×10⁻⁶. Both time-permuted models failed. The hidden-delay, projected Lorenz and unobserved second-neighbour controls all abstained. Each contains identical observable inputs with contradictory required derivatives, forcing worst errors of at least 1, 30 and 1 on those respective examples. These are finite synthetic controls under fixed tolerances.

The input-only design compared the recovered oscillator to a command-only model across three courses. The quiet course had zero pairwise separation; weak excitation gave approximately 0.000353 and the selected wide chirp approximately 0.374. The optimum is over that declared menu.

A held trajectory that reaches an undefined operator or a nonfinite state receives an explicit refusal. Excitation design records each such course in `excluded` and scores the remaining courses. If all courses fail, it returns `no_admissible_course`.


### Observation resolution and ambiguous laws

`designEvolutionExcitation(models, courses, {resolution, observedIndices})` compares simulated observations for every admissible course. For a position sensor on an oscillator, pass `observedIndices: [0]` and a nonnegative RMS resolution in radians. The default uses all state channels and a resolution of zero. Select commensurate channels when interpreting a single absolute RMS threshold. Resolution is a declared sensor or decision threshold, and the planner does not estimate it from observations.

The result retains the original model indices. `unresolvedPairs` lists pairs whose simulated separation stays at or below the threshold across the entire admissible menu. `groups` collects models with identical sets of unresolved neighbors, including themselves. For example, if A and B are unresolved, and B and C are unresolved, A and C can still be distinguishable. The pair list preserves both ambiguities.

A course separates a group pair when every cross-group model pair clears the threshold on that course. The planner maximizes the number of separated group pairs, then their minimum separation across group pairs attainable on the menu. Remaining ties favor a course that separates at least some members of more group pairs. `ranked[].minimumSeparation` continues to report the whole-roster minimum. The chosen course's `selectedUnresolvedPairs` can include additional pairs that another course would separate. The status `partially_separating_in_simulation` reports that the selected experiment leaves some hypotheses unresolved.

With accelerations `command`, `command × 1`, and `−command`, silence makes all three predictions coincide. Applying a constant unit command for two seconds yields positions +2, +2, and −2. The planner selects that forcing course and returns the original two model indices as an unresolved pair. These statements concern predictions over the supplied menu.
