# Two pulses on one continuous actuator trajectory

The scalar state starts at an unknown offset and evolves as `x[t+1] = x[t] + g(u[t])`.
Each reading has an independent error in the closed interval `[-noiseBound, noiseBound]`.
The finite catalog contains two to eight incremental polynomial laws, each of degree at most four.
The menu contains one to eight scalar commands. The planner certifies identification over every
admissible reading of that single trajectory, with at most two commands and three scalar readings.
The command menu, the polynomial catalog and the continuous-state assumptions delimit the result.

```json
{"schema":"worldlaw.active-integrator-two-pulse/v1","initialState":"single-unknown-offset","noiseBound":1,"amplitudes":[0,1,2],"hypotheses":[{"id":"A","coefficients":[0,0,0]},{"id":"B","coefficients":[8,-12,4]},{"id":"C","coefficients":[8,4,-4]},{"id":"D","coefficients":[8,0,0]}]}
```

Use the standard `scripts/active-linear-family.mjs --input source.json --create-notebook --output book.json`
command. The plan lists each fixed pair of commands and its ambiguous catalog pairs. For the example
all nine fixed sequences allow identical trajectories from at least two laws. Command 1 splits the
catalog into A/B and C/D. Apply command 0 if the first measured difference is in [-2,2],
or command 2 if it is in [6,10]. The two branches identify all four laws under unit reading noise.

Receive round one by appending a JSON file with schema `worldlaw.active-integrator-two-pulse-readings/v1`,
`sourceSHA256` and `planSHA256` from the notebook, `previousReadingsSHA256: null`, a descriptive
`source`, `acquisition` equal to `supplied` or `synthetic`, `round: 1`, the applied `amplitude`,
and `observations` containing `{tick,value}` for ticks 0 and 1. Use
`--notebook book.json --readings round1.json --output after1.json`. If the result asks for
a continuation, submit the indicated amplitude at round two, bind the preceding `readingsSHA256`,
and supply only tick 2. A notebook reopened with `--notebook after2.json` recomputes the plan
and both decisions. All-hypotheses-falsified readings terminate with an empty candidate set.

## Why the continuous decision is complete

Let `d=y1-y0`, `t=y2-y0` and `E=2*noiseBound`. For one candidate giving increments
`a,b`, some common initial offset explains all three observations precisely when
`|d-a|<=E`, `|t-(a+b)|<=E`, and `|t-d-b|<=E`. These are the pairwise intersections
of three scalar closed intervals for the same unknown offset. For a pair of candidate laws,
intersect their respective bands on `d`, `t` and `t-d`. The two laws can produce the
same three readings exactly for first differences in the first intersection that also
belong to the difference of the latter two intersections.

For each first command, the planner partitions reachable `d` values at every candidate
and pair-overlap endpoint for every allowed continuation. It treats endpoints separately
from intervening open cells. Within a cell, the possible laws and the available separating
commands are constant. The planner uses the first qualifying command in menu order,
preferring a first pulse that always identifies immediately. If no policy qualifies,
each possible first pulse is accompanied by a reachable first difference for which every
continuation has an ambiguous pair. No independent reset or physical provenance is inferred.
