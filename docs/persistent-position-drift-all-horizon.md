# Finite identification at an unspecified horizon

## Frozen controls

Under one unknown position and constant drift, compare every finite exact rate catalog with a finite command menu and a bounded absolute position-reading error. The planner must return a verifiable all-horizon gauge witness for aliased laws, or a finite, noise-dependent fixed schedule with a strict separation proof for every pair.

Reproduce the exact six permanently aliased and five finitely distinguishable catalogs among the eleven published four-pulse refusals. For cases 8, 12, 26, 30 and 34, physically replay every law with fractional starts and bounded errors from a single linked position/drift pair. Test clean equality for gauge-related rates on arbitrarily long run-length words. Exercise rational gaps approaching zero with exact repeat counts far beyond safe JavaScript integers, and show why equality at the noise boundary fails. Derive and verify the schedule without materializing those pulses. Check malformed and forged counts, comparison certificates, witnesses and measurement records. Report constructed upper bounds only.

## Criterion and construction

Under law i, each command u advances position by v + gᵢ(u), where the initial position and constant drift v are unknown. If gᵢ(u)−gⱼ(u)=d for every command, then law i started at (p,v) and law j started at (p,v+d) have identical positions after every pulse. They can produce the same noisy readings using the same error sequence. This equality survives any feedback policy because identical histories can trigger identical subsequent actions. Subtracting each law's rate at the first command from all its rates gives a canonical representation of its equivalence class.

For any pair in different classes let Δ be the maximum minus the minimum of gᵢ(u)−gⱼ(u) over the whole menu. Then Δ>0. Select commands u and v attaining the two extrema. Send N repetitions of u followed by N of v. Observe position at the beginning, middle and end of the block. The measured contrast

    C = y(end) − 2·y(middle) + y(beginning)

cancels the entry position and drift exactly. Under law k it is centered at N·(gₖ(v)−gₖ(u)), with absolute error at most 4ε. The two centers differ by NΔ. The smallest integer N for which this particular interval certificate is strict is

    N = floor(8ε/Δ) + 1.

The planner combines identical unordered command pairs, retaining the largest prescribed repetition count for each. Swapping u and v changes only the contrast sign. Increasing N preserves every certified separation. Concatenating the blocks distinguishes all pairs. Adjacent blocks share one boundary measurement, which enters both contrasts with its original error. The per-pair strict guarantees hold for all bounded errors, including correlated ones.

Consequently, every finite catalog with all singleton classes has a finite identifying schedule. A catalog with a nonsingleton class can never identify every law at any horizon. A returned schedule gives an upper bound on the minimum pulse count, including for adaptive policies. This construction does not optimize the complete schedule, minimum horizon or number of readings.

## Historical four-pulse refusals

| Cases in the original 37-catalog course | All-horizon result |
| --- | --- |
| 2, 4, 9, 19, 28, 32 | Each contains at least one pair related by a constant drift shift |
| 8 | 14-pulse fixed schedule |
| 12 | 10-pulse fixed schedule |
| 26 | 10-pulse fixed schedule |
| 30 | 12-pulse fixed schedule |
| 34 | 18-pulse fixed schedule |

These are the five bounded witnesses and six permanent aliases from the eleven four-pulse refusals recorded in the [four-pulse study](persistent-position-drift-four-pulse.md). The tests reconstruct every table and forward-simulate every finite case pulse by pulse at fractional initial position and drift. No new physical measurements were collected.

## Source, observations and replay

Import `planAllHorizonPositionDrift`, `replayAllHorizonPositionDriftPolicy` and `openAllHorizonPositionDrift` from `src/science/persistent-position-drift-all-horizon.mjs`. Use the existing `worldlaw.position-drift-rate-catalog/v1` fields. The all-horizon entry point accepts exact integer or fraction strings without a coefficient-magnitude cap, including arbitrarily small rational gaps within the available runtime resources. Safe JavaScript integers are accepted directly. The earlier fixed-horizon entry points retain their source parsers.

A finite policy stores the canonical rate table, run-length schedule, observation ticks, exact pulse-count upper bound and one certificate for every pair: its block, both clean centers, closed error intervals and strict margin. Counts and ticks are decimal strings. The session accepts an ordered prefix of the checkpoint measurements, including the initial position reading. For each surviving law, it returns the full set of strips on the original (p,v), the exact drift projection and a compatible initial pair. Sparse observation times use exact integer differences. The session stores one reading at a shared block boundary.

