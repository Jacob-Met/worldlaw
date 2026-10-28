# Receive original calibration reference evidence

In the existing shared-calibration inquiry, open an original two-standard JSON report. Inspect the original instrument, standards and correction bounds, then supply the acquisition-log basis and explicitly associate that instrument with **every original training row**. The action fills the existing declaration. Search remains explicit; original fitting, ranking, observations and actual challenge associations do not change.

The report is source evidence supplied by the user, not an authenticated certificate. Its entire admitted source and association are retained by public certificate export/replay and independently validated against the derived declaration. Editing the report identity, bounds or association invalidates old certificates. A pending file cannot overwrite a later source edit.

Supported schema `worldlaw.two-reference-report/v1`:

```json
{"schema":"worldlaw.two-reference-report/v1","reportId":"original-cal-17","instrumentId":"torque-bridge-A","units":"N·m","standards":[{"id":"zero","reportedTorque":0,"referenceTorque":0,"absoluteError":0.001,"basis":"Original absolute correction bound"},{"id":"two","reportedTorque":2,"referenceTorque":2,"absoluteError":0.001,"basis":"Original absolute correction bound"}]}
```

This initial intake deliberately admits only zero-centered correction intervals: nominal reference torque must equal reported torque. Nonzero nominal corrections, other units, incomplete or reversed standards, and correction boxes permitting a nonpositive readout factor refuse. They are not silently symmetrized, converted or inferred. Bounds remain engineering declarations, not measured accuracy or probability distributions. The maintained shared-calibration numerical qualifications and independent refit/checker remain authoritative.

Reports are at most64KiB; two standards, bounded identifiers/bases and finite admitted values are validated before use. One received report covers all original rows; partial partitions require the existing explicit declaration route instead. Actual challenge readings remain independently bounded unless the user separately supplies complete original/actual calibration association and separately sourced residual bounds.

## Executed receiving

31 focused native controls passed, including four report-intake controls and27 maintained calibration controls. Five actual Chrome groups passed2026-10-28: keyboard draft/adoption, changed .001→.05 report bounds producing separation→witness, source-preserving public replay, nonzero-correction refusal, and delayed-file retirement. Desktop1280×1000 and narrow390×844 captures were inspected. Active namespace/PID/network/seccomp/TSYNC admission and owned-family exit were observed; the profile was retained.

The versioned receipt binds exact product/receiver/runtime hashes. Its inherited runner's descriptive sourceIdentity still names393; the explicit sourceBinding records the received417 calibration composition plus this change. This is actual Studio consumer evidence, not a claim that every unrelated current repository page was exercised.
