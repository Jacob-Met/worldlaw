# Nine adaptive pulses first collide at noise 1/12

For the eight commands and two convex rate families in the [registered catalog](../examples/active-position-drift-nine-pulse-upper.json), the unrestricted nine-pulse first-failure radius is **1/12**. A fixed tape consisting of three references and all six suffix commands identifies the family for every smaller noise bound. At equality, the causal receiver below produces one history compatible with both families against every adaptive controller. The [ten-pulse result](ten-pulse-terminal-adversary.md) therefore gives a minimum of ten pulses throughout **[1/12, 1/10)**. These statements concern sure identification with one persistent mixture, initial position and drift in each possible world.

## The failure that requires earlier feedback

Let B denote a reference or group command and S any suffix. In the source's vertex order, the balanced A and B mixture weights are respectively (1,2,1,2)/6 and (2,1,2,1)/6. Their rates differ by 1/6 on S and zero on B. Their mean μ, in source command order, is (0,1/2,1/4,1/12,−1/12,1/4,1/12,−1/12). Returning the cumulative mean at every tick gives an upper radius of 5/54. At 1/12, direct affine strip intersection covers 508 of the 512 category words. The four exceptions are B⁴S⁵, B⁵S⁴ and their reversals.

Changing only the final reading fails on `ref ref ref ref x1 x0 y0 z0 y1`. Even retaining only Y₀=Y₄=0 and Y₅=1/4 forces noise at least 3/34, above 1/12. Write an upper row as clean minus observed ≤ ε and a lower row as its negative. Multiply the A rows (upper 0, lower 4, upper 9) by (5,9,4)/34 and the B rows (lower 0, upper 4, upper 5, lower 9) by (4,4,4,4)/34. All origins, drifts and Y₉ cancel. Every source A vertex accumulates one over this tape, and every B vertex accumulates exactly its tick-five x1 increment. The sum is 4/34−1/34 ≤ ε. Equality is physical: the first three A masses are (9/34,2/17,5/34), with origin 3/34 and drift −3/68. The first three B masses are (37/51,7/102,0), with origin −3/34 and drift 3/68. The fourth mass is the remainder in each law. Their common readings are (0,0,0,0,0,1/4,1/2,7/12,1/2,41/68).

This obstruction supplied a controller state to test as well as an adversary failure. Fixing the five-action prefix ref⁴,x1 and optimizing freely over all four subsequent commands gave a numerical collision radius of 6/73. The corresponding ref⁴,x0, ref⁴,y0 and ref⁴,z0 panels gave 6/73, 3/38 and 1/13. None demonstrated a better controller. For the remaining difficult reversed prefixes, a stationary virtual continuation after four commands reached only 23/266 across the tested roots. Selecting its continuation after the fifth command improved that exploratory upper bound to 28/333 and still missed 1/12 on 24 roots. The certificate below retains the changed mechanism instead of inferring a bound from these searches.

## An observation rule that a controller can actually play

Start at Y₀=0 and return cumulative μ until the first applicable rule activates. A four-command ordered root has priority. Otherwise activate the first matching two-block multiset panel, starting at tick five or later. If neither rule ever activates, keep returning cumulative μ. Activation depends on the action just received and the actions that preceded it. Each of these cases also covers future commands that leave an exceptional category word.

* An ordered root specifies the current reading increment and one child per possible **next** command. At a leaf, its eight stored virtual rates specify all further increments, one per command actually received. Different children may keep different physical mixtures but share every earlier measured reading.
* A multiset panel starts after two ordered blocks, each internally permutable. It supplies an offset from cumulative μ at its root and at each proper descendant, indexed by the subsequent commands already received. After the ninth command it returns the midpoint of the two terminal positions stored for that completed word. A panel activated at tick nine goes directly to that midpoint.

For any adaptive controller, iterating this rule yields a single transcript. The complete-word checks supply one physical A world and one physical B world, each using the same mixture, origin and drift at every tick of that transcript. Each law may have its own start and its own bounded observation errors. Choosing a witness after a complete word never changes an earlier reply. A controller stopping sooner inherits both witnesses by any full continuation. Fixing its randomness likewise gives a branchwise collision for a sure guarantee.

## Exact finite verification

The verifier reads the original integer vertices and reconstructs the physical rates for every stored mixture. For the ordinary midpoint branch, let Dₜ be the cumulative difference of the balanced rates. A line a+vt with |Dₜ−a−vt|≤2ε supplies the two laws' opposite affine shifts. The intersection of the pairwise slope intervals recovers v and then a. The verifier checks all 512 category words exactly.

The panel search grouped the two blocks by their literal multisets. Working backward from tick nine through five, it checked respectively 4,032, 11, 18, 16 and 8 candidate groups, retaining all successful panels. Failed counts at those depths were 4, 9, 12, 9 and 2. The final two fifth-command multisets generated 216 ordered four-command roots. For a fixed panel witness, the minimum and maximum partial increment sums over every ordering of a block are sums of its j smallest and j largest increments. The verifier checks both extrema against every past tube, all future shared offsets against both worlds, and the distance between their two final positions against 2ε.

For an ordered-root leaf fix its source mixture in one law. Let fₜ be the cumulative physical rate minus the displayed increments, before adding origin or drift. A single affine trajectory fits all ticks within ε precisely when every triple i<j<k satisfies

    |(k−j)(fⱼ−fᵢ) − (j−i)(fₖ−fⱼ)| ≤ 2(k−i)ε.

Necessity follows by subtraction. For sufficiency, each tick defines a closed strip in the two-dimensional origin/drift plane. Every pair meets; the displayed condition is exactly three-strip feasibility by linear interpolation between the outer ticks. Finite Helly in dimension two gives a common point. For an unfixed future command, its contribution is one of eight physical-minus-virtual increments. The two triple intervals have opposite signs, so their exact extrema use the largest rate on one interval and the smallest on the other, then interchange them. Testing both signs covers every future word, including repeated commands. The operational receiver reconstructs one actual origin and drift on the realized tape and checks every original position tube.

The final coverage traversal counts all 331,776 literal words of the four exceptional categories. It stops a branch only when a verified state covers every continuation. Together with the ordinary categories this covers 8⁹ = 134,217,728 nine-command words. The 503,381-byte gzip packet contains 4,049 panels referencing 27,628 distinct physical world pairs, and 216 ordered roots with 1,952 analytic leaves. The final basis extraction fixes the target at exactly 1/12, uses the numerical simplex only to select basic rows and columns, then solves their integer system with rational elimination. Every reported leaf is independently rechecked from the vertices. Verification uses the Python standard library and integer or fractional arithmetic throughout. The [fixed-tape theorem](fixed-tape-optimum.md) supplies the matching strict lower side.

```sh
python3 scripts/verify-nine-pulse-causal-obstruction.py examples/active-position-drift-nine-pulse-upper.json examples/nine-pulse-causal-obstruction.json.gz
python3 scripts/verify-nine-pulse-causal-obstruction.py examples/active-position-drift-nine-pulse-upper.json examples/nine-pulse-causal-obstruction.json.gz --commands ref ref ref ref x1 x0 y0 z0 y1
```

Passing `--commands` with a shorter prefix returns its retained readings and one physical witness per law. Omitting that option verifies the whole certificate.