```js
const policy = planAllHorizonPositionDrift(source);
replayAllHorizonPositionDriftPolicy(source, policy);
const experiment = openAllHorizonPositionDrift(source, policy);
if (policy.status === 'finite-schedule') {
  const record = experiment.observe(checkpointReadings);
  experiment.replay(JSON.parse(JSON.stringify(record)));
} else {
  const [first, second] = policy.witnesses[0].laws;
  const trace = experiment.trace(first, second, [
    {command: source.commands[0], repeats: '10000000000000000000001'},
  ], ['1/7', '-2/9']);
  experiment.replay(JSON.parse(JSON.stringify(trace)));
}
```

An indistinguishable policy includes all equivalence classes and explicit starting-state witnesses for every aliased pair. Its trace receiver reconstructs both physical trajectories on a supplied command word and an arbitrary rational initial position and drift. Published clean equality also permits identical arbitrary bounded observation errors.

Run `node --test tests/persistent-position-drift-all-horizon.test.mjs` to reproduce the original eleven cases, gauge classes, nonuniform checkpoint correlations, forged-record refusals and a parameterized rational-gap family up to denominator 10⁶⁰⁰+1. For the two-law family with rates (0,0) and (0,1/D) and ε=1, N=8D+1 suffices. At N=8D, origins (−1,2/N) and (1,−2/N) both explain the same checkpoint readings (0,0,4), demonstrating why touching bounds cannot certify separation. The enormous schedules are represented symbolically; the small historical schedules are also replayed explicitly pulse by pulse.

## Use the Hidden-state experiment

Open `/active.html` and expand **Inspect the source and design another experiment**. Choose **Separate laws with persistent drift** or **Trace laws with indistinguishable drift**, then select **Load as a new draft**. You can also import a rate catalog from a JSON file. Review the schedule and margins or the listed equivalent starting states, then freeze the plan.

For a finite schedule, expand **Supply readings from another source**. Name the measurement source and enter a consecutive prefix of checkpoint positions starting at tick 0. Each submission represents a single trajectory and is saved as a separate dataset. The bundled example accepts positions 0, 25 and 35 at ticks 0, 5 and 10. Its compatible law is A. For indistinguishable laws, choose a pair, enter the first initial position and drift, and type one command and positive repeat count per line. **Compare trajectories** computes both paths and retains the command word, initial states and exact positions. Checkpoint times and repeat counts remain decimal strings, including above the JavaScript safe-integer range.

