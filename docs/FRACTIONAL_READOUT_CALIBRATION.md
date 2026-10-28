# Fractional readout calibration in the retained inquiry

The original-calibration inquiry accepts `correction: "fractional-gain"` and `sameFractionalGain: true` on a complete original group. Its dimensionless radius is nonnegative and strictly less than one. Corrected torque is reported torque times `(1 + common fraction)`, plus any independently declared additive residual. Default additive groups remain unchanged. There is one shared group per original row, not simultaneous shared additive and gain groups on that row.

An actual challenge association to that group explicitly declares `sameFractionalGain: true`; additive associations retain `sameAdditiveOffset: true`. A null association keeps independent challenge error. Challenge radii describe separately sourced residual error after the correction, not automatically inferred total sensor uncertainty.

For original influence L and readings y, the latent column is radius times sum(L_i*y_i) over the group's rows. A shared actual readout subtracts radius times its reported torque from that column. The maintained bounded search/check primitives are unchanged. Witnesses retain bounded latent components, construct all actual original-row corrections, independently refit original readings, and apply the same component to associated challenge readings. Complete groups/row partition are validated before per-row preparation; all latent dimensions are charged.

Balanced original y=x predicts2 under any common additive correction. An original-only fractional correction +.02 explains actual2.04. Sharing that gain with the actual reading instead leaves discrepancy .0388–.0412 across ±.03, exceeding residual .001. Both signs, independent residual widening, invalid factors/partitions, source/component tampering and budget refusal have native controls.

This is a fixed-coordinate least-squares conditional inquiry, not measured calibration, a physical actuator gain estimate, fit adoption or prospective guarantee. Numerical allowances are engineering checks, not rigorous QR error bounds. Source-only replay rechecks original observations, declarations, associations and certificates. Original ranking/history remains unchanged.

## Reconstructed-source receiving, 2026-10-28

Base c0646ad6bff0dca3962fb5e5c4b61ab7f71db30a. Nine native groups passed. Actual Chrome receiving passed three product groups: file challenge and explicit gain distinction; independent residual witness with export/reopen; source-edit invalidation and incomplete/stale-source refusal. Keyboard activation and desktop/narrow layout checks ran; captures were inspected. Narrow witness table intentionally scrolls horizontally. No browser exceptions; active namespace/PID/network/seccomp/TSYNC, browser exit0 and family9 reaped, no children remaining; profile retained.

The current source was reconstructed after scratch loss; historical qualification is not asserted as byte identity. Fresh receiving payload SHA256 2c909052f99561d2ef660e5956160a0c19e2350704eced53b8c4cf54c18456e0. Maintained receiver SHA256225fe03edde82115dbd225d77c9002e1c12abf525e2d6d1db04badfeca3b3f5a. No physical validation or persistent deployment claim.
