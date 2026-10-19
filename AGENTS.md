# AGENTS.md — WORLDLAW shipping and creative engineering contract

> This file governs autonomous development in this **independent product repository**. Your objective is the most extraordinary coherent full version of WORLDLAW, delivered as one progressively improving, genuinely runnable product.

## The product and its destination

**Original product identity:** Learn executable physical laws/models from observations and actively test the resulting hypotheses.

**Full north star:** Observe an unknown physical mechanism, discover an executable explanatory model and its parameters, plan informative interventions, perform simulations or experiments, falsify weak hypotheses and improve predictive laws.

**Irreducible signature features:** `actual_mechanism_observation_and_evidence_ingestion`, `candidate_structural_and_parameter_model_discovery`, `reproducible_executable_physics_models`, `active_discriminating_experiment_design`, `actual_experiment_or_solver_execution`, `prediction_residual_based_model_revision`, `interactive_model_comparison_and_visualization`.

**Original full user journey:** Give unfamiliar mechanism observations -> propose competing models -> select informative experiment -> run it -> compare model predictions to measured outcome -> revise executable law -> demonstrate improved out-of-sample prediction.

Read `docs/PRODUCT_CANON.md` and `docs/CAPABILITY_GRAPH.json` before making decisions. These describe the complete intended product; an early demo is not a revised end state. Invent ambitious new features, technically unconventional approaches and stronger experiences autonomously. Retain the original fantasy and hard signature capabilities while expanding it. Do not ask for permission simply to explore a superior implementation, execute research or add coherent new capabilities. Do not misrepresent experimental features as validated.

## NON-NEGOTIABLE: MAIN IS THE LIVE PRODUCT, NOT A PARKING LOT

1. The default branch `main` must continuously represent the **best fully integrated and runnable version available at that point in development**. Once a runnable baseline exists, never knowingly merge changes that break its documented supported user journeys, build, runtime, actual source ingestion or persistence.
2. **If the repo currently contains only boilerplate/docs:** do not call it a finished product; implement, run and merge the first genuine end-to-end application baseline urgently. A feature-complete final vision is NOT required to make `main` useful. Then progressively improve the SAME application. The full vision remains open, never reduced.
3. Specialists build features on separate branches/worktrees and may pursue extremely ambitious research in parallel; **integrate continuously**. Short reviewable PRs are good. Long-lived branches and disconnected beautiful prototypes are not delivery. Assign an integration owner who actually assembles components into the existing real application.
4. A code PR should land on `main` as soon as its increment works with the current release and passes appropriate acceptance. There is NO rule that an entire subsystem, ultimate science frontier or all final-product signatures must be finished before merging a valuable working increment.
5. Incomplete future features can stay on branches, or behind **off-by-default** feature flags only if they do not disrupt supported release behavior and have a real consumer integration plan. Flags do not make nonfunctional code count as delivered. If a branch's code is ready, bring it into main; do not defer integration for theatrical multi-month rewrites.
6. Every meaningful change should **add to the actual consumer experience, fix a product-level defect, or unblock a documented technical bottleneck**. Narrow library tests are useful but don't magically advance the shipped experience unless a real integration consumes the result.
7. **Only advertise what was actually built and tested.** Maintain separate statuses: spec, component, integrated fixture, integrated real input, independently received runnable release, category qualified, and officially submitted. A runnable current release does NOT mean the ultimate product vision is complete.
8. Do not require physical Fire TV/Alexa availability to advance anything that can be implemented on PCs, GPUs, microphones, browsers, cloud machines or legitimate emulators. Actual provider rights, media licenses, consent, simulator fidelity and contest eligibility still require honest qualification.

## The release-candidate receiving protocol (run on every code integration)

- **Before changes:** find the actual current release entrypoint and baseline expected behavior from `README.md` and `docs/PRODUCT_ACCEPTANCE.md`. If absent, your priority is to create the application/entrypoint, not another spec.
- **Build and start:** run the REAL documented application from a clean checkout or controlled deployment. Create and maintain a single repo-local smoke command (`npm run smoke`, `cargo test` plus live harness, or `./scripts/smoke.sh`) that actually exercises a launched product. A mock/unit-only script is insufficient.
- **Exercise the actual user golden path:** provide a legal/allowed representative source sample, execute its processing pipeline, operate the resulting app, verify observable output and at least one meaningful negative case. Where inference is involved, test the real backend and distinguish mock fallback.
- **Regression:** existing supported end-to-end journeys remain functional; test schema compatibility, restart/reopen state, missing dependencies, and source/clock/identity or financial safety invariants as applicable.
- **Evidence:** PR body contains exact commit, environment and dependencies, executed commands, input identity/hash, observed output/URL/recording, test outcomes, remaining uncertainty and versioned feature coverage. Do NOT invent observed results.
- **Merge and ship:** merge qualified code to `main` via legitimate existing review/CI policy, update runnable docs and actual release receipts; ensure a fresh machine can reproduce the current capabilities. If you cannot merge, report the exact blocked step and open PR link instead of declaring shipped.
- **Continue:** once merged, select the next largest missing capability or creative leap from the full canon. Improve the product repeatedly; an early golden path is a checkpoint, not the finish line.

## Creative freedom and engineering frontier

**You may invent beyond this list.** Explicitly explore new interactions, powerful combinations of AI/graphics/physics/simulation, new research techniques, improved visual language, architectures, and surprising capabilities that make WORLDLAW significantly better. Competitive alternatives are encouraged; compare them experimentally. There is no arbitrary ceiling on ambition or level of technical difficulty.

**You may replace the HOW; you may improve the WHAT; you may not silently discard the original WHY.** Preserve the intended product identity and source-grounded capabilities. Radical new ideas should be connected to the already-running application with measurable benefits, not left as standalone demonstrations.

Research frontiers remain active: inferring_structure_not_just_fitting_known_parameters; identifiability_and_uncertainty; closed_loop_active_discovery; physics_transfer_and_model_generalization. For unknowns, build falsifiable experiments and integrate promising solutions. A failed attempt is learning, not permission to shrink the product.

## Submission ownership

The responsible agents own actual code, polished UI, assets, inference, integration, reproducibility, genuine recorded demo, licenses and media rights, README/setup, contest rule checks and submission via existing legitimately authorized accounts with a real receipt. Only truly human-only MFA/identity/explicitly prohibited external actions should be escalated. Never falsely report submission, capability or runtime success.

**Core principle: maximal ambition forever; a beautiful, independently usable and constantly improving `main` today.**
