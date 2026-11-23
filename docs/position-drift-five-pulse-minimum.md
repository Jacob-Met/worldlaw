# The grouped families have adaptive minimum five at the four-pulse boundary

For the published eight-command, two-family catalog, the **unrestricted four-pulse noise radius is exactly 1/40**. Only the prospective prefix (ref,group) attains it. Every four-pulse strategy admits a shared physical history at equality. The exhibited five-pulse tree first uses ref, ref, group, then chooses x0 or x1 from the positions already received, and finally chooses that group’s y or z command. Its exact first-failure radius is **1/29**. Consequently the minimum adaptive pulse count is five for **1/40 ≤ ε < 1/29**. At 1/29 this particular five-pulse tree has a collision; the unrestricted five-pulse optimum remains open.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-five-pulse-minimum.json --five-pulse-minimum --output five.json
python3 scripts/verify-five-pulse-minimum.py examples/active-position-drift-five-pulse-minimum.json five.json
node scripts/active-linear-family.mjs --input examples/active-position-drift-five-pulse-minimum.json --five-pulse-minimum --replay five.json --readings positions.json
```

A readings file is an array of one through six consecutive exact positions. For example, `[17,20,23,27,30,34]` follows ref, ref, group, x1, y1 and retains A. Supplying fewer readings returns the next command and current persistent survivor regions. A work cutoff has its own result and makes no horizon claim.

## Covering all four-pulse adaptive policies

Compute a complete four-pulse course for every ordered pair of first commands, including repeats. Each prefix is followed by every third command and every last command. The third-position contrast is shared by all leaves and the fourth-position contrast is shared by siblings with the same third command. The ancestral support certificate proves separation below its radius, and original mixtures, initial position, drift and clean positions prove a common history at that radius. Larger errors include those witnesses. The source verifier checks the bounds and physical histories for the 64 ordered prefixes, including all 4,096 leaf pairs. The runner-up (group,ref) has radius 1/42; 56 prefixes fail even with exact measurements.

Initial position and drift are unrestricted. A failing game can therefore use the same first readings y₀=y₁=0, regardless of an adaptive strategy’s early response to those readings. This forces an ordered first pair. Its complete continuation tree supplies common observations along whichever later branches are actually chosen. Conversely a winning prospective prefix can be used at every affine translation. Taking the maximum of the individual thresholds thus certifies the unrestricted four-pulse radius. Every shorter strategy can be padded with unused pulses.

## A separate, original-coordinate five-pulse certificate

The submitted five-pulse program is a finite action tree. It begins with at least two commands; siblings have different next commands and every leaf has length five. Later observations are attached to their entire command history. Each leaf has one private physical state for each family, with a constant mixture of rate vertices, initial position and drift. These values persist across all six readings on that leaf. Counterfactual worlds from different leaves may differ. Readings must agree wherever their histories have the same ancestry.

Normalize the first two readings to zero by subtracting their affine line from the entire record. For every later history introduce one shared observed coordinate. In each private world eliminate the last barycentric mass as one minus the sum of the others, enforce nonnegative masses, and accumulate the actual command rates. At each tick impose both sides of the original noise tube, |position−reading|≤ε. These raw rows have the form Mz≤h+rε, with r=1 on position tubes and r=0 on mixture constraints. They use no independent contrast-noise approximation.

Minimize ε by solving the exact support dual from its feasible zero basis. A positive combination of source rows cancels every coefficient of every unobserved position, drift, mixture and actual ancestral observation. Its constant and noise terms give the lower bound for a common record. At equality, the stored observations and raw trajectories provide the converse. In the grouped tree there are 128 original inequalities and 48 free physical/shared coordinates. A 31-term exact lower certificate yields 1/29. The same equality record supplies eight original physical worlds on the four branches.

The runtime first verifies the source-bound proof. It checks the physical survivors for the current command tape. At each real decision it pins only the measurements available at that point, then asks whether each candidate continuation tree admits a collision at the declared noise. It commits the first safe command. At ε=1/40 all four exhibited paths can be followed using actual positions; forged states, invalid ancestry and changed source rows fail direct replay.

The independent Python receiver recomputes each four-pulse support directly on the source vertices and checks the complete position trajectories. For the fifth pulse it rebuilds the signed raw equations with symbolic identifiers for each private state and each shared command history. It verifies the entire lower combination and the boundary states without calling the JavaScript designer or a numerical optimizer.

For a changed two-point catalog with rates (0,0) and (0,1), the same verifier recovers four-pulse radius 1/4 and exhibited balanced five-pulse radius 3/10. At the latter equality the program reports that the exhibited five-pulse tree is refuted; a global five-pulse maximum is not inferred from a single program.
