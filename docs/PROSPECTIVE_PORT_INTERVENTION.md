# WORLDLAW prospective motor-port intervention

**Status:** executable offline intervention planner and separately received command/readout gate. No motor was actuated or connected. This is a new *prospective* route, not a rebranding of the earlier 50-run historical DFKI replay.

## The decision that is now executable

In **Coupling Lab → Design the command, not just the clock**, enter one initial encoder state `[q1,q2,dq1,dq2]` and explicit bounds for peak torque, absolute impulse, maximum torque slew, future angle-readout radius, time grid, and horizon. The planner generates 24 predeclared, ramped waveform candidates (hold, one-cycle sine, two-cycle sine, late onset; each sign; three amplitude levels). It discards commands outside all declared effort bounds. The two candidate *mechanical* laws receive the **same entire proposed torque history** but differ in which motor it energizes.

For every admitted command the existing DFKI-parameter double-pendulum RK4 solver predicts both angle trajectories. A second computation halves the integrator step to inspect numerical sensitivity. The planner chooses the *earliest sampled observation* where the Euclidean wrapped-angle distance exceeds twice the sum of the **declared encoder radius** and the observed **integration-step discrepancy**. Tie-breaks maximize separation margin and then reduce integral absolute torque. This is a **finite catalog** under user-declared constraints, not a proof of a globally optimal or physically safe control.

The exported JSON contains an original initial state, constraints, **full command for the future** and one **frozen future observation time**. The planner never accepts future encoder samples. Changing any initial state or constraint retires the previous proposal. The source-to-source model comparison reuses the maintained `src/coupling/actuator-port.mjs`, not a parallel physics solver.

A receiving operator must supply the complete *delivered* time/torque sequence independently logged by the actuator and **exactly one** two-angle encoder snapshot at the frozen time. `receiveProspectivePortObservation` recomputes the proposal from its source, refuses any altered cached forecast or command trace, and classifies **shoulder**, **elbow**, **ambiguous**, or **model-inadequate** using the declared acceptance disks. It does not force a winning port merely because one residual is smaller. The UI can illustrate the shoulder-model forecast without passing that illustration off as measured evidence.

## Frozen scientific controls

- **Initial-state-only custody:** the planner rejects a supplied `futureEncoderReadings` field; it never has access to measurement outcomes.
- **Command/cost constraints:** candidate stimulus and observation clock are deterministic, normalized, numerically bounded and checked against amplitude, slew, impulse, horizon and assumed readout precision. Over-restricted designs abstain.
- **Numerical qualification:** the same command is solved with RK4 max steps of 0.005 and 0.0025 seconds; the witness clock must pass a local step-sensitivity screen. This is *not* a bound on physical-model error.
- **Independent oracle:** frozen synthetic starts use a separately coded high-resolution two-link RK4 implementation, with deterministic bounded angle perturbations, rather than scoring against the exact arrays returned by the planner.
- **Out-of-family null:** a separately implemented split drive energizes both joints simultaneously. Neither pure shoulder nor pure elbow must be presumed true; the receiver is allowed to report model inadequacy.
- **Shuffled-label null:** port labels are replaced with independently SHA-256-assigned labels, with the same experimental predictions, to test information leakage.
- **Delivery negative controls:** a changed sample of the actual command array, different observation clock, forged plan, nonnumeric coordinates, and data outside both predicted disks produce refusal or model-inadequacy states. They cannot be silently interpreted as successful positive identifications.

Run:

```bash
node --test tests/prospective-port.test.mjs tests/actuator-port.test.mjs
npm run verify
node scripts/prospective-port-browser.mjs  # optional: real sandboxed installed Chrome
```

The source-pinned native receiving adapter is `make test-prospective`. Do not confuse the model-matched in-family simulation metric with measured hardware accuracy. The original historical RealAIGym observations used unplanned closed-loop commands; a physically delivered prospective waveform and calibrated sensor/noise model are the next independent receiving requirements.

## Scientific limitations and falsifiers

The output is conditional on the DFKI model and on the two **offered** port assignments. Unmodeled friction, motor delays, backlash, gear response, saturated commands, sensor biases, arbitrary loads, or torque delivered at *both* joints can invalidate both offered predictions. The explicit out-of-family state is a necessary failure channel, not a complete open-world discovery engine. Time-grid agreement is a numerical check, not an uncertainty bound; the sensor radius is user-declared, not independently calibrated.

No webpage or CSV import here proves executed torque, accurate motor currents, a safe physical configuration, encoder synchronization, a previously unseen mechanism, or independent custody. The JSON-driven receiver checks declared trace identity but is **not a secure hardware attestation**. Real control requires independent hardware approval, certified actuation bounds, and timestamped trace acquisition. Until such a test exists, every reported success is a controlled **synthetic** identification and every physical claim remains unverified.

## Distinction from historical replay

The original `schedulePortObservations` historical replay can use the whole recorded **command** sequence and freeze an observation time, but has no role in designing that prior command. This new path chooses the **command itself**, on the initial state alone, and exports it to be executed later. The 50 previously published hardware runs do not retroactively validate these prospective commands. The two experiences remain separate and clearly labeled on the same product page.
