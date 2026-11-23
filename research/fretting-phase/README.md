# Fretting hysteresis and instrument phase

**The released experiment does not admit the proposed same-contact, three-peak test.** Fantetti and colleagues assigned a fresh specimen pair to each loading condition. Repeated loops at one setting follow a wearing contact. The release provides two independent rigs, each at one operating frequency. The acquisition and processing sources examined here do not establish a differential phase calibration between friction force and relative displacement. We therefore leave all experimental loop outcomes unscored.

## Which experiments are present?

| | Imperial College London | Politecnico di Torino |
|---|---|---|
| Fixture | One contact leg, rigid approach | Two contact legs, self-alignment |
| Excitation and acquisition | 100 Hz and 60 kHz | 175 Hz and 100 kHz |
| Nominal peak-to-peak motion | 1, 14, 24.5 µm | 1, 14, 50 µm |
| Initial roughness | 0.5 µm | 5 µm |
| Raw and processed specimen folders | IC1–IC34 | 3–46 except 9 and 23 |
| ZIP entries / raw files / MATLAB source files | 25,183 / 16,693 DAT / 11 | 12,731 / 6,096 TDMS / 31 |

The paper reports 80 pairs. The 76 identifiers above have directories in both the raw and processed trees. The status of the four absent numeric PoliTO IDs (1, 2, 9, 23) is unresolved. The paper records one loading combination per fresh pair and 2.5 hours per main test. Reassembly repeats retain the pair identity. Stated peak sliding velocity agrees at 7.70 mm/s for one pair of between-rig settings. Fixture, initial surface roughness and operating frequency still differ. The authors report that a preliminary frequency investigation depended strongly on individual rig dynamics. The methods text gives 253 N where the detailed test matrix gives 254 N.

Both labs aimed laser Doppler vibrometers close to the interfaces and measured tangential force through load cells connecting the holders to ground. The reported 0.05 µm displacement accuracy leaves relative force/displacement phase unspecified. The experiment and data papers describe fixture geometry, the optical points and the processing code. The released directory indices yielded no entry with a name indicating a phase, delay, no-contact, transfer-function or timing reference. A filename search cannot rule out undocumented calibration elsewhere.

The Imperial reader takes friction force, shaker force and relative velocity from successive columns of each triplet. It integrates velocity on a grid that includes both 0 and \(N/f_s\) at \(N\) sample points, then subtracts an endpoint ramp and the mean of each cycle. Its integration step is \(N/[(N-1)f_s]\). The shaker channel can mark cycle timing. It does not measure the differential transfer between the contact force sensor and optical readout.

The PoliTO reader takes the TDMS friction force, displacement, relative velocity and CurrentCycle channels. It segments on changes in CurrentCycle and **explicitly skips cycles containing 572 samples**. At the exact nominal rate ratio \(100000/175=4000/7\), a sample-aligned start yields cycle lengths 572, 571, 572, 571, 572, 571, 571. Three of seven start-phase classes would be dropped. This calculation does not estimate actual counts from the recordings. Both released programs also contain manual cycle exclusions. The direct displacement/velocity pair could constrain their mutual timing but cannot independently set force-channel phase.

The five source inspections used the publisher release listing, archive directories, released MATLAB source and the two wear workbooks' sheet names. No worksheet values or experimental DAT/TDMS/MAT/FIG/AVI arrays were inspected. Some experimental filenames encode cumulative energy. Their numerical stems stayed hidden. Published method figures and examples were already visible and did not determine any selection or score. The source ledger gives original native job identities and complete output hashes. Full multi-gigabyte ZIPs were not hashed by the original range-based intake.

## The proposed test and its conditions