The shared notebook records the original source and each input document. Export it from the browser and reopen it in either the workbench or CLI. These commands start from the bundled files:

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-schedule.json --create-notebook --output my-plan.json
node scripts/active-linear-family.mjs --notebook my-plan.json --readings my-input.json --output my-run.json
node scripts/active-linear-family.mjs --notebook my-run.json
```

For standalone CLI input, use the frozen plan's `sourceSHA256` and `planSHA256`. Measured input uses `worldlaw.active-position-drift-checkpoints/v1`, a descriptive `source`, an `acquisition` of `synthetic` or `supplied`, and `readings` such as `[{"tick":"0","value":"0"},{"tick":"5","value":"25"},{"tick":"10","value":"35"}]`. A gauge input uses `worldlaw.active-position-drift-gauge-input/v1`, `laws` containing two law identifiers, `origin` containing position and drift, and `runs` such as `[{"command":"slow","repeats":"3"}]`. Gauge traces are calculated from the source. The browser exports either original input in full.

## Exact minimum for two laws

Run `node scripts/active-linear-family.mjs --input two-laws.json --binary-minimum` on an ordinary two-law rate catalog. This opt-in planner returns the minimum number of pulses against all bounded reading errors, even if a competitor can read on every tick and choose each pulse from its history. It also returns two compressed command runs, three observation times, and the optimal distances at the reported horizon and its predecessor. For three or more laws, the all-horizon construction above still gives an upper bound.

Let Δ be the range of the two laws' rate difference across commands. For an n-pulse word let S(t) be its accumulated rate difference. Arbitrary differences in initial position and drift add an arbitrary affine function of time to S. Let E be the smallest possible maximum absolute deviation of S from such a line. Two closed per-law error boxes have a common transcript on this word exactly when E ≤ 2ε. Indeed, the difference of two admissible errors has magnitude at most 2ε; conversely, split the residual equally between the two laws.

For n ≥ 1, the largest E over all words is

    D(n) = Δ · floor(n/2) · ceil(n/2) / (2n).

To bound every word, subtract the chord t·S(n)/n. Over any interval of length l between two ticks, the chord residual changes by l(n−l)/n times the difference between the average increment inside and outside the interval. These averages differ by at most Δ. The residual range is at most Δ·floor(n²/4)/n, including both endpoints whose residual is zero. Shifting the chord by the midrange halves this bound. Set D(0)=0.

To attain the bound, apply a command with minimum rate difference for a=floor(n/2) pulses, then one with maximum difference for b=n−a pulses. The split observation differs from the chord through the endpoints by Δab/n. For any affine approximation with maximum error E at the three ticks, the split error minus the convex combination of the endpoint errors has magnitude at most 2E. Hence E ≥ Δab/(2n). For n=1 the distance is zero for all words.

Feedback cannot avoid the lower bound. Start the common transcript at zero and, after each chosen command, increment it by the mean of that command's two rates. Every reply has been determined before the next command. After any policy stops at or before n, take a line approximating the resulting difference word as above. Give the two systems opposite halves of its intercept and slope (negative for the first law). Each now reproduces the entire already emitted transcript within D(n)/2 using a *single* initial state and one admissible error sequence. This is an existence proof for a pair of fixed physical worlds following exactly that feedback branch. It also applies pathwise to a fixed random seed when the requirement is a sure guarantee. Equality D(n)=2ε still admits a common transcript.

For Δ=0 the constant-offset gauge applies forever. Otherwise the minimum is the first n with D(n)>2ε. Since D(n)≤nΔ/8 with equality for even n, only floor(16ε/Δ)+1 and its successor can be needed. The implementation makes this comparison in exact integer arithmetic even for enormous horizons. For rates (0,0) and (0,1/D) at noise 1 the resulting minimum is 16D+1, one pulse shorter than the equal-block upper bound of 16D+2.

In JavaScript, `planBinaryPositionDriftMinimum(source)` constructs the policy. `openBinaryPositionDriftMinimum(source, policy)` rederives every field. Its finite-schedule `observe(values)` accepts the three checkpoint positions or a consecutive prefix and returns physical state regions. Call `midpointAdversary()` for a lower-bound witness. Read `initialReading`, pass each selected command to `pulse(command)`, then call `collision()` for both initial states, readings and the maximum error over the whole run. An optional positive decimal-string count groups consecutive identical commands. Intermediate readings and errors interpolate linearly within each such run. The adversary accepts every word through the predecessor horizon, including an early stop, or arbitrary finite words for gauge-equivalent laws.

The [multiclass minimum study](persistent-position-drift-multiclass-minimum.md) combines these binary lower bounds with verified common fixed tapes. It resolves three of the five finite historical cases and gives one-pulse adaptive intervals for the other two.

## Minimum planners and measurement-led feedback in the workbench

In the Hidden-state experiment at `/active.html`, choose **Find the two-law minimum**, **Bound a multiclass minimum**, or **Choose the sixth pulse from five-pulse readings**. You can also import a rate catalog, select its planner in the source panel, and recompute the draft. The multiclass planner accepts an explicit horizon and total budget for fixed-word enumeration. The binary planner reports an exact minimum or a permanent alias. A multiclass plan displays distinct adaptive and fixed bounds, and reports an exact minimum when its bounds meet.

Freeze the design, give the physical run a source description, and supply consecutive positions at the displayed checkpoints. For a fixed tape the displayed repeat counts remain exact decimal strings. For case 12, record the initial position and the five prefix measurements, in one or more packets. The workbench displays the sixth command only after those six readings have been accepted. Reopening that notebook restores the same command. The final packet must carry the matching tick, command and digest of the preceding original packet. Each accepted measurement remains in its original packet, and each result includes the accumulated trajectory and compatible initial states. For the reverse registered prefix, set the feedback source's `first` field to `u1` before freezing.

The CLI uses the same notebook and receiver:

```sh
node scripts/active-linear-family.mjs --input examples/active-position-drift-binary.json --binary-minimum --create-notebook --output binary.json
node scripts/active-linear-family.mjs --input examples/active-position-drift-schedule.json --multiclass-minimum --enumerate-through 7 --word-budget 2000 --create-notebook --output multiclass.json
node scripts/active-linear-family.mjs --input examples/active-position-drift-feedback.json --create-notebook --output feedback.json
node scripts/active-linear-family.mjs --notebook feedback.json --readings first-packet.json --output after-five.json
node scripts/active-linear-family.mjs --notebook after-five.json --readings last-packet.json --output complete.json
node scripts/active-linear-family.mjs --notebook complete.json
```

For guided readings use schema `worldlaw.active-guided-drift-readings/v1`. Include `sourceSHA256` and `planSHA256` from the frozen plan, a descriptive `source`, and an `acquisition` of `supplied` or `synthetic` for the run. Set `previousReadingsSHA256` to null on the first packet and to the last accepted result's `readingsSHA256` thereafter. The `readings` array starts with `{"tick":"0","command":null,"value":"1/13"}`; subsequent rows name the preceding run's command and its exact end tick. Submit positions as exact integer or fraction strings. After a case-12 prefix use the returned `checked.nextCommand` and `checked.nextTick` for the last input. An inconsistent prefix stops the experiment. The notebook preserves the original UTF-8 source and packet texts through browser export, CLI replay and reopening.
