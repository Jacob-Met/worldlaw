# WORLDLAW — Uncompromised Product & Research Blueprint

**Original identity:** Learn executable physical laws/models from observations and actively test the resulting hypotheses.

**Competition:** Nebius × NVIDIA | **Standalone repository:** `Jacob-Met/worldlaw` (create if absent) | **State:** proposed maximal future product specification, not a claim of built features.

## The ultimate product (scope-locked)
Build an autonomous physical scientist that discovers not only unknown coefficients but the actual structure of physical mechanisms, chooses informative experiments, creates executable explanatory models, falsifies them and transfers the resulting laws to unseen conditions.

**Additional canonical north star:** Observe an unknown physical mechanism, discover an executable explanatory model and its parameters, plan informative interventions, perform simulations or experiments, falsify weak hypotheses and improve predictive laws.

## What the complete application feels like
1. A user places an unfamiliar tabletop assembly in view; WORLDLAW reconstructs visible bodies, joints and contact possibilities from video.
2. Competing models appear: frictional pendulum, driven linkage, hidden gear ratio or alternative topology, with predictive trajectories and uncertainty.
3. An AI scientist picks a mass/force/initial-condition experiment that best separates its hypotheses, then runs an instrumented simulator or authorized physical test.
4. Predictions and observations overlay, weak models fail, parameters and even model topology revise, and a new predictive controller can be generated.

## Essential capabilities preserved from the original portfolio
- `actual_mechanism_observation_and_evidence_ingestion` — retain across architecture changes; qualify through real consumer operation.
- `candidate_structural_and_parameter_model_discovery` — retain across architecture changes; qualify through real consumer operation.
- `reproducible_executable_physics_models` — retain across architecture changes; qualify through real consumer operation.
- `active_discriminating_experiment_design` — retain across architecture changes; qualify through real consumer operation.
- `actual_experiment_or_solver_execution` — retain across architecture changes; qualify through real consumer operation.
- `prediction_residual_based_model_revision` — retain across architecture changes; qualify through real consumer operation.
- `interactive_model_comparison_and_visualization` — retain across architecture changes; qualify through real consumer operation.

## System decomposition / independent parallel engineering
1. **Subsystem 1.** Real calibrated video/telemetry/encoder stream; segmentation, object/point tracking, joint candidates, external forces, temporal alignment and missing-data representation.
2. **Subsystem 2.** Hybrid symbolic graph/program search for body, joint, spring, drag, friction, actuator/contact and conserved quantity structure, combined with differentiable or derivative-free parameter optimization.
3. **Subsystem 3.** Executable numerical dynamics kernels and constraint solver; optional MuJoCo and Hamon native solver adapters with precise units and contact semantics.
4. **Subsystem 4.** Probabilistic posterior or model ensemble with identifiability tests, held-out prediction, priors, mismatch hypotheses and learned residual terms explicitly separated from laws.
5. **Subsystem 5.** Active experiment planner maximizing expected information gain under mechanical safety and cost constraints, using cloud/GPU search where useful.
6. **Subsystem 6.** Interactive lab workbench: proposed physical diagrams, uncertainty bands, trajectories, intervention controls and synchronized video-to-simulation visualizations.

For each subsystem establish source/data and control schemas, units/clocks/entity identities, provenance, explicit unknown/partial/error states, tests, resource constraints, versioned integration protocol and an actual consumer. Reuse Hamon Engine code only when it is technically appropriate; the independent product repo owns UI, orchestration, provider integration, models, QA and release. Parallel teams research alternatives without redefining original capabilities.

## Frontier science / serious validation
1. Blind unknown mechanism dataset with ground truth topology, quantitative forward prediction across altered loads and unseen starts.
2. Disambiguate observationally equivalent models with counterfactual experiment design; compare learned structure to fit-only baseline.
3. Evaluate numerical stability at contact transitions and out-of-distribution regimes; classify genuine discovery versus posthoc curve-fitting.

**Original hard-frontier ledger:** inferring_structure_not_just_fitting_known_parameters; identifiability_and_uncertainty; closed_loop_active_discovery; physics_transfer_and_model_generalization. Treat each unknown as a series of falsifiable experiments, alternative approaches and actual measurements; don't relabel unsolved capabilities as optional. If an engineering approach fails, change the approach; retain the original product promise.

## End-to-end acceptance and genuine visual demonstration
1. Real unseen mechanism observations produce competing executable models without hardcoding its topology.
2. At least one algorithmically proposed physical experiment falsifies/revises a model; posterior predictions improve on independent test.
3. Polished user-visible instrument/workbench showing exactly what the system learned and why.

**Preserved golden path:** Give unfamiliar mechanism observations -> propose competing models -> select informative experiment -> run it -> compare model predictions to measured outcome -> revise executable law -> demonstrate improved out-of-sample prediction.

Independent receiving must run the real app from an exact commit with licensed or controlled real source input, reveal actual relevant outputs, record logs/artifact digests and verify negative cases. Stage success is an intermediate integration milestone, not final scope closure. A math solver, CLI shrinker, MCP mock, static render or hand-authored source substitution does not pass the ultimate end-state.

## Quality and interaction ambition
Aim at cinematic/professional presentation, direct-manipulation feedback, useful unscripted agent controls, live causal/temporal inspection, correct persistence/restoration, beautiful but understandable visualization and meaningful errors. Plan CPU/GPU/network distribution around measured constraints; nontrivial performance work and scalability are product work, not optional demos. All ambitious features must remain visible in the backlog even when first demonstrated on a narrow rights-cleared fixture.

## Longer-horizon breakthroughs
Inductive science platform capable of composite physics, adaptive modeling, active robotic laboratory experiments and physically grounded system design, with auditable limits where short videos cannot identify unique laws.

## Delivery obligation / repo creation
A current, accountable integration owner creates `Jacob-Met/worldlaw` if it is missing, records legal/proprietary source and upstream rights, implements the entire running experience with domain specialists, performs fresh-machine validation, captures **actual** gameplay/app screen video and result measurements, makes exceptional UI/demo materials, gives judges correct source access and submits to the contest through legitimately authenticated available accounts with an official receipt. Physical Fire TV or real Alexa-only steps can be separately gated if inaccessible; GPU, PC microphones, emulators, provider sandboxes, multi-machine compute and valid simulation are usable immediately. Never call a blueprint, issue, fragment or test matrix the product.
