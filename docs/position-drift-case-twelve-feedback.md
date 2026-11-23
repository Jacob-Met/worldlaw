# Six pulses identify historical case 12 with one feedback decision

The two fixed five-command prefixes u0,u0,u0,u1,u1 and u1,u1,u1,u0,u0 both permit certain identification on the sixth pulse. The experimenter observes the entire prefix before selecting the final command. All errors may be correlated and lie in the closed interval [−1,1]. The original laws have rate rows L0=(−1,6,4), L1=(−4,2,8) and L2=(−8,2,−2). Their initial position and constant drift are unknown.

| Restriction | Ticks | Commands used | Contrast centers, first prefix | Centers, reverse prefix | Contact threshold |
| --- | --- | --- | --- | --- | ---: |
| L1 and L2 share the first five pulses | 0,3,5 | Prefix only | 36, 60 | −36, −60 | 20 |
| L0 and L1 share a sixth reading | 0,5,6 | Finish with u2 | 11, 48 | 4, 42 | 24 |
| L0 and L2 share a sixth reading | 0,3,6 | Repeat the fifth command | 63, 90 | −63, −90 | 24 |

For ticks a<b<c the contrast has coefficients (c−b, a−c, b−a), so the unknown position and drift vanish. A law's absolute reading error contributes at most 2(c−a), and two laws' intervals separate strictly when their centers differ by more than 4(c−a). The first row rules out simultaneous feasibility of L1 and L2 from the six shared readings at ticks 0 through 5. If L2 remains feasible, repeat the fifth command. Otherwise choose u2. The selected contrast then separates whichever pair can remain. The receiver uses one persistent initial state per survivor to check the final measurement.

## Exact shared-history feasibility

To refute either prefix, an adversary needs one shared predecision transcript and, for each of the three possible final commands, some pair of laws that can produce a common last reading. The three potential last readings are independent; each action branch may also have its own physical witnesses. There are 27 ordered assignments of collision pairs to these three branches. In 25 assignments both L1 and L2 occur somewhere. Because the first six readings are shared, the first row of the table contradicts all 25 assignments, even when L1 and L2 are assigned to different actions. In the two remaining assignments every branch names the same pair. The matching terminal row contradicts that assignment using only the last reading private to the chosen branch.

The independent receiver reconstructs two signed physical inequalities for every assignment on nine explicit coordinates (six shared readings and three private last readings). Adding them cancels all nine coordinates and gives 0 ≤ −margin. The margins are 4, 13, 3 on the first prefix and 4, 14, 3 on the reverse. This proves infeasibility over continuous exact histories without discretizing the readings.

For L0/L2 the rate-difference range is 3, and the binary optimal distance from affine drift after five pulses is 9/5. This is below the common-transcript threshold 2. Consequently at least six pulses are necessary for any sure feedback policy. This six-pulse design attains the lower bound; [seven are necessary with fixed commands](persistent-position-drift-multiclass-minimum.md).

Use `planCaseTwelveOneFeedback('u0')` or `planCaseTwelveOneFeedback('u1')` from `src/science/position-drift-case-twelve-feedback.mjs`. The plan gives the immutable command prefix, three exact physical contrasts and all 27 infeasibility certificates. `openCaseTwelveOneFeedback(first, saved)` reconstructs and verifies it. Call `receive(values)` after each measurement to obtain compatible initial states and the next command. The last command is derived from the first six readings alone. The seventh position can identify one law or falsify every law.

Run `node --test tests/position-drift-case-twelve-feedback.test.mjs` for the 54 independent integer certificates and 768 physical trials at all corners of the seven-reading error box, including noninteger drift and initial position (10⁵³+2)/13.
