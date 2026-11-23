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
