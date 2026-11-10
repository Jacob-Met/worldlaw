# Nearby-release endpoint alignment

The nearby-release CLI reused Studio's solver but duplicated its output-interval count. Floating division could round an exact endpoint quotient upward, causing a valid 10,000-interval request to be refused. The same duplicate count overstated the reported fixed-step reservation for an already admitted comparison.

## Change and ownership

This increment imports the existing `outputIntervalCount` from `src/science/output-grid.mjs` and uses it at the wrapper's admission and fixed-reservation sites. The helper, introduced by [PR433](https://github.com/Jacob-Met/worldlaw/pull/433), compares the actual preceding grid multiplication with the duration. It preserves genuinely later representable endpoints without an epsilon.

The 10,000-interval ceiling, adaptive trial limit, solver methods, numerical tolerances, original observations, model recomputation and scientific interpretation remain the same. Removing the erroneous refusal intentionally exposes the next existing validation error on an otherwise admitted grid.

This is a complementary correction under `worldlaw-release-grid-alignment-7912183a`. The existing consumer task `worldlaw-nearby-release-response-690141946887` remains ACTIVE r5 with `estate-690141946887-20261028`; [coordination and the native baseline](https://github.com/Jacob-Met/worldlaw/pull/399#issuecomment-6689335528) were posted and read back. Source ownership and in-flight work are preserved.

## Observed baseline and candidate

The baseline is main `553c0cc5a8cd7ea84d1e197a30fb1bdcdc6445c9`. Root native Node v24.22.1 execution checked the real import closure before loading and after completion.

| Case | Original wrapper | Corrected wrapper |
| --- | --- | --- |
| Duration .13, interval .000013 | Refused because division produces 10000.000000000002 and raw ceiling 10001 | All three smooth and fixed courses complete with 10,001 output samples and one exact endpoint |
| Fixed Coulomb, duration .07, interval .01 | Three seven-step courses complete; fixed reservation is 24 | Same seven-step grid; reservation is 21 |
| Duration .13000000000000003, interval .000013 | Refused | Still refused: a genuine 10,001st interval is required |
| Duration .07000000000000002, interval .01 | Genuine final partial interval retained | Still retained |

The six new consumer regressions produced two passes and four expected failures against the original wrapper. With the correction, those six tests plus the thirteen maintained release tests and seven maintained endpoint tests all passed: **26 passed, zero failed, zero skipped**. They cover both methods, shared strictly increasing grids, reservation reporting, input immutability, true extra intervals, exhausted adaptive work and validation precedence. This is a focused selection, not the complete repository suite.

Adaptive trials are distinct from output intervals. The original direct Studio boundary execution used 11,442 trials for 10,000 output intervals. No trial-budget relaxation or performance claim follows from this correction.

## Actual retained-notebook CLI receiving

The documented entry point `scripts/nearby-releases.mjs` read the existing regular file `evidence/rate-reversal/reversal-notebook.json`, preserving its 7,789 bytes and SHA256 `185e5e43b50f0a5620ffcb1d7f2cf4cf04fcd7da8f4803fc0a0971e7c26c8b61`. It restored the original notebook and recomputed 99 candidates from 40 fitting observations, selecting `command+rate+spring`.

Five actual CLI executions received:

- The smaller original and corrected reports are deeply equal except for fixed reservation 24 becoming 21, including all trajectories, comparisons and notebook evidence.
- The original boundary request exits 1 with no successful JSON.
- The corrected boundary request exits 0; nominal, full and half courses each have 10,001 samples. Total adaptive work is 34,326 trials, below the retained 150,000 reservation.
- The genuine extra-interval request still exits 1 with no successful JSON.

All 36 loaded project modules were checked against their pinned sources, with the candidate wrapper explicitly substituted at load time. The original regular-file admission, byte reader, session replay, discovery, numerical execution and stdout reporting ran unchanged. No filesystem mock or stdin-notebook substitute was used. The emitted boundary JSON was 11,817,692 bytes; its digest is retained in the receipt, not treated as a memory or throughput benchmark.

The complete compact CLI receipt ran at 2026-11-06 16:12:55–56 UTC. An earlier execution also completed but its tool response truncated the full JSON; that limitation and the corrected receipt capture are recorded separately.

## Reproduction and receiving limits

From a normal checkout of the candidate, the focused tests are:

```sh
node --test tests/release-output-grid.test.mjs tests/release-separation.test.mjs tests/studio-endpoint.test.mjs
```

The real CLI boundary course is:

```sh
node scripts/nearby-releases.mjs \
  --notebook evidence/rate-reversal/reversal-notebook.json \
  --position 0 --rate 0 --delta-position 0.01 --delta-rate 0.02 \
  --command 0 --inertia 1 --duration 0.13 --interval 0.000013
```

Use duration `0.13000000000000003` for the genuine extra-interval refusal, or duration `0.07` and interval `0.01` for the smaller comparison.

The actual receiving used a controlled, explicitly declared module-load composition in an existing checkout whose relevant original bytes matched main, rather than a newly created clean checkout. Exact drivers, pins, invocations and native observations are retained in [receiving.json](receipts/release-grid-7912183a/receiving.json); the original direct mismatch is in [baseline.json](receipts/release-grid-7912183a/baseline.json).

The local execution service became unavailable after the completed CLI runs, before the maintained launched smoke could start. `node scripts/smoke.mjs` remains the next launch gate on a suitable authorized host. A bounded route check found coordination/admin access but no newly qualified product execution route. No process is claimed to be running.

The shared helper was already a transitive dependency, and the maintained packager admits `src/science/*.mjs`. This change needs no inclusion-policy change. The independent complete-source archive gate remains open, and no new complete package, browser qualification, deployment or release is claimed. These remaining gates and the exact candidate belong in the existing task/PR; they do not change the scientific limitations of nearby-release predictions.
