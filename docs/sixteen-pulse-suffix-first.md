# How early must the sixteen-pulse adversary change a suffix-first reading?

On the suffix-first opening that made the [14/87 rule](sixteen-pulse-early-bound.md) sharp, a change at tick eight admits a collision at **5/32** for every subsequent command sequence. But an eighth-reading change cannot improve the **unrestricted** upper bound. Reordering those same eight commands creates a word that requires at least 14/87 whenever its first seven readings remain nominal, even if the adversary changes every later reply. The unrestricted H16 interval remains [5/32,14/87].

## A correction with all eight later decisions available

Begin with y1, y0, z0, z0, x0, x1, z1, x0. Publish the ordinary balanced mean through tick seven. Subtract 1/18 from the nominal reading at tick eight and retain that absolute correction through tick fifteen. The last reading is the midpoint of two original physical positions, evaluated after the final command arrives. At ε=5/32 these readings preserve both laws for all 8⁸ ordered continuations, including controllers choosing each command from all measured positions.

The [packet](../examples/sixteen-pulse-suffix-first.json) contains 195 pairs of original vertex mixtures, origins and drifts. The checker covers every one of the 6,435 eight-command tail histograms. In 6,378 histograms a single private pair covers every permutation. For the other 57, the final command selects the pair. This division accounts for the free terminal reading without imposing a nominal bound there. No intermediate reading depends on the private choice. For any controller, the prescribed earlier readings fix one realized word; its pair provides two persistent physical worlds on the entire tape.

To check a histogram, hold out each possible final command. For the remaining seven actions and either persistent world, every intermediate residual is the eighth residual plus a sum of per-action rate differences from the nominal display. Its extrema are attained by taking the strictly positive or strictly negative increments first. Check both bounds against ±5/32, then check that the full physical positions differ by at most 5/16. The independent test also enumerates every vertex of the box of partial command counts and verifies the original-source position equations directly.

Use `node scripts/sixteen-pulse-suffix-first.mjs --verify` for the complete certificate. Passing any observed command prefix instead returns the actual readings and two persistent state witnesses. For a partial prefix the implementation pads the unseen tail privately to obtain a witness, while the displayed prefix is determined entirely by observed commands.

## Two obstructions on a reordering

Change the first eight commands to x0, y0, z0, z0, x1, y1, z1, x0, then issue eight references. Two independent positive row combinations use the literal original positions. Both allow arbitrary common observations after the stated cutoff. The bound on the difference between the two clean positions at those later ticks is 2ε.

| Last nominal tick required | Other measured constraints in the certificate | Exact necessary noise |
|---|---|---:|
| 6 | Nominal ticks 0, 1, 6 and common positions at 8, 16 | 4/25 |
| 7 | Nominal ticks 0, 1, 7 and common positions at 8, 16 | 14/87 |

The first sum cancels all eight masses and four initial-state coordinates and yields −50ε ≤ −8. The second yields −58ε ≤ −28/3. Both use fixed unit mass for law A and nonnegative weights on the original signed inequalities. The [receiver](../scripts/sixteen-pulse-suffix-first.mjs) checks each cancellation with integers, including the sign of the shared gap. The [separate test](../tests/sixteen-pulse-suffix-first.test.mjs) reconstructs the nominal means from both original balanced mixtures and sums the rows with rational arithmetic.

Together with the existing global construction, the second certificate establishes that 14/87 is optimal for the class of adversaries retaining the nominal readings through tick seven on this reordered word. To reach the global target 5/32, the first certificate requires a change by tick six on that word, since 4/25 exceeds 5/32. The successful eighth correction concerns the original ordered opening.
