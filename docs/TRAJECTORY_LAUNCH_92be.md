# Trajectory launch and source delivery

## Open the product

Run `npm start` in the extracted source folder, then open `http://127.0.0.1:4193`. The header provides Studio, Motion Lab and Trajectory Challenge access on one local origin. No runtime dependency installation is required. Trajectory examples load from the same server; browser notebook storage stays local.

In Trajectory Challenge, open the small-angle example to see how a training-leading spring approximation fails on a separate wide-angle recording. Open the measured pendulum example to compare the retained cumulative failure with the experimental window fit. Inspect source identities and unknown physical inertia before interpreting the equations. Saving and reopening a notebook recomputes its model claims from recorded input.

## Accepted source and bounded integration

PR 4 merged as `1817f043091ce75c6bbf2a081e1a30da447a5808`, tree `802c6455abd2df4522efc11037b710754ab05dbf`. PR 6 merged as `d63d31f8981d38ef0307dd3fc4f8e2806a9fb223`, tree `bd729af69504541e8aa075bc48709449ba3fd23e`. Those compositions preserve the accepted studio and Motion implementation.

This launcher increment adds a navigation link, explicit trajectory/example routes, named launch/build/browser scripts, actual served-route smoke coverage, and package inclusion/required entries. The package preserves raw measured CSVs, complete license, reproducible extraction, source receiver and scientific audit. It does not infer a physical torque scale. Current published source and independent review remain in [WORLDLAW issue 1](https://github.com/Jacob-Met/worldlaw/issues/1).

The unchanged core composition passed 147 native tests and actual studio/trajectory server receiving. Final launcher, archive, extracted-server and browser results are tied to the exact commit/tree in the launch PR and versioned distribution manifest. GitHub Actions is unavailable; only direct native/browser execution is reported.

## Receive a source package

Run `npm run verify`, then open the actual standard server. Follow the header link, load the measured example, observe the cumulative failure, run the window fit and reopen its notebook. Confirm that Motion Lab and the original studio still open. The source receiver is `node examples/physical-pasco-92be/receive.mjs`; it verifies raw source hashes and preserves the measured failure.

A valid ZIP must contain the full source manifest, `examples/physical-pasco-92be/raw/` CSVs, dataset license, extraction and receiving scripts, and `research/PHYSICAL_TELEMETRY_92be.md`. Verify every manifest digest after extraction, then repeat the real launch. See [distribution instructions](DISTRIBUTION.md) for exact-commit and independently verified-tree packaging.

## Limits remain visible

The measured window fit has approximately 0.323 rad reused-challenge error and substantial training mismatch. The finite library does not identify arbitrary topology, unseen apparatus, calibrated uncertainty, or a generally valid physical law. Synthetic solver evidence and real recorded evidence stay distinguishable. The active trajectory acquisition/numerical-screen work is a separate subsequent source increment.
