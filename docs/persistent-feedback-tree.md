# Compact scalar feedback trees

For the grouped catalog, the minimum is **six pulses for 1/29 ≤ ε < 3/76**. The [complete five-pulse certificate](position-drift-five-pulse-global.md) gives the lower bound. The six-pulse exhibit commands ref three times, then group, then x0 or x1, and finally the corresponding y or z. Its exact first-failure radius is 3/76 with eight physical boundary worlds and 31 positive source rows. At 3/76 this program has a collision. The unrestricted six-pulse optimum remains open.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-six-pulse-tree.json --physical-feedback-tree --output tree.json
node scripts/active-linear-family.mjs --input examples/active-position-drift-six-pulse-tree.json --physical-feedback-tree --replay tree.json --readings positions.json
```

The general command accepts a finite source tree at horizons two through sixteen. Every leaf must finish at the declared horizon and the first segment must commit at least two commands. For observations [17,20,23,26,30] the next command is x1. Extending with [33,37] follows ref/ref/ref/group/x1/y1 and retains A. Saved reports contain separately checkable source and compact trees. A work cutoff gives an explicit inconclusive outcome. Before allocating the dense solver basis, the designer checks its squared dimension against the work budget.

## Constructing a compact proof

For an H-pulse tree with a fixed common first pair, **at most 2^(H−2) leaves retain its exact threshold**, independent of the number of available commands. Each later position is one scalar shared by exactly the leaves with its full action history. Each terminal world has its own mixture and initial state, held constant along that history.

Start from a positive dual lower bound and a matching physical collision. Every positively weighted row is tight at the boundary because the weighted sum of the nonnegative slacks is zero. To eliminate one scalar, keep its zero-coefficient rows, and transport positive coefficient mass to the cancelling negative mass. Each transfer forms a nonnegative combination of two rows, eliminating that coordinate. With P positive and N negative terms, at most P+N−1 transfers preserve the original weighted sum. The algorithm retains the exact nonnegative multipliers of the original inequalities at each step.

Eliminate private physical state coordinates first. These cancellations stay inside one leaf. Next eliminate the shared readings deepest first. At the terminal reading both contributing rows still belong to one leaf. Each earlier level can at most double the number of leaves represented in one new row. Disjoint histories at the same depth have disjoint descendants. When tick two is eliminated, every remaining row therefore uses at most 2^(H−2) leaves. All these rows are tight at the old boundary. At least one has a positive noise coefficient because their sum did. Normalize it and retain its leaves. The original physical boundary restricted to the same leaves proves the other side. If the threshold is zero, one leaf with its inherited physical collision suffices.

The verifier reconstructs both trees and checks source inequalities, physical trajectories, dual cancellation and exact radius equality. The runtime chooses a safe branch using only readings already supplied, on the smaller menu. The old five-pulse experiment uses the same underlying physics and preserves its saved-plan format.

## What makes the bound sharp

In an abstract binary scalar tree give each internal node a real variable. A leaf inequality is the signed sum of its ancestral variables minus ε ≤ −1, with opposite signs in the two child branches. The uniform average gives ε ≥ 1 and zero variables attain equality. Delete a leaf at depth d: assign it payoff 2^d−1 and all others payoff −1, so the mean is zero. At each node use half the difference of its child means for the scalar. The signed sum telescopes to the respective leaf payoff. All remaining rows now hold at ε=0. Thus 2^d leaves can be necessary in the general scalar affine class. The example does not establish sharpness at large horizons for the physical rate catalogs.

The dense 64-leaf and 1,024-leaf tests reduce to eight and 32 leaves. Changed two-point schedules with gap 1/7 match the binary analytic threshold through horizon ten. The 64 original five-pulse duals already used only two to six leaves (7, 27, 26, 3 and 1 cases respectively). The complete upper certificate still checks all 512 continuations per initial pair.
