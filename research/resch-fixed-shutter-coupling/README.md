# What survives different pairings of eight shutter measurements?

The original fixed-position optical readings give a negative third central moment of **−3.51813 × 10⁻⁶** for the normalized Sorkin parameter. Other admissible pairings yielded values from **−4.52666 × 10⁻⁶ to −2.48970 × 10⁻⁶**. The registered bounds for all admissible joint distributions extend from **−6.75102 × 10⁻⁶ to +1.73577 × 10⁻⁶**. The direction of the tail is therefore unresolved under the registered test. No constructed pairing produced a positive moment. The positive upper bound is an allowance in the certificate, not a measured positive tail.

## Measurements and endpoint

Radonjić and colleagues measured pump power while successively opening and closing three optical shutters. Their MATLAB histogram uses files for cycles 640 through 740 inclusive, each with eight shutter masks and 500 readings per mask. This gives 404,000 powers and 50,500 sums under the authors' pairing. The paper describes about 50,000 measurements. All 808 files repeat the same experiment start timestamp; the individual rows identify a data point and its power. The eight configurations took about one minute to measure per cycle. Aligning the within-file reading index reproduces the authors' estimator. It cannot establish eight simultaneous optical readings.

The signed sum uses coefficients (+1, −1, −1, −1, +1, +1, +1, −1) in the archived shutter order. Every sum is divided by the same 1815 mW. Each cycle contributes one part in 101 and each reading contributes one part in 500 within a shutter. The mean over this empirical population is 0.03336313 for every allowed coupling. We use that one global mean to center every third moment. Restricting each coupling to a single cycle preserves the between-cycle variation in mean power.

[Author data and scripts](https://zenodo.org/records/5775886)

## Bounds and witnesses

At each cycle we computed the third moment for the stored index pairing, sorted signed powers, eight alternatives that reverse one sorted shutter, and the product of the eight observed marginals. Choosing one of these alternatives separately in each cycle provides attainable global endpoints. Other couplings are possible.

For an outer bound we split the largest signed shutter range into 32 equal widths and use that width for every shutter within the cycle. Rounding the signed readings down bounds their sum from below. Rounding up bounds it from above. Cubing after subtraction of the global mean preserves that order, including for negative sums. A linear program transports the empirical probabilities through successive partial sums with every individual marginal fixed. Its numerical solution proposes marginal dual prices. Rational dynamic programming checks the least slack over every reachable tuple and corrects the prices before computing each bound. The conclusion does not rely on a floating-point solver tolerance. Finite grid resolution and the limited witness family can leave the sign unresolved.

Cycle 732 had the largest gap between its certified endpoints. Its entire interval lay below zero, from −8.60382 × 10⁻⁵ to −1.32355 × 10⁻⁵, when centered on the same population mean. At stored index 54 in this cycle the signed sum was −0.03072386, versus the global mean +0.03336313. Across all cycles, ten certified intervals were wholly negative and 22 wholly positive. The rest contained zero. A negative cycle does not establish the sign after averaging all 101 cycles.

Compatible empirical couplings describe uncertainty about which readings could be matched if all eight marginal distributions were preserved. These limits do not quantify sampling uncertainty or separate phase fluctuations from detector noise and drift. The known published histogram direction and the phase, frequency and three-beam scaling used to fit the scan were already exposed. This study uses the fixed-position readings only.

## Reproduction

Use Python, NumPy, SciPy and system libarchive. Supply the authors' original `hoiDataPublic.rar` from the release above. Run the following commands in a dedicated directory containing the study scripts. The source SHA and full roster are checked before calculation.

```sh
python coupling_course.py hoiDataPublic.rar
gzip -n -c comparison.json > comparison.json.gz
python verify.py hoiDataPublic.rar comparison.json.gz
```

The first command writes both rational certificates and all 11 witness values for every cycle. The independent verifier checks the two certificates against the observed marginal counts with integer dynamic programming and reconstructs all 1,111 witness values from the same source projector. The premeasurement commit is `4d21bd596a52d705911f8f20dddde50202905895`. The retained first result has SHA-256 `11371a4b05881a40ca919cadd571d39104092aaffaa5d4f7a48460d111f57c10` (118,522 bytes, gzip). Recalculated certificates can use other feasible dual prices if SciPy selects another optimum.
