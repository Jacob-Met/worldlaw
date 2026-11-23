# Feedback after probing both x commands

For this registered two-family position experiment, eight pulses identify the family at every noise below **1/14**. The previous adaptive program reached 1/15, and the best fixed eight-pulse tape reaches 1/16. Four reference pulses followed by x1 and x0 measure the response on the x commands. This measurement chooses between probing both y commands and probing both z commands. Three references give a seven-pulse program with sharp policy radius **1/16**. The [seven-pulse causal obstruction](seven-pulse-causal-obstruction.md) supplies the matching unrestricted upper.

## Measured controller

For any integer m≥1, record the positions at ticks 0,m,m+1,m+2,m+3,m+4. After m references, x1 and x0, compute

    S = 2Y₀ − (m+2)Yₘ + mYₘ₊₂.

Choose y0,y1 if S<m/2. Choose z1,z0 at equality and above. The receiver intersects the original constraints in one mixture, one origin and one drift over every retained measurement. The reference run has constant storage even for a large exact integer m.

```sh
node scripts/active-linear-family.mjs --paired-suffix --input examples/active-position-drift-paired-suffix.json --output paired.json
node scripts/active-linear-family.mjs --paired-suffix --input examples/active-position-drift-paired-suffix.json --replay paired.json --readings readings.json
```

At the example noise 1/15, readings ["0","0","0","0"] select y0. Appending "1","1" leaves only A. The readings ["0","0","0","1"] select z1. Appending "1","0" leaves only B. Exact rational inputs preserve the cutoff decision under any common affine change in position.

## Strict separation and closed contact

Write X,Y,Z for the sums of the two rates of each letter. At every A vertex, X+Y=1 and Z=0. At every B vertex, Y=0 and X+Z=0. Verification checks these identities at every supplied vertex, so they apply to every constant mixture.

Let T=4Y₀−(m+4)Yₘ+mYₘ₊₄. Both S and T cancel initial position and drift. The sum of the absolute coefficients is 2m+8 for T and 2m+4 for T−S. On the Y branch, A has noiseless T=m and B has T−S=0. A shared history therefore needs S≥m−(4m+12)ε. On the Z branch, B has T=0 and A has T−S=0, so a shared history needs S≤(4m+12)ε. The measured cutoff excludes a shared history on the selected branch for every

    ε < Rₘ = m/[8(m+3)].

At equality put e=Rₘ, gA=1/2+4e/m and gB=1/2−4e/m. In canonical source vertex order use the A masses (gB,gA,gB,gA)/2 and B masses (gA,gB,gA,gB)/2. Give them origins +e,−e and drifts −2e/m,+2e/m. Their clean position difference moves affinely from +2e to −2e during the references, stays at −2e through x1,x0, and moves to zero and then +2e on either suffix. The same two physical worlds admit the midpoint at every original tick, including every omitted reference tick. Their common prefix reaches S=m/2. This proves the closed first collision of this policy for every m. Its limiting radius is 1/8.
