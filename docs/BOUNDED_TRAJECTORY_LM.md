# Bounded trajectory fitting at coefficient limits

The full-trajectory fitter and the shared-restoring-law / condition-specific-damping fitter now use the same local bounded Levenberg–Marquardt routine in `src/science/bounded-lm.mjs`.

## Failure addressed

An improving update can put one coefficient exactly on its declared bound. The former central-difference stencil then had zero width for that coefficient, reported `jacobian_unresolved`, and stopped the entire fit. Other coefficients could still have useful, feasible updates.

Replacing that derivative alone is insufficient. An unconstrained coupled step can still point outside the box; clipping it can move a free coefficient in the wrong direction. The shared routine therefore combines inward derivatives with a recomputed active set.

## Method and preserved contract

Interior coefficients retain central differences. At a bound, the routine uses the current residual plus two inward probes for a second-order one-sided derivative. The second probe stays inside one half of the available interval, with explicit exact-bound and representability checks. This avoids a demonstrated floating-point escape when a nominal endpoint rounded beyond its bound.

For the local gradient estimate `Jᵀr`, a lower-bound coefficient is held only when its gradient is positive; an upper-bound coefficient is held only when its gradient is negative. The damped QR step uses the remaining columns and their corresponding damping rows. The active set is recomputed after every accepted change, allowing a bound coefficient to move inward later.

Each proposal must complete the original two-resolution screens and strictly improve the original training RMSE. An incomplete probe or nonfinite Jacobian/gradient remains unresolved. `projected_stationary` describes an estimated local projected-gradient condition, not a global optimum, exact convergence certificate or physical identification.

The two consumers retain their existing validation, strict-interior seed admission, original rows, fixed starting states, scientific model construction, challenge exclusion and result schema. The helper is an internal numerical component; helper tests starting on a bound do not expand public input admission. The unchanged worst-case work reservation is:

`1 + iterations * (2 * parameterCount + 4)`

No new model family, external inference, physical parameter meaning or uncertainty claim is introduced. Floating-point roundoff, local minima, finite-difference accuracy and model mismatch remain limits.

## Controlled actual-consumer comparison

The regression inputs are independent closed-form damped oscillators sampled at 121 times over six seconds per course. The declared stiffness lower bound is −3.9, excluding the generating stiffness −4. This deliberately leaves a constrained model mismatch.

The native Node comparison uses the pinned pre-change source `bdb71f4cd017b4e9bb77c13a3d845fb0b1e6b224` and the candidate, with identical original source inputs and unchanged reservations.

| Consumer | Baseline training RMSE (rad) | Candidate training RMSE (rad) | Baseline / candidate evaluations | Reserved maximum |
| --- | ---: | ---: | ---: | ---: |
| Shared trajectory coefficients | 0.05438782705306061 | 0.03658603075982225 | 8 / 47 | 65 |
| Shared restoring law and separate condition damping | 0.05041383765869642 | 0.030647183607347587 | 8 / 63 | 81 |

Both baseline fits stop at the next Jacobian after clipping stiffness. The candidate continues improving damping while stiffness remains −3.9. Complete evaluations retain their numerical screens; original inputs remain unchanged. The trajectory reservation stays 131,040 integration steps / 15,730 rows; the condition reservation stays 163,296 steps / 19,602 rows.

This is an improvement in two authored constrained training courses. It is not measured physical validation, held-out improvement or a speedup. More evaluations are used because useful fitting continues instead of stopping prematurely. The original comparison is retained in [the native receipt](receipts/bounded-trajectory-lm/native-comparison.json); its input SHA-256 is `11447a6d8019c23334585e3f9d317525962ffc8c34ab3f465baef6ce490add8d`. Evaluation counts may differ at floating-point tie boundaries across runtimes; the work bound remains fixed.

## Receiving

Received on Linux x64 with Node v22.23.4 and Chrome 156.0.8078.47:

- Nine shared-helper regressions and two actual-consumer boundary regressions, including coupled clipping, both bound directions, changing active sets, incomplete probes, nonfinite gradients and exact probe confinement.
- The focused native selection passed 21 tests, including the maintained condition-session tests.
- The full native suite passed 2,219 of 2,220 tests with zero failures and one inherited optional skip. Baseline passed 2,208 of 2,209 with the same skip.
- Both maintained launched-server smokes passed, including real fitting, prediction, input-only notebook reopening and refusal cases.
- Actual Chrome loaded the maintained Trajectory Challenge and fetched/imported the new helper with HTTP 200 and zero page errors.
- The maintained standalone builder with esbuild 0.27.3 captured all three changed runtime modules. The resulting 1,547,751-byte HTML has SHA-256 `ecd5f3d8dde0c767f7bd847bd82fb31cb319eade38bedd060d71fbd9a9b43dd7`.
- Offline experiment/screen receiving passed ten unique maintained checks, including worse-refit and numerical-plan refusal cases, reopening, attribution and zero external requests. The two focus runs share these checks; they are not twenty independent checks.

The first standalone build could not find esbuild. Provisioning the existing documented 0.27.3 dependency in an isolated tools directory resolved that prerequisite without changing product dependencies. An initial browser harness used an invalid relative request URL; the corrected harness retained the original failure.

The complete standalone browser course exposed a separate inherited 320px layout failure: four geometry-study file controls make the document 335px wide. The same assertion failed on a pristine baseline package built with the same toolchain, after the same four successful groups. That full course is not claimed passed by this numerical increment. Its geometry layout repair is separate.

Reproduce the native receiving with:

```sh
node --test tests/bounded-lm.test.mjs tests/trajectory-boundary.test.mjs tests/trajectory-lm-core.test.mjs tests/condition-trajectories*.test.mjs
node --test tests/*.test.mjs
node scripts/smoke.mjs
node scripts/trajectory-smoke-92be.mjs
```

Use the existing `ESBUILD_MODULE`, `PLAYWRIGHT_MODULE` and browser-path conventions for the maintained standalone builder and browser course. No numerical-screen threshold or work limit was relaxed for receiving.
