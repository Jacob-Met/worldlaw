# Receive original calibration reference evidence

In the existing shared-calibration inquiry, open an original two-standard JSON report. Inspect the original instrument, standards and correction bounds, then supply the acquisition-log basis and explicitly associate that instrument with **every original training row**. The action fills the existing declaration. Search remains explicit; original fitting, ranking, observations and actual challenge associations do not change.

The report is source evidence supplied by the user, not an authenticated certificate. Its entire admitted source and association are retained by public certificate export/replay and independently validated against the derived declaration. Editing the report identity, bounds or association invalidates old certificates. A pending file cannot overwrite a later source edit.

Supported schema `worldlaw.two-reference-report/v1`:

```json
{"schema":"worldlaw.two-reference-report/v1","reportId":"original-cal-17","instrumentId":"torque-bridge-A","units":"N·m","standards":[{"id":"zero","reportedTorque":0,"referenceTorque":0,"absoluteError":0.001,"basis":"Original absolute correction bound"},{"id":"two","reportedTorque":2,"referenceTorque":2,"absoluteError":0.001,"basis":"Original absolute correction bound"}]}
```

Each reference-minus-reported value is now retained as a fixed nominal correction center. The two centers and their independently declared correction bounds define one affine correction; signed extrapolation uses those same sources. Other units, incomplete or reversed standards, and correction boxes permitting a nonpositive readout factor refuse. Nonzero centers are never silently symmetrized, converted or inferred. Bounds remain engineering declarations, not measured accuracy or probability distributions. The maintained shared-calibration numerical qualifications and independent refit/checker remain authoritative.

Reports are at most64KiB; two standards, bounded identifiers/bases and finite admitted values are validated before use. One received report covers all original rows; partial partitions require the existing explicit declaration route instead. Actual challenge readings remain independently bounded unless the user separately supplies complete original/actual calibration association and separately sourced residual bounds.

## Executed receiving

31 focused native controls passed, including four report-intake controls and27 maintained calibration controls. Five actual Chrome groups passed2026-10-28: keyboard draft/adoption, changed .001→.05 report bounds producing separation→witness, source-preserving public replay, nonzero-correction refusal, and delayed-file retirement. Desktop1280×1000 and narrow390×844 captures were inspected. Active namespace/PID/network/seccomp/TSYNC admission and owned-family exit were observed; the profile was retained.

The versioned receipt binds exact product/receiver/runtime hashes. Its inherited runner's descriptive sourceIdentity still names393; the explicit sourceBinding records the received417 calibration composition plus this change. This is actual Studio consumer evidence, not a claim that every unrelated current repository page was exercised.

## Nonzero nominal corrections

The fixed nominal center shifts the inquiry baseline; only the declared uncertainty components are searched. The witness retains total original-row corrections and independently refits the original rows. If actual readings explicitly share the calibration report, their same nominal centers and uncertainty components apply as well. This is an inquiry about a conditional model family, not automatic recalibration or adoption of a new fitted law.

Five new centered-report controls plus31 predecessor controls pass. The real file-import course passes six groups, including nonzero-center independent-source witness versus shared-source separation, source replay and stale-file retirement. The original zero-centered-only receiving receipt is retained as historical evidence; the new centered receipt binds the successor source.

Large extrapolation can cancel large opposite nominal interpolation terms. The checker therefore retains the sum of their absolute magnitudes in both separation and independent-witness numerical allowances. A high-readout1e-8 receiving box remains unresolved when its numerical allowance exceeds the requested precision. This is still a disclosed engineering guard, not a formal floating-point proof. Legacy no-center/no-actual-association tolerance behavior is preserved.

## Additional original check standards

An optional `checkStandards` array retains1–16 additional separately identified standards, using the same fields as each defining standard. The original `standards` pair remains fixed. All check standards constrain the **same two correction values**, rather than receiving independently favorable calibrations. Identifiers must be distinct across the complete report.

Before report adoption, the maintained exact rational half-plane helper intersects the two original correction intervals with all additional standard constraints. Empty intersection means that the supplied calibration sources contradict one affine relation; no law verdict or report adoption is returned. Nonempty intersection is only non-exclusion under this declared affine model and supplied binary64 bounds, not authentication or physical adequacy.

The law inquiry then retains every additional standard as a condition on the existing latent correction pair. Complete actual receiving rows and calibration conditions share a128-condition admission limit, and all latent matrix work is charged through the maintained search. A public witness checks every original standard as well as independently refitting original training rows; a separator covers the complete joint conditions. The result labels actual receiving rows separately from calibration standards and does not attribute a joint failure to a particular physical cause. Zero-width boundary contact remains unresolved by the numerical strict-witness checker.

Grounding: endpoint correction bounds±.1 at readouts0 and2 separately admit checks at .5 with+.08±.001 and1.5 with−.08±.001; no single affine pair receives both. Changing the second correction to+.08 restores source consistency. Separately, an additional midpoint check can exclude a law-family witness otherwise allowed by the endpoint box. Four new controls plus36 predecessor controls pass; the nine-group actual browser course covers import, explicit adoption, joint contradiction, changed-source outcomes and public replay.
