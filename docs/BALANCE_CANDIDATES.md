# Inspect a notebook's numerical balance candidates

A scalar law can predict more than one angle where its torque is zero at zero
rate. Changing a fixed command can change those locations. This reader reopens
an exported WORLDLAW notebook and inspects its recomputed law within an angle
range you choose.

## Use an actual exported notebook

Export the notebook from Studio, then run:

```sh
node scripts/balance-candidates.mjs --notebook notebook.json \
  --command 0 --minimum -2 --maximum 2
```

The command is in N*m. The range is in unwrapped radians, using the same angle
frame as the notebook. Rate is fixed at zero. Supply the command explicitly:
the notebook's source history does not preserve the transient simulation
controls or the last model inspected in the browser.

The default is the model selected when the notebook's original observations,
options and experiment events are replayed. To inspect a particular candidate,
supply its exact recomputed ID, for example:

```sh
node scripts/balance-candidates.mjs --notebook notebook.json \
  --command 0.4 --minimum -2 --maximum 2 --model command+spring
```

A name that is not a candidate of that reopened notebook is refused. Changing
the command changes this conditional inspection; it does not add measurements,
refit the notebook with new evidence, shift the angle reference or establish
which candidate law is physically correct. The source file is opened for
reading only.

## Read the result

The JSON result includes the exact notebook-byte SHA-256, its byte count, the
recomputed candidate ID, its declared coefficients and term order, the fixed
command and scan settings. Cached derived results in the JSON are not used in
place of maintained notebook replay.

Each candidate distinguishes a grid point whose floating-point torque is zero
from an adjacent pair with opposite computed signs. For sign changes, bounded
bisection reports the initial bracket, final bracket, endpoint residuals, a
representative position inside that final bracket and its actual torque
residual. Its stopping reason is one of:

- `floating_zero`: the maintained predictor returned zero at the tested point.
- `adjacent_floats`: another distinct midpoint could not be represented.
- `iteration_limit`: the requested refinement count was exhausted.

Neither the refinement count nor bracket width promises a particular torque
residual. Inspect both. Brackets and zero values are numerical results, not
rigorous mathematical enclosures.

If every declared term individually vanishes at zero rate and the supplied
command, `all_terms_vanish_at_rest` is reported with no isolated candidate
list. This narrow structural result does not infer sticking, contact or
stability. Cancellation between nonzero terms is not promoted to this status.

## What a finite scan can miss

An empty candidate list does not prove that the law has no zero. A tangent
root may touch zero without changing sign, and close pairs or oscillations can
fall between grid points. More cells may expose additional candidates; they
do not turn the scan into a complete root finder.

For example, the authored law `u + q - q^3 - 0.8v` has three zero-rate balances
at command zero. A scan of [-2, 2] also sees three numerical candidates at
command 0.3, but one at command 0.4. Conversely, `q^3 - 3q + 2` touches zero at
q=1; a grid that does not sample that point can miss it. These are mathematical
examples of declared laws, not measurements of a real mechanism.

Ordinary floating-point cancellation remains part of the maintained predictor.
The reader preserves its term order. It refuses the entire scan if a nonzero
feature or coefficient product collapses to zero through underflow; it does
not skip the failed point and join signs across that gap.

## Bounds and verification

Use 1 to 4096 cells and 1 to 64 bisections per sign change. Defaults are 256 and
48. Command and both range endpoints must be finite with magnitude at most
1,000,000; the endpoints must increase. A grid whose positions collapse to
indistinguishable floating-point values is refused. The largest admitted
scan performs at most 266,241 predictor evaluations and returns at most 4097
candidates.

Notebook reading uses the maintained 6,000,000-byte file limit, a bounded
6,000,001-byte read and fatal UTF-8 decoding. Maintained replay additionally
enforces its 2,000,000-character and fitting-work limits. Unsupported source,
an unknown candidate, invalid settings or a failed evaluation produces a
nonzero exit and an explanation on stderr, with no partial JSON report.

Run the numerical and actual notebook/CLI courses with:

```sh
node --test tests/balance-candidates.test.mjs tests/balance-candidates-cli.test.mjs
```

The CLI course exports an authored 72-observation cubic-law notebook, reopens
it in separate Node processes, changes the command, checks the original bytes,
and challenges forged cached results and unsupported or oversized input.
The source-level tests also exercise a missed tangent, exhausted refinement,
adjacent floating-point endpoints, underflow and the declared-term zero case.

## Recorded native receiving

The unchanged four implementation/test files passed the ten named numerical
and actual notebook/CLI groups on Node v24.22.1, Linux, with zero failures or
skips against main `619ac1a51bc38b2e5392e0c4dc11cd5e7b18e46c` and its exact
canonical import closure. This includes the maintained session blob
`a6c689803ff7a518e095bc6c414eea1e964ec974`; its additional replay imports were
received and hash-verified before the course. The run used the command above
through the executor's approved native route and took 2071.229277 ms. Its
complete named-test log has SHA-256
`f3d46f97daedaa2528518df46e9308851a69f40db6028b2ad82d309d3abb5318`.

The actual exported input had SHA-256
`591d88deb31780c8b18efe6e95b557263033b51530e795ffac9475b7f6aecd51`.
Replayed model `command+rate+spring+cubic` produced three numerical candidates
near -1, 0 and 1 at command zero, and one near 1.1597048527648617 at command
0.4. The largest displayed residual was 2.220446049250313e-16 N*m. Separate CLI
processes reopened the same source, and its original bytes remained unchanged.
The course also refused forged candidate selection, malformed or oversized
files, invalid settings and numerical underflow without partial JSON output.

The same ten groups previously passed against the original
`95a242436315170876a211cf0a8659ee77cdc977` dependency set in 3023.973112 ms
(log SHA-256 `a8231b74dd2dbe7bbbf448683b10253956a2c7ad0fb6e9bd8c4d5c923a36e78f`).
That older run and the current-source run are separate evidence. An earlier
restricted-executor invocation reported only test-file shells; it is not used
as evidence that these groups ran. This receiving qualifies the notebook CLI
and its numerical reader; it does not claim browser adoption, a complete root
finder or physical validation of the authored notebook.
