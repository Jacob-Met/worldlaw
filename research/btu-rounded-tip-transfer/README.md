# Can a flat-tip spectrum forecast a rounded-tip spectrum at higher nominal flow?

The flat-tip tilt transfer and the isolated-source shape invariant both lost their preregistered mean and worst-condition gates at 150k and 225k nominal Reynolds number. A three-feature ridge fit to earlier paired spectra gave smaller errors. All spectra refer to the measured acoustic sector of the stationary wall-mounted NACA0012 wind-tunnel specimens.

| Rounded target | Flat-tilt mean / worst RMS | Ridge mean / worst RMS | Invariant mean / worst RMS | Ridge after same projection |
| --- | ---: | ---: | ---: | ---: |
| 150k | 2.644 / 6.332 dB | 1.752 / 4.706 dB | 2.389 / 6.312 dB | 1.615 / 4.466 dB |
| 225k | 1.087 / 2.755 dB | 0.815 / 1.291 dB | 0.943 / 2.675 dB | 0.752 / 1.280 dB |

Each summary covers the six natural/tripped × 5°, 10°, 20° conditions. The supplied spectra are single acquisitions per condition. The two 0° controls remain in the eight-condition report, with an explicit persistence fallback because the native rounded-tip formula has no finite log spectrum at zero incidence. The two targets share specimens and expanding histories. For the frozen 225k forecast, the 150k rounded spectra had become valid historical inputs. Both forecast files were locked before either set of scores was computed.

## What the controls test

The published BPM tip term is a quadratic in log10 center frequency with coefficient −30.5. For fixed tip length and proportional convection speed, increasing speed by a factor r gives a slope change of 61 log10(r) dB per log-frequency decade. The nominal arm uses the released Reynolds-number index as its speed proxy. The paired arm takes the observed slope change of the separately acquired flat specimen at the same nominal setting. It transfers that tilt to the previous rounded measurement. The full flat-difference, one-step secant, recent four-point trend, carry and pooled history ridge arms use the same admissible observations. The history ridge can respond to narrow spectral changes that a pure tilt cannot express.

The centered comparison removes one fitted spectral level from each of the 11 supported bands. The invariant comparison removes level and tilt, leaving nine dimensions. A fixed arbitrary frequency-dependent measurement gain contributes its projected shape to both rounded measurements. Carrying the earlier measurement forward makes the difference cancel under the shared-gain assumption. Projection alone leaves that gain in place. In the invariant comparison, carry, nominal BPM and the flat-tilt prediction coincide, so the gate compares them only to the four distinct predictions. Two native Julia controls at all six nonzero angle/geometry combinations reproduced the upstream tilt within 1.0e−13 dB per decade, with projected differences at most 7.2e−14 dB even after injecting a gain whose retained shape reached 8.148 dB.

## Where it failed

The untripped rounded 5° condition was the worst primary curve in both tests. At 150k and 3.162 kHz the rounded level moved from 54.525 to 40.236 dB, while the matching flat level moved from 58.451 to 42.381 dB. The centered flat-tilt forecast overshot by 15.628 dB. At 225k and 5.012 kHz the rounded level moved from 50.896 to 47.115 dB and the flat level from 53.654 to 49.037 dB. The centered forecast overshot by 6.775 dB; 6.567 dB remained after removing tilt. Full donor, target and signed error curves are in raw-worst.json. The all-21-band sensitivity retained released −356 dB values outside the primary domain. Their numerical jumps dominate some diagnostic errors. Their physical value is unqualified.

The original records use 47 wall-mounted microphones, removed cross-spectral diagonals and CLEAN-SC sector integration. They expose total sector levels in third-octave bands. Changes in competing sources, flow-dependent effective gain, within-band spectral structure and beamformer response can all affect a comparison across acquisitions. The release provides no matching rounded-tip raw microphone histories or per-record speed/temperature/viscosity trace. The study evaluates transfer of the reported spectra only.

## Reproduction

Run the following from this directory with Python and NumPy. The program downloads the 1,523,495-byte version-1 archive, authenticates its SHA-256 and compares all 37 relevant member hashes to the original version-2 byte records. A local copy can be supplied with `--archive`.

```sh
python replay.py
```

The independent standard-library receiver implements the three-coefficient solve and both projections separately. It checked 7,168 signed error components across the two stages and band domains, both complete arm rosters and all registered gate decisions. Maximum numerical disagreement was 1.09e−12 dB. The first independent worker encountered a full scratch filesystem before scoring. The unchanged receiver completed on a second owner. The prospective protocol and original file hashes are recorded in protocol.md and course-receipt.json. Passing `--require-original-bits` also enforces original forecast and score file SHA-256 values on the original numerical stack.

The source measurement collection is [Mendeley Data, version 2](https://doi.org/10.17632/6x59x7x3ny.2). The acquisition and beamforming methods are in [Zhang et al., Data in Brief](https://doi.org/10.1016/j.dib.2019.105058). Native controls use the [pinned AcousticAnalogies.jl source](https://github.com/OpenMDAO/AcousticAnalogies.jl/blob/d28fdea6e405c60f24f5befb13420ee0afc6fc92/src/tip_vortex.jl).
