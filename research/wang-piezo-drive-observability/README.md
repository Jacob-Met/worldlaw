# What the Wang piezoelectric records identify

The released v9 archive contains five displacement recordings, two voltage designs for a separate identification experiment, and three fitted Preisach density matrices. None of the 18,373,080 displacement rows includes a drive-voltage measurement. This prevented a matched voltage-to-position comparison of the author’s rate-independent model, that model with a shared dynamic drive stage, and a rate-dependent actuator model. **No displacement values were converted to numbers or used to estimate a phase, time shift, reset, gain or model score.** The archive resolves the position instrument’s sample spacing precisely. It leaves the signals and initialization needed to run the comparison unresolved. [Wang et al., data and file definitions](https://doi.org/10.17632/kzf668wggx.9) · [Authors’ model and experimental overview](https://doi.org/10.2139/ssrn.4254610)

## Acquisition and calibration records

The digital archive is 98,478,148 bytes, SHA-256 d5f820a3c94223d201ab3c890b0e1203899c044dacfb00ed29e0af4ea8707fae. Each recording has exactly two nonempty fields per row. The first is elapsed seconds since that file’s own time zero. The second is the position instrument’s output in pm. Every timestamp was checked against the exact 500 kHz sample grid. The acquisition starts below are publisher clock labels; a time zone or voltage-generator trigger was not established.

| Role | Filename | Acquisition start, 2022 | Position rows | Last elapsed time, s |
|---|---|---|---:|---:|
| Uncompensated | ex_sin4hz.csv | Aug 31, 09:47:43 | 5,521,131 | 11.042260 |
| Uncompensated | ex_sin100hz.csv | Aug 29, 16:43:12 | 3,048,540 | 6.097078 |
| Uncompensated | ex_multifreq.csv | Aug 29, 16:45:40 | 4,133,943 | 8.267884 |
| Feedforward-compensated | feedforward_4hz.csv | Oct 17, 10:31:57 | 3,233,703 | 6.467404 |
| Feedforward-compensated | feedforward_100hz.csv | Oct 17, 10:33:34 | 2,435,763 | 4.871524 |

The three August channels are named `Noname 1`. The two October channels are named `PZT`. The first clock receiver required the August label throughout and stopped at the first October file. The complete receiver checks the literal label for each role and keeps the two measurement campaigns separate. An October trace acquired with compensation changes the command supplied to the actuator; it cannot stand in for a simultaneous voltage probe on an August recording.

Both voltage files contain one column of specified commands ranging from 0 to 5 V and starting and ending at zero. The 50-level program has 500,050 samples and 99 reversals. Its 100-level counterpart has 1,000,100 samples and 199 reversals. These are the author’s designed triangular identification sequences. Neither file contains timestamps or a synchronous displacement signal. Neither supplies the sine or multifrequency voltage applied during one of the five displacement acquisitions. The publisher describes the voltage data as preceding amplification. The archive supplies no separate actuator-terminal voltage, amplifier transfer calibration, voltage-generator trigger or recorded prehistory for the five acquisitions. In particular, a zero at the beginning of one identification design does not establish the relay states of a later sine acquisition.

The original MATLAB files do contain the authored fitted numerical arrays. Independent MATLAB-v5 decoding reproduces every coefficient byte in column-aware order. The triangular support and coefficient signs below are inventory facts. Signed fitted coefficients establish neither a negative physical population nor an error in the author’s model.

| MATLAB file | X shape | Nonzero coefficients | Negative coefficients |
|---|---:|---:|---:|
| Df_50.mat | 50 × 50 | 1,275 | 442 |
| Df_100.mat | 100 × 100 | 5,050 | 2,161 |
| Df_50_compared.mat | 50 × 50 | 1,275 | 476 |

Each file also declares an opaque MATLAB `sfit` object. A generic `whosmat` inventory failed on that object. Selecting only `X` and independently parsing its numeric matrix succeeded. The study does not claim to execute the opaque object, recover its threshold convention or reproduce the authors’ reported identification and compensation scores. Direct requests to both linked manuscript endpoints returned HTTP 403 during this qualification. The file-level result applies to the authenticated v9 release.

## A rate-dependent loop does not locate the dynamics

Write the command as u, the amplifier or drive dynamics as G, and a rate-independent Preisach map as P. An actuator with response P driven by G yields y=P[G[u]]. With the same initial states, an ideal drive and an actuator operator defined as A[u]=P[G[u]] return the same position history for every command. The identity holds for the authored P as well as for a single relay. It distinguishes the two physical interpretations only when an intermediate observation or independently justified model constraint distinguishes them. A missing command also prevents the more modest end-to-end comparison on a common measured voltage path. Even a known sinusoid frequency supplies neither its measured amplitude and offset nor its phase on the position clock.

For an exact finite illustration, use the command (0,5,5,0,0,0), a stable filter v[t]=(v[t−1]+u[t])/2 starting at zero, and a relay turning on at 3 and off at 1, initially off. The filtered sequence is (0,5/2,15/4,15/8,15/16,15/32). Both assignments of the filter yield the same relay output (0,0,1,1,0,0). The receiver verifies this independently by summing the filter’s impulse response. These are constructed values, with no use of experimental positions.

A memoryless linear actuator supplies a second example. Drive it through G(s)=1/(1+sτ) with a sinusoid of amplitude a. The steady-state magnitude of the loop integral |∮y du| divided by πa² is x/(1+x²), where x=2πfτ. With τ=1/(2π·100 Hz), the normalized areas at the two nominal recording frequencies, 4 and 100 Hz, are 25/626 and 1/2. The 12.52-fold difference follows entirely from the chosen drive dynamics. The example makes no estimate of the actual amplifier’s time constant, gain or delay.

The preregistered test would have used the complete uncompensated 4 Hz recording for development and retained the complete 100 Hz recording for transfer, conditional on a common voltage path, documented initialization or saturation, and calibrated drive timing. These requirements failed before either position series was opened. A comparison based on retrospectively aligning the held displacement would use information outside this protocol. The physical performance of all three proposed models remains unassessed.

## Reproduction

Run with Python, NumPy, SciPy and access to the author’s published archive. The optional `--archive` argument accepts the same SHA-256-checked download. The receiver obtains all five timestamp grids, both identification commands and the three parameter matrices, then repeats the every-row clock and parameter checks with an independent reader. No experimental position magnitudes are used. Raw data are available from the publisher under its stated CC BY-NC 3.0 terms. [Author archive](https://data.mendeley.com/datasets/kzf668wggx/9)

```sh
uv run --no-project --with numpy --with scipy python research/wang-piezo-drive-observability/replay.py /tmp/wang-piezo
```
