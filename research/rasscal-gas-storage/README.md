# What downstream pressure rise measures in RaSSCAL

Hannon, Tarlovsky Tucker and Soeder's 2018 conference presentation gives a pressure-slope response law for a quasi-steady gas permeameter. The observable is the rise of pressure in the downstream chamber. The authors' public 2019 data catalogue identifies upstream, confining and downstream gauge pressures (psig), temperature (°F), and the downstream slope (psi/s). The names distinguish a Bedford Marcellus shale sample and a Berkeley Springs Oriskany sandstone sample measured with helium and methane. These are two named physical samples. A laboratory flow or permeability value requires additional assumptions about the fluid and apparatus. [Paper](https://doi.org/10.1016/j.petrol.2019.04.087) · [Data and units](https://doi.org/10.17632/tk6kx5w3mc.1)

**The same-core helium-to-methane forecast was unscored.** The public methods inspected here do not establish gas-switch order, restoration of the same stress/sorption state, a stable collection volume across sessions, the operating-point averaging interval, or the historical fluid-property version. The public data catalogue file-list request returned HTTP 403 (response code 1010). No experimental pressure or slope rows were opened. The two result slides and their plots stayed sealed. The contemporary pure-gas calculation below qualifies a term in the 2018 equation. It estimates no performance on either rock.

## The historical response law

The public Geological Society of America handout is 8,266,775 bytes, SHA256 `110a3ded734db1c211807e00937250e2411cc926df2c037e775dcfb54c79ba58`. A title inventory located the two result slides. The source reader examined only the complete five methods slides, numbers 3–7. It verified each XML digest and extracted the OfficeMath numerator and denominator on slide 7. NETL describes a stable gas reference and a differential pressure measurement. Its separate ability to measure sorption isotherms provides no run-specific sorption measurement here. [Author handout](https://gsa.confex.com/gsa/2018AM/webprogram/Handout/Paper321302/Hannon%202018%20GSA%20Presentation.pptx) · [NETL instrument](https://netl.doe.gov/sites/default/files/2024-11/R-D176.pdf)

With absolute pore pressures, the slide's two integrals combine into

    (Vd L / (Zd A)) dpd/dt =
        k∞ ∫[pd,pu] exp(−α(pc−χp)) (p+b) / (µ(p,T) Z(p,T)) dp .

Vd is downstream chamber volume, A and L are core cross-section and length, Z is gas compressibility factor, and µ is dynamic viscosity. The slide introduces pressure-scale slip coefficient b, unconfined intrinsic permeability k∞, confinement decay parameter α, and dimensionless effective-stress coefficient χ. The pressure-gradient integral matters because local permeability and gas properties vary across the core. An implementation using pressure in pascals and temperature in kelvin needs an atmospheric datum for gauge-to-absolute pore pressure conversion. All pressures used in a given stress convention must be defined consistently when χ can differ from one.

The slide's slope scale is proportional to k∞ A/(L Vd). Multiplying k∞ and Vd by the same positive constant leaves the entire pressure-slope function unchanged. If volume can change across gas sessions, a session-specific volume multiplier is indistinguishable from an opposite permeability multiplier on the slope. At fixed pc, the response contains k∞ A exp(−α pc)/(L Vd) and γ=αχ. Multiple scale/α/χ triples produce identical slopes under that condition. At α=0 the value of χ drops out. Independent variation of pressure and confinement can constrain some of these combinations. It cannot recover an unrecorded absolute volume from slopes alone. If downstream volume is constant within each gas, paired log-slope differences cancel this constant only. Stress history, changed pore accessibility, valve/compliance effects and thermal or gas storage can still differ.

## A modern single-phase reference calculation

For a rigid, isothermal, closed downstream chamber with constant Vd and inflowing molar rate ṅ, conservation gives ṅ=Vd (∂c/∂p)T dpd/dt, where c=p/(ZRT). At fixed temperature,

    ∂(p/Z)/∂p = (1/Z) − (p/Z²)(∂Z/∂p)T .
    (pressure slope from this balance) / (pressure slope from slide 7)
      = 1 / (p κT)    with other terms held identical.

The storage-coefficient ratio is the reciprocal of the slope ratio. With c in mol/m³, Cexact=Vd c κT and Cslide=Vd/(ZRT), so Cexact/Cslide=pκT. At the same observed slope and with a fixed linear flow factor, the permeability scale required by the exact balance divided by the slide-based scale also equals pκT. A pressure-dependent chamber volume adds c·dVd/dp to storage and can mimic a gas-dependent change. Here κT=(1/ρ)(∂ρ/∂p)T is isothermal compressibility. For a single stable fluid it also equals (cp/cv)/(ρw²), where w is the adiabatic sound speed. This exercise compares the two downstream factors using the same upstream pressure integral. It does not test flow or total storage under experimental conditions. A small pressure increment alone does not imply that the derivative of Z vanishes. The 2018 source names NIST REFPROP without identifying a version. NIST documents a change to the helium equation of state in version 10. The separate modern comparison below uses the official open CoolProp 7.2.0 HEOS release. [NIST REFPROP](https://www.nist.gov/srd/refprop) · [CoolProp release](https://pypi.org/project/CoolProp/7.2.0/) · [Helium reference](https://www.nist.gov/publications/equation-state-thermodynamic-properties-helium)

Both gases use four absolute pressures at 300 K, fixed before any reference values were generated. These pressure states were selected independently of the closed experimental records. Each multiplier below is dimensionless.

| Pressure (MPa) | Helium | Methane |
| ---: | ---: | ---: |
| 1 | 1.004735 | 0.983329 |
| 5 | 1.023449 | 0.924950 |
| 10 | 1.046346 | 0.894287 |
| 20 | 1.090654 | 1.119968 |

At 10 MPa methane has ρ=75.17549 kg/m³, w=444.5304 m/s and pκT=1.1182095. The mass-balance slope is 10.57% lower than the slide-based slope for that reference state. At 20 MPa methane has ρ=155.27655 kg/m³, w=524.8580 m/s and pκT=0.8928825. The ratio is then 12.00% above unity. A constant methane multiplier cannot reproduce both states. Among the eight states, the largest relative discrepancy between the narrower density central difference (±0.05 MPa) and the heat-capacity/sound relation is 2.27×10⁻⁶ at methane 10 MPa. All eight direct HEOS compressibilities agree with the thermodynamic relation within the registered 10⁻⁸ relative tolerance. All quantities derive from the same modern thermophysical model. They supply a consistency check and a finite-scale comparison. Neither the actual test pressures nor a discrepancy in the 2019 paper can be inferred from them.

## Evidence and replay

Run `python3 -I -S replay.py` for the offline standard-library receiver. It verifies both complete native output streams, identifies the first refused property request, reconstructs all eight multipliers from pressure, density, heat capacities and sound speed, and checks the units, two registered pressure-difference tests and recorded terminal states. The native property producer authenticated the full 6,478,127-byte wheel before calling its compiled PropsSI entry point. The original code and its eight complete output rows, including viscosity, density, sound speed, heat capacities, Z and both finite-difference errors, are included. The source reader authenticated the GSA methods before the first NIST dynamic fluid query returned HTTP 403. The record retains that terminal failure and an earlier gateway pre-dispatch refusal. No NIST query was repeated through another provider. The two native receipts are separate from the local replay.

The available sources support the slope equation, the k∞/Vd scale ambiguity and the eight modern gas-reference comparisons above. An independent test of gas transfer would need the source-identified effective collection volume and gas/test history, the legal pressure information available at prediction time, a gas-property implementation with declared provenance and the numerical pressure-rise observations. This recording has no established held-rock forecast, randomization or causal gas effect.
