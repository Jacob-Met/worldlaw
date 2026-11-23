# A shared-history decision after a finite fixed prefix

Choose **Choose a suffix from a longer measured prefix** in the Hidden-state workbench. Freeze the experiment, record the initial position and the prefix positions, then apply the displayed suffix. The notebook commits every command in that suffix together and replays the decision on reopen.

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-shared-suffix.json --create-notebook --output shared.json
node scripts/active-linear-family.mjs --notebook shared.json
node --test tests/position-drift-shared-suffix.test.mjs
```

Supply a prefix of zero to sixteen commands, two to eight laws, and one to six equal-length suffixes with up to ten pulses each. A completed search gives a policy or a physically realized common-prefix refutation for this fixed menu. Assignment or linear-work exhaustion leaves the decision inconclusive. The search neither changes the prefix nor optimizes pulse count.

## A fixed number of state variables per hypothetical suffix

A suffix can fail only if two distinct laws fit the same full tape. The exact fixed-tape test first removes pairs that never collide. If a suffix has no remaining pair, a constant choice is already safe.

To defeat every offered suffix, an adversary must supply **one common measured prefix**, plus one colliding law pair and one private later transcript per suffix. For each chosen pair use independent physical starts for its two worlds. Every world predicts position p + tv + F(t) with known cumulative forcing. At each prefix tick, the closed error intervals around all predicted positions have a common value exactly when every pair of centers differs by at most twice the error bound. At a later tick only the two centers belonging to that particular suffix must satisfy this condition. Readings themselves can thus be eliminated from the prospective feasibility problem.

Subtract the initial position and drift of the first hypothetical world from every trajectory. This common affine translation preserves those difference inequalities. With m suffixes assigned there are precisely 4m−2 free state coordinates, independent of the number of prefix and suffix pulses. Each start remains fixed throughout its world's tape. If the same law appears in several alternative suffixes, its possible starting state may differ across those counterfactuals. The zero-noise empty-prefix test gives an example where enforcing a single start across choices would reverse the conclusion.

Search suffixes in source order. A positive weighted sum of rows with zero state coefficients and negative right bound proves the current partial assignment impossible, eliminating all its completions. A feasible full assignment supplies one common prefix from the overlapping intervals and independent later readings for each suffix. Every returned start and reading is checked against the raw position equation. A completed tree of exclusions proves that every physically feasible prefix admits a safe suffix. The substitution-only verifier independently rebuilds the candidate lists, checks the weighted rows and covers all possible assignments with the saved exclusions. Notebook replay additionally rederives the saved search and work counters.

After actual measurements arrive the translation freedom is gone. For each remaining pair the receiver imposes all prefix strips on the actual measured numbers and tests the private future differences on its four physical coordinates. It commits the first suffix with no feasible colliding pair. The assignment budget counts visited nonempty partial assignments. The linear-work budget bounds row generation and the recursive exact intersection solver during prospective search. The preliminary fixed-tape screen and actual-prefix pair checks have separate finite intake limits.

## Why two-coordinate marginals can fail

The example uses four prefix commands and two three-command alternatives. After removing the line through the first two readings, call the three remaining measured residuals s,t,u. In the table, all four laws survive every row. In successive pairs of rows, respectively, (s,t), (t,u) and (s,u) are identical. The required choices are opposite.

| s | t | u | Required suffix |
| --- | --- | --- | --- |
| 11/40 | −11/40 | −3/40 | Y |
| 11/40 | −11/40 | 5/8 | X |
| −3/40 | −11/40 | 11/40 | Y |
| 5/8 | −11/40 | 11/40 | X |
| 11/40 | 1/40 | 11/40 | Y |
| 11/40 | −23/40 | 11/40 | X |

For X only A/B can collide, and for Y only C/D can collide. Along each offending suffix the three cumulative forcing differences are 1/2, −7/2 and 1/2. The affine part of the clean difference must be at most 3/2 at the two outside ticks and at least 3/2 at their midpoint. Consequently it equals 3/2 throughout. The remaining common-position freedom is a quarter of the unit-error prefix region, because the two noise intervals are displaced by 3/2. For X the region is centered on zero. For Y it is translated by (11/20,−11/20,11/20). The oblique contrast s−2t+u cancels the unknown affine contribution. Its interval has radius one in each region, and the centers differ by 11/5. This particular contrast witnesses separation even though every raw two-coordinate marginal overlaps. Moving 11/20 to 1/2 makes the regions touch and produces one physical common-history refutation.

The saved positive proof uses two visited assignments. Adding a third suffix with six potentially colliding pairs requires no additional assignment visits because a contradiction already occurs between the first two alternatives.
