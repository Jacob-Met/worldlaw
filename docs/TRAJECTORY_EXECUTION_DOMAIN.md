# Declared position bounds and the refined trajectory

The existing torque and angular forecast routes accept an optional `positionDomain: [lower, upper]`. It constrains every evaluated numerical position: the supplied initial state, all RK4 derivative stages, the weighted final state, and contact-drive/event-search trial states. Bounds are inclusive and copied on admission. Both endpoints must be finite, strictly ordered and within the solver's existing ±1e6 state bound.

This option addresses a concrete research integration need: a model qualified only over an explicit angle range must not be evaluated outside that range while being transferred into the ordinary solver. The maintained angular model already represents a frozen q/v-fitted sine law with explicitly unknown physical inertia and torque scale. The new option carries its execution restriction into the shared solver without introducing another dynamics engine.

## Use the ordinary angular route

```js
const result = rolloutAngularWithResolution(model, run, {
  maxStep: 0.0025,
  maxSteps: 199999,
  positionDomain: [-2, 2],
  includeRefinedRollout: true,
});

if (result.resolution.status !== 'compared' || result.refinedRollout === null) {
  // Preserve the coarse evidence and explicit unavailable reason.
  // The requested refined result is not available for scoring.
} else {
  const refined = result.refinedRollout;
  // These are the actual maxStep/2 rows from the completed comparison.
}
```

The same options work through `rolloutWithResolution` for known-inertia torque models. A direct `rollout` or `rolloutAngular` accepts `positionDomain` without requiring a resolution comparison.

`includeRefinedRollout` is an optional boolean. When true, a successful comparison returns the actual completed `refinedRollout`. An unavailable refinement returns `refinedRollout: null`. `rollout` continues to contain the coarse result. When the option is omitted or false, the extra property is absent. Retaining the fine result performs no third solve and does not increase the shared coarse-plus-refined step budget.

## Execution and evidence are separate

The execution domain is an explicit caller declaration. The solver does not turn a model's observed training range into a validity guarantee or silently derive this option from model metadata. Source units, original coordinate zero, initial rate and model terms keep their existing admission rules.

Later observed positions remain residual targets under the existing finite/global bounds. They never reset the predicted state and are not restricted by this execution option. A caller can compare a bounded model prediction with a later observation outside the declared execution interval; that discrepancy remains evidence rather than changing the model's numerical path.

An out-of-domain numerical state throws `TrajectoryRolloutError` with code `position_domain`. If the coarse solve refuses, no completed rollout is returned. If a completed coarse solve is followed by a refinement-only domain refusal, resolution is `unavailable` with reason `refinement_execution_refused` and the typed failure; requested fine output is null. Missing refinement is never reported as agreement. Initial states are checked even when Coulomb contact would otherwise hold without any smooth integration step.

These checks concern the states actually evaluated by the numerical method. They do not prove continuous physical containment between samples, locate an exact boundary crossing, or establish that an event-search trial state is physically reached. Smaller steps may change a numerical refusal. Domain admission, two-resolution agreement and physical model validity remain distinct.

## Receiving

The independent six-group source is published as `tests/trajectory-position-domain.test.mjs`. Its bytes match the independently executed review test. Controls include an internal stage escaping while a coarse endpoint is inside, a weighted final state escaping after valid stages, a real coarse-success/fine-refusal harmonic case, inclusive bounds, malformed declarations, input immutability, future-target independence and shared-budget/refined-output behavior.

Six existing maintained test files were also executed, covering scalar/angular execution and resolution, Coulomb event discrepancies, and the predictive coefficient-refinement consumer. Their existing output and numerical behavior remained supported in this scoped receiving. The maintained Trajectory Challenge browser course completed 21 checks once, including resolution/budget refusal, measured-model failure handling, source import, portable export/reopen and stale-input retirement. Chrome 156.0.8078.73 ran as a non-root process with verified Namespace and Seccomp sandboxing; no JavaScript page errors or external requests were recorded. The source-only browser receipt retains exact source and harness identities; private screenshots and downloads are excluded.

`tools/receive-pasco-qv-sine.mjs` receives the frozen public PASCO recording-transfer experiment through `normalizeAngularBundle`, `worldlaw.angular-model/v1`, `rolloutAngularWithResolution` and the shared solver. Set `PASCO_RESEARCH_ROOT` to the complete preserved experiment package. The tool pins its protocol and selection hashes, rehashes all three original public CSVs, preserves the original 4,002 training and 2,001 challenge position/time nodes, and maps only the already-selected sine coefficients. It performs no new fit or challenge tuning.

In the completed native receiving, every one of the 2,001 fine-step positions and rates matched the frozen research exactly. The shared method used 25,344 combined steps and scored 2,000 noninitial challenge rows at approximately 0.1673458079542472 rad RMSE. Unknown physical inertia and torque scale remained explicit. JSON input replay matched; late-target poisoning changed residuals without changing predictions; an initial state outside a requested interval refused.

This is a native real-input model/solver connection. It does not add the q/v fitter to the ordinary graphical model-selection controls, authenticate the publisher's acquisition, establish a physical law, or itself prove a maintained merge or installed release. The original source uncertainty, declared unforced-rotation assumption and numerical-versus-physical distinction remain in the receiving receipt.
