# Original calibration offsets plus independent reading residuals

The existing original-calibration inquiry optionally accepts one ordered independent residual declaration per original training row: `{rowIndex, radius, basis}`. Leave this input empty to use the existing shared-calibration-only assumption. When supplied, every original row must be declared, including explicit zero bounds.

The original torque perturbation is `groupRadius * groupComponent + residualRadius * rowComponent`, with each component in [-1,1]. One group component is common to all rows in that explicitly declared calibration group. Residual components are independently bounded. The user supplies both sources; the application does not infer their independence, magnitudes, or calibration association from the residuals. Receiving/challenge bounds remain independently sourced, unchanged.

## Why the distinction changes the investigation

Eight balanced original readings follow `torque = 1 + command`. Two actual readings at command 2 and -2 are 3.03 and -1.01, each with achieved radius .001. A common original calibration offset ±.02 alone cannot change the slope enough; independent reading residuals ±.01 alone cannot accommodate the simultaneous offset and slope change. Each inquiry returns checked numerical separation. Their explicit sum admits an independently refitted common witness across both actual readings. This is conditional source analysis, not a choice of convenient noise or adoption of a new fitted law.

## Numerical and work custody

The same maintained original-data preparation, bounded linear-envelope search, separator checker, and independent full-row refit are used. Group influence columns and independent residual columns are concatenated. Search work counts every group plus every original row, including declared zero-width components; no subset is selected to fit the work budget. The unchanged original-row preparation bound applies separately. Combined per-row radii must remain within the maintained preparation limit.

Witness certificates retain all normalized components and the actual summed original-row offsets. Replay verifies every component bound, exact sum reconstruction, the complete source key, and a fresh independent fit of all original readings. Separating certificates use the complete concatenated envelope. Engineering floating-point allowances retain uncancelled original influence scale. They do not certify QR error, physical calibration, confidence, or law adequacy. Contact or exhaustion remains unresolved.

The original notebook, ranking, fixed-law challenge receipt and prospective promises are unchanged. No derived candidate is silently adopted. Changing either declaration or any achieved challenge source retires the nested result and pending certificate replay. Saved evidence contains the original source declarations and checked candidate; replay reconstructs all numerical evidence.
