# Product acceptance and source of truth

Status: independently received runnable increment on 2026-10-19. The application completes a bounded observation → competing models → proposed experiment → measured outcome → revision → held-out comparison loop. Receiving used declared synthetic mechanisms, imported fixtures, and a real browser. Physical mechanism acquisition, unrestricted law discovery, human acceptance, category qualification, and official submission remain open.

## Full user story

Give unfamiliar mechanism observations -> propose competing models -> select informative experiment -> run it -> compare model predictions to measured outcome -> revise executable law -> demonstrate improved out-of-sample prediction.

## Integration owner
The HAMON team `288492d6ffef` root integrates this first runnable increment. The direct `worldlaw_models` worker produces the scientific modules and independently receives the root-owned application. Ownership is limited to this increment; repository-wide work remains open to complementary contributors. Coordination is recorded in [issue 1](https://github.com/Jacob-Met/worldlaw/issues/1).

## Clean build, sample inputs, actual output
With Node.js 20 or newer, run `npm start` and open `http://127.0.0.1:4193`. No npm installation is required. Run `npm run verify` for the native tests and real launched-server smoke. Optional `npm run browser` uses separately supplied Playwright and Chrome paths; see the README.

The default notebook contains 64 fitting rows and 61 fixed held-out rows from a separately implemented virtual instrument. In the received default run, one proposed observation changed the selected restoring structure from spring to gravity and reduced held-out RMSE from 1.645293629135742 to 0.0009572816573700754 N·m. This is an observed synthetic result, not a physical experiment or a general accuracy guarantee.

See [receiving evidence and limits](RECEIVING_20261019.md), [scientific details](SCIENTIFIC_CORE.md), [telemetry conversion](TRAJECTORY_ADAPTER.md), and [runnable source distribution](DISTRIBUTION.md). Exact published commit/tree and archive pins belong in the integration and distribution receipts. Source-local commits reconstructed before publication are not represented as remote history.

## Current integrated coverage

| Capability | Demonstrated increment | Remaining scope |
| --- | --- | --- |
| Evidence ingestion | Validated CSV/JSON observations with declared units, portable provenance, held-out rows, and a calibrated trajectory adapter | Real sensor/vision acquisition and independently verified physical datasets |
| Structural discovery | Selects subsets of seven declared torque terms and estimates their parameters | Discovery beyond the finite term library and broader mechanism classes |
| Executable models | Browser-consumed prediction and RK4 trajectory simulation with explicit refusal states | Fidelity against independently measured physical trajectories |
| Active experiment design | Ranks declared candidate inputs by disagreement between plausible models | Safe hardware execution, continuous design spaces, and calibrated uncertainty |
| Experiment execution | Executes the independent virtual instrument; imported sources accept supplied measured outcomes | Physical actuator/instrument integration |
| Revision | Appends evidence, refits, compares fixed held-out predictions, undoes, and replays notebooks | Transfer across real mechanisms, drift adaptation, and broader falsification |
| Interactive comparison | Actual plots, model inspection, solver-driven scene, keyboard controls, imports, downloads, and mobile layout | Human usability acceptance and richer mechanism representations |

The full-vision checkboxes below remain open. The bounded results above do not redefine those requirements as complete.

## Vision requirements

- [ ] actual_mechanism_observation_and_evidence_ingestion
- [ ] candidate_structural_and_parameter_model_discovery
- [ ] reproducible_executable_physics_models
- [ ] active_discriminating_experiment_design
- [ ] actual_experiment_or_solver_execution
- [ ] prediction_residual_based_model_revision
- [ ] interactive_model_comparison_and_visualization

## Research obligations

- [ ] inferring_structure_not_just_fitting_known_parameters
- [ ] identifiability_and_uncertainty
- [ ] closed_loop_active_discovery
- [ ] physics_transfer_and_model_generalization

## Submission
Not submitted. Complete official category requirements, demo video, and confirmed contest receipt.
