# Request and receive a recovery readout population

The population-sensitivity inspector can freeze a next manual acquisition request: a waiting delay plus the original reference population's states and acquisition orders. The existing recovery interval-separation, paired waiting cost and budget policy chooses among offered delays. The original recovery planner still delegates to that same policy with its original fit. This feature does not expand the response family or operate an instrument.

## Actual workbench journey

Open the recovery population-sensitivity inspector, choose an original training reference and explicitly declare the three uniform contrast-sensitivity limits. Expand **Request a wait on the frozen reference population**, enter offered delays, requested combined screen radius, overhead and budget, then compare requests. The pair count is fixed by the reference population. Inspect every target pair, original state and order before saving a request.

The saved `worldlaw.recovery-population-plan/v1` document contains original training, reference/sensitivity assumptions and planning settings. It contains no authoritative cached predictions or target assignments. Opening it recomputes those from the original inputs; future challenge values never enter planning. Source or settings changes revoke receiving until recomputation. Late file reads cannot replace newer intent.

**Receive separate recording** takes the existing recovery-recording object: `recordingId`, `protocolId`, `delaySeconds` and `evidence` containing the original paired observations. Its delay must equal the selected wait. Original evidence admission, copy checks, protocol checks and chronology remain in the maintained recovery validator. Raw observations are appended without changing training.

The receiver independently checks actual acquisition order, pair count, population availability and combined observed radius. The combined radius includes the original readout screen plus the outward population allowance. It must be no greater than the requested radius; a requested value is never substituted for an observed width. Unsupported populations and excessive uncertainty remain visible as failed request checks, with original recordings retained. A different acquired population can still qualify if its conservative allowance fits the requested width; the target states are a requested design, not a fabricated equality assertion.

## Executed evidence and limits

The maintained persistent-rate control illustrates why population choice matters. At the same selected one-second wait, forty independently sampled authored courses use twenty new noise seeds on the target population and twenty on a changed population. With requested radius 0.1 N·m, all target courses meet the actual screen and leave persistence alone among the finite hypotheses. Every changed-population course incurs a 0.75 N·m population allowance, fails the requested precision and retains four hypotheses. Every target course also fails the more optimistic 0.03 N·m precision request. The frozen training fit stays identical through receiving.

These are software controls with declared synthetic truth and sensitivities, not measured calibration, achievable physical precision or causal identification. Candidate survival means only not excluded by the conditional interval bounds; the transport inspector does not construct one physical response consistent with every state. The same-delay interpretation and all prior population-sensitivity qualifications remain in force.

Focused checks:

```sh
node tests/recovery-planner.test.mjs
node tests/recovery-population-planner.test.mjs
```

The actual browser receiver is `scripts/recovery-population-planner-browser.mjs`, using the existing externally supplied sandbox-admitted browser-session helper. It exercises real file intake/download, wrong-population and overoptimistic-width failures, source-only reopen, keyboard expansion, narrow layout and delayed-intake invalidation. It launches the maintained product server and does not disable the browser sandbox.
