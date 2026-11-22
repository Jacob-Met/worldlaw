# Paderborn paired-speed bearing spectra

**The released Fast-SC calculation was reproduced. The first healthy recording stopped the proposed physical comparison.** The vibration time vector in that recording departed from a uniformly spaced grid by up to **102.797 µs**, equivalent to 6.50 of its median sample intervals. No physical spectrum, forecast or held score was produced.

## What the source recording establishes

The first archive member eligible under the registered conditions was `N15_M07_F10_K001_20.mat`. The experiment verified the complete 173,881,721-byte K001 archive against the independent registry, then opened that 8,717,848-byte member. The acquisition code checks both channel clocks before computing a spectrum. It stopped on the speed clock. A separate receiver enumerated the archive from the beginning, opened the same first member and reproduced the original speed timestamp hash. It examined the vibration time vector as well.

| Channel | MAT raster | Samples | Mean rate | Median rate | Largest deviation from endpoint-defined grid | Worst sample |
|---|---|---:|---:|---:|---:|---:|
| Speed | Mech_4kHz, XIndex 1 | 16,006 | 4,001.289 Hz | 4,003.353 Hz | 0.252866 µs, or 0.001012 median steps | 828 |
| Housing vibration | HostService, XIndex 2 | 256,088 | 64,021.873 Hz | 63,188.054 Hz | 102.797011 µs, or 6.495543 median steps | 161,109 |

At vibration sample 161,109, the stored time was 2.516570870820 s and the affine grid gave 2.516468073809 s. Individual time increments ranged from 4.2772 to 57.3150 µs. Both channel and time unit fields were empty in this MAT. Rates in the table use the acquisition study's interpretation of the time vectors in seconds. The preregistered limit for each complete float64 time vector was six native ULPs, capped at one eighth of a median step. For this recording the limit was 2.66454 × 10⁻¹⁵ s. All 14 held low-speed bearings remained unopened. The trusted MATLAB loader materialized every channel in the permitted file. The diagnostic consumed channel metadata and the two time vectors.

