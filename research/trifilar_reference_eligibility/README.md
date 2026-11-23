# Trifilar reference-body release eligibility

The proposed experiment asks whether the amplitude of a recorded torsional release improves a prediction of the oscillation period for a separate, identified calibration mass. **The archived source does not establish the required comparison.** The version 4 archive has two example movies. One filename identifies the empty platform and the other says only `sample_data.mp4`. The records examined do not bind that second movie to an independent reference inertia, release ID, amplitude, mass configuration and wire geometry. No movies, period rows, tracker outputs or fitted inertias were opened. There are zero physical predictions and zero measured errors.

## What the release establishes

Stijnen and colleagues describe tracking marks on a platform from below and measuring objects with analytically known mass properties. The landing page reports repeat measurements under several camera and suspension conditions. The paper's abstract reports errors below 5% above 0.003 kg m² and a 7.2% difference for a distinct comparison. Those published aggregates were exposed during source selection. They supply neither individual trial labels nor calibration-body properties for the two example clips. The source screen concerns inert laboratory reference masses. [Version 4 catalog](https://doi.org/10.17632/zww548rfbn.4) · [HardwareX article](https://doi.org/10.1016/j.ohx.2026.e00821)

| Published archive | Bytes | ZIP entries | Movie roster |
|---|---:|---:|---|
| v4 | 21,961,363 | 26 | Two example movies |
| v5 | 26,721,065 | 31 | Same two example names and one software sample |
| v6 | 30,510,742 | 33 | Same three names plus a software self-test movie |

The v4 example platform file is 9,605,059 bytes, CRC32 `bd2e34e9`. The sample is 2,953,137 bytes, CRC32 `a45f4f74`. Those lengths, CRCs and compressed lengths recur for the corresponding entries in v5 and v6. The software sample in both later versions has the same three header fields as the example sample. This is evidence against counting it as a new release. A CRC comparison alone cannot prove byte equality. The v6 self-test movie has no independently documented physical calibration event in the records examined. The catalog comparisons use only the ZIP end record and central directory, with the HTTP byte-range start, end and total size checked. The archive bodies were never downloaded as whole files. Per-version directory hashes and every non-design entry are in the original version-comparison receipt.

The v4 CC BY 4.0 catalog lists its measurement procedure, database guide and two equipment documents at the root. The procedure calls for a rotation under 10° separately for the empty platform and the test. The database guide names the apparatus and software without a per-run reference roster. The source archive includes eight entries under design files and twelve under software. The source reader succeeded on the guide and procedure. Two subsequent attempts to inspect software member text ended in DNS resolution failure before receiving metadata on their assigned worker. An institutional article request returned HTTP 500. The independent stdlib ZIP receiver's DNS failure remains in the record. The successful v4-only and three-version directory inspections used the same parser, and neither certifies the contents of uninspected files. An authenticated mapping supplied by the authors could change the eligibility decision.

## Conditional mechanics and required measurements

For three equal, inextensible wires of length `L` with corresponding anchors on concentric circles of radii `r` and `R`, define `P = R r`, `z0² = L² − (R−r)²` and `z(θ)² = z0² − 4P sin²(θ/2)`. A level platform in pure yaw rises by `h(θ) = z0 − z(θ)`. For total mass `m` and vertical-axis inertia `I`, the kinetic energy is `[I + m h′(θ)²] θ̇²/2`. This yields the conservative period at release from rest at amplitude A, wherever z stays positive.

```text
T(A) = 4 integral[0,A] sqrt((I + m h'(θ)^2) / (2 m g [h(A) − h(θ)])) dθ
T(0) = 2π sqrt(I z0 / (m g P))
T(A)/T(0) = 1 + A² [m(P/z0)²/(4I) + 1/16 − 3P/(16z0²)] + O(A⁴)
```

Amplitude is in radians. The two models agree as the amplitude tends to zero. The procedure's 10° upper bound gives `A² < 0.03047`, which multiplies a geometry- and inertia-dependent coefficient. This alone supplies no predicted improvement or uniform percentage limit. A comparison would require independent geometry and total inertia for the empty and loaded platform, a clock and angle scale, damping assessment, whole independent releases and a sample split fixed before motion access. A calibration-free finite-amplitude prediction would need to beat both the author's small-angle formula and the same-information empirical amplitude control. Published nonlinear trifilar analysis already studies this amplitude dependence. [Prior analytical and experimental study](https://doi.org/10.1016/j.mechmachtheory.2020.104157)

Partitioning frames or cycles from the sample movie cannot provide a second physical release. The catalog also cannot distinguish wire stretch, camera timing error, lateral swing, tilt or eccentric loading from a discrepancy in this simplified yaw model. No physical model was selected or scored.

## Replay

Run `python3 replay.py .` in this directory to authenticate the successful terminal outputs, check file membership and compare the per-version movie headers. `archive_roster.py` reads the public v4 ZIP end record and directory when rerun. The original v4 metadata-only job and the separate three-version job both exited zero with drained descendants. The receipt also retains the unsuccessful acquisition paths. The offline replay does not decode video or infer new physical trials.