For a symmetric cycle with peak force \(P\), let \(q\) be the inverse Masing backbone and \(g(f)\) a reversible, single-valued series displacement. The two branch displacements are
\[
x_\uparrow(f)=-q(P)+2q((P+f)/2)+g(f),\quad
x_\downarrow(f)=q(P)-2q((P-f)/2)+g(f).
\]
The horizontal half-gap \(B=(x_\downarrow-x_\uparrow)/2\) satisfies
\(B(x+y,x-y)=q(x+y)-q(x)-q(y)\). Substitution at
\(A=x+y,\ C=y+z,\ P=x+y+z\) gives a testable third-cycle contrast:
\[
B(P,x+y-z)-B(P,x-y-z)=B(C,y-z)-B(A,x-y).
\]
It predicts **the difference of two held displacement gaps**, conditional on the measured force coordinates. Positive \(x=P-C,\ y=A+C-P,\ z=P-A\) need a fixed margin from zero. When \(A=C\) both sides vanish. The nuisance \(g\) can vary by specimen, but all three cycles need the same \(q\). Using different pairs would test an additional population/state-sharing assumption. Amplitude assignment and wear in this release give no within-state intervention across the three peaks. The exact controls cover 216 triples, including 36 tautologies, and break the equality in all 180 nondegenerate cases when only the held state changes.

Closed-cycle work is invariant under the replacement \(x\mapsto x+g(F)\), since \(\oint F\,dg(F)=0\). The *monotonic backbone* recipe for symmetric loop work, \(8\int_0^P f\,dx(f)-4P x(P)\), changes differently. An added linear compliance cancels. A cubic \(g(f)=cf^3\) adds \(2cP^4\). Consequently a nearer laser measurement point alone does not justify applying the forward formula to the recorded displacement as exact contact slip.

## Two exact limits on interpretation

**Single-peak gaps.** Every even concave half-gap \(H\) with \(H(\pm P)=0\) has an increasing convex inverse-backbone representation *at that peak*. Choose \(m>0\), take \(q(s)=ms\) through \(P/2\), and use \(q(s)=ms+H(0)-H(2s-P)\) above \(P/2\) through \(P\). The pieces join continuously. On the upper half, the added term is convex and nondecreasing, so the joined function is increasing and convex. Direct substitution gives \(q(P)-q(s)-q(P-s)=H(2s-P)\) on both halves. This construction fits the horizontal gap, without recovering its branch midline or specifying a common backbone at larger peaks. The replay checks 3,096 exact equalities on 24 convexity controls.

**Phase and work.** An elastic spring of stiffness \(k\) driven at the true displacement \(A\cos(\omega t+\delta)\) dissipates zero energy. If the displacement channel is delayed by \(\delta/\omega\), the recorded pair is \(A\cos(\omega t),\,kA\cos(\omega t+\delta)\). With *synchronous* channels, a Kelvin–Voigt sample driven at the recorded displacement produces the identical pair at every amplitude, with \(k_e=k\cos\delta\) and \(c=k\sin\delta/\omega\). For \(0<\delta<\pi/2\), its material work per cycle is \(\pi k A^2\sin\delta>0\). The replay checks 1,188 exact force equalities using rational points on the unit circle. This exhibits an observational ambiguity on the stated harmonic family. It does not diagnose an actual sensor delay, an elastic sample, or Kelvin–Voigt damping in either rig.

If the same linear, time-invariant sensor responses apply to all conditions, their factors cancel from a ratio of complex force-to-displacement responses at a fixed frequency. Such a contrast could reject a common measured linear response. It cannot identify absolute cycle work, its material origin or a common Masing backbone as specimens wear. A measured reference impedance under the same channel settings, plus a controlled repeatable contact-state intervention at distinct peaks, would change this conclusion.

The later Takagi–Sugeno analysis fits individual experiments from this corpus, including a point split within a single loop. Its published reconstruction accuracy does not test the conditional third-peak forecast. No empirical model ranking is claimed here.

## Reproduce

Run Python 3.10 or later on `research/fretting-phase/replay.py` for the algebra, phase ambiguity and nominal sampling checks. To validate the publisher's archives, add `--imperial /path/to/Imperial.zip --polito /path/to/PoliTO.zip`. The optional check authenticates the directory rosters and four named author source programs, opening no experimental members.

[Version 1 data](https://doi.org/10.17632/gy587m7gx7.1) · [Dataset methods](https://doi.org/10.1016/j.dib.2024.110374) · [Experimental protocol, Table 2 and Fig. 5](https://doi.org/10.1016/j.triboint.2023.109158) · [Later reconstruction study](https://doi.org/10.3390/machines14111343)