Paderborn describes synchronized motor-current and vibration measurements at a nominal 64 kHz, with lower-rate mechanical measurements. The authenticated K001 measuring log gives 64 kHz for vibration and 4 kHz for the mechanical parameters. It identifies a dSPACE DS1006 with DS2004 and names the Simulink acquisition model. The source check found no documented mapping from each exported HostService timestamp to the ADC conversion instant. The measuring log SHA-256 is `827f5ae9eec40ed96b2078fc4529bf0f07f4ffe063fceeb2a5a569d1ac809cb2`. The log and bearing fact sheet were read directly from the original K001 archive without opening another MAT. The recorded time-vector failure applies to the declared uniform-grid receiver. Determining physical ADC conversion times, host scheduling delays, or export-time reconstruction would require a documented link between this acquisition configuration and its exported HostService raster. The K001 result establishes neither the cause of the deviations nor their prevalence in other recordings. [Organizer measurement apparatus](https://mb.uni-paderborn.de/en/kat/research/bearing-datacenter/test-rig-and-measurement-equipment) · [Lessmeier et al., 2016](https://mb.uni-paderborn.de/fileadmin-mb/kat/PDF/Veroeffentlichungen/20160703_PHME16_CM_bearing.pdf)

## Why the implementation changed before intake

The author’s calibrated Fast-SC estimator uses the first maximum of its Hann window when combining complex scans and calculating calibration weights. The Octave and SciPy window formulas agreed on the selected index in the earlier 256-point fixture. At the configured length of 512, GNU Octave 8.4.0 gave two equal central values. SciPy 1.18.1 gave the second central value one more unit in the last place. The selected zero-based index changed from 255 to 256. The synthetic full-matrix comparison measured a 1.028227% peak-scaled discrepancy. A separate change in the order of floating-point operations dropped the 640 Hz Nyquist column at a frame count of 4,900.

The production receiver now binds the original 4,096 bytes of Octave’s window and follows the author’s operation order for the cyclic-frequency coordinates. A fresh process generated the native complex matrices from the unmodified author file and independently computed the complete registered magnitude grids. The production entry consumed the same artificial inputs. Each full grid had 257 by 1,281 cells.

| Frames | Native complex shape | Peak-scaled maximum complex error | Peak-scaled maximum grid error |
|---:|---:|---:|---:|
| 5,111 | 257 × 2,556 | 2.69 × 10⁻¹⁶ | 2.69 × 10⁻¹⁶ |
| 5,112 | 257 × 2,557 | 3.59 × 10⁻¹⁶ | 3.59 × 10⁻¹⁶ |
| 4,900 | 257 × 2,451 | 8.97 × 10⁻¹⁷ | 8.97 × 10⁻¹⁷ |

The same limits held for each DC spectrum. This covers 1,943,948 complex values and 987,651 registered grid values. The original two-tone fixture with a mistaken real exponential, the corrected 256-point result, the subsequent 512-point stock failures and the production qualification each have separate immutable receipts. The two-case native plan was refused before dispatch. Any later replay of the three-case stock diagnostic uses its original source at commit `43b0a73d5c0043b22567fcbb95586136b557094f`. [Author implementation](https://www.mathworks.com/matlabcentral/fileexchange/60561-fast_sc-x-nw-alpha_max-fs-opt) · [Antoni, Xin and Hamzaoui, 2017](https://doi.org/10.1016/j.ymssp.2017.01.011)

## Registered physical question

The design paired 1,500 and 900 RPM at the same nominal 0.7 Nm torque and 1,000 N radial load. Six healthy specimens and 11 artificial-damage training specimens could supply both speeds. Each of 14 accelerated-life specimens could supply high-speed vibration and speed before issuance of all 238 forecast arrays. Each condition included all 20 released recording IDs. The independent archive registry and mirror provided 31 of the 32 original bearings. Artificial-damage donor KA08 was unavailable from this mirror. The original archive endpoints had returned HTTP 503. The independent registry supplies file integrity and is not an organizer signature.

The hypothesis was that the two ordinary spectral sidebands in healthy reference recordings could improve prediction of an accelerated-life bearing's whole cyclic-spectrum magnitude at the other speed. The author’s positive cyclic-frequency output reports the lower sideband. The physical registration holds carrier center frequency in hertz and modulation in shaft orders. Carrier-center and order registration are established methods. Effects of excitation, specimen, mounting and acquisition can all influence the healthy spectral ratio. The references were separate healthy specimens, all manufactured by IBU. The held set included six FAG, seven MTK and one IBU bearing. [Operating conditions and cohort](https://mb.uni-paderborn.de/en/kat/research/bearing-datacenter) · [Abboud et al., 2015](https://www.sciencedirect.com/science/article/pii/S0263224115003528)

The 17 roles share the same input budget. They include unchanged and warped spectral coordinates, additive and multiplicative healthy-reference corrections, paired damaged-training averages, and three fitted controls. The registered test required improvement over all 16 comparators in equal-bearing mean normalized error and at least eight of 14 within-bearing wins against each. Each score used all 324,478 common positive cells, with normalization determined solely by that bearing’s high-speed spectrum. The source-clock refusal preceded training and forecasting. The physical performance of every role remains unmeasured.

## Reproduction and custody

Run `python3 replay_receipts.py` from this directory to verify the frozen production source fingerprints, calibration failures and final spectral output checks, native K001 refusal, decoded mathematical quantities and the two original clock identities. This command reads retained receipts. Fresh native qualification additionally requires the author’s exact Fast_SC.m, GNU Octave 8.4.0, NumPy 2.5.5 and SciPy 1.18.1. With those dependencies, run `native_window_axis_fixture.m` in a dedicated working directory containing Fast_SC.m, then invoke `qualify_production_window.py` from that working directory.

| Original | SHA-256 |
|---|---|
| v4 protocol | `86a79d999e515483f67aa28cc5f277d2d6c009f6039a87ec9cf6dfddfa2fefd8` |
| 19-file pre-read packet | `3bfe31e53f4728a25e80cd21c09f47e205888079749114af44e9a00435bd5f19` |
| Literal Octave W512 bytes | `ebc331b54bd1be01e8c8b12d4a2579cf9f46571d6de8551cbcccec04a332135d` |
| Fresh production qualification | `fc260d78a1f129014867d3f605aedc333bf8d7bbf2b65f868fbcc20065aa5d96` |
| K001 RAR | `0f119ebdb28fb2f4d9fac1beb1319429f63f7ae1256c23c872f280f3560918e5` |
| First permitted K001 MAT | `858a5122648da178991023e08f268826f6a6ed3ccf7150e53a89fb9ca27e46ec` |
| Original intake refusal | `fc69c26d168568829bcffdf75c706216be225c798a534b9353cff32aeb56fc67` |
| Independent first-member clock receipt | `ef7703a3a39b9f4b7db511b9939500506d23518bf9cb76db924a327e806ae90e` |

The v4 source package was frozen at `e9795d0c005a4fafb4f642de61382f435ea38fde` before intake. The independent source receiver matched all 19 packet members to that commit. Complete raw recordings remain at the original data source under the organizer’s noncommercial license. [Christian Lessmeier et al., Chair of Design and Drive Technology, Paderborn University](https://mb.uni-paderborn.de/en/kat/research/bearing-datacenter) · [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)
