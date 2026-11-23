# Which transverse electric field does the eight-contact MoSi₂ experiment identify?

Sakamoto and colleagues report both voltage polarities for each of 28 electrode pairs on one MoSi₂ crystal. This identifies seven effective electrode-potential differences, up to measurement errors and assumptions about drift. The reversed relay measurements can also reveal polarity-independent voltmeter offsets. Under the authors’ homogeneous gold-lead correction and a strictly longitudinal temperature gradient, the transverse effective field equals the transverse crystal field. The released temperature calibration and reversal protocol do not independently determine an intrinsic transverse field once a transverse contact-temperature gradient is allowed. We therefore closed that stronger inference without scoring the printed voltage rows.

## What the experiment supplies

The single electrical heating configuration places a resistive heater and thermal bath on opposite sides of the crystal. The gradient is nominally along the lab x direction, about 45° to the crystal axes. Figure S1 shows one quantitative temperature profile along a carbon-tape strip. Its fitted slope is −2.45 ± 0.06 K/mm. The finite-width strip also appears in the thermal image. The authors explicitly exclude the uncovered surface from quantitative thermometry because its emissivity was uncalibrated. In Figure S2 the eight marked contact centers lie outside the black strip. The coordinate table uses terminal 0 as its origin and has a non-collinear layout. The authors supply a value of approximately 2 μV/K for the thermopower of the gold leads. The supplement contains no independent per-contact temperature calibration, second electrical heater direction or signed heater reversal with the same voltage wiring.

The Peltier experiment uses the same crystal with AC current driven through copper clips. The fundamental-frequency lock-in temperature images include amplitude and phase. The authors’ thermal model uses current-density calculations, heat capacity, tensors extrapolated to the heated operating point, isothermal clip ends, Robin outer boundaries and the Kelvin relation Π=TS. The current sweep and current-odd thermal image are genuine separate observations. They do not constitute a second heater configuration in the open-circuit voltage experiment, or a direct measurement of the terminal heat currents required for an independent quantitative Kelvin-ratio test. The open supplement provides figures; the authors offer the underlying data on request. Only the S1 temperature-input and S2 contact-layout figures were visually inspected. The S3 voltage table and S4–S6 measured or modeled response images were excluded. The earlier intake scanned labeled captions from the PDF without emitting response values.

[Original experiment](https://doi.org/10.1063/5.0355608) · [Author preprint](https://arxiv.org/abs/2610.38506) · [Versioned supplement](https://doi.org/10.60893/figshare.apl.34827618.v1)

## Identifiability and a positive control

Write the voltage vectors as Bv, where B is the 56-by-8 directed incidence matrix. Its rank is seven. Pair reversal leaves 28 independent even-in-relay combinations and the antisymmetrized complete graph has 21 independent cycle constraints. An ideal fixed common meter offset contributes to the even combinations. Any per-contact voltage contributes to the same seven-dimensional difference space as the crystal potential. The two planar field columns, formed from differences in the published x/y coordinates, have rank two and add zero rank to B. A fixed offset survives a relay swap along with the desired signal. A genuine reversed thermal drive with unchanged offsets could cancel fixed offsets by half-differencing. Temperature-dependent lead EMFs reverse with the thermal gradient and must still be modeled.

For homogeneous gold leads at a common reference temperature the pairwise lead contribution has the form −S_Au(T_i−T_j), using the authors’ sign convention for an effective field. The exact witness in charge_and_heat.py uses a measured line as its **input contract**. In synthetic units let S_Au=2 and g=(1,t). Use the 45°-rotated crystal tensor with equal diagonal entries a and off-diagonal entries b. Set

```text
a = 2 + (2 − 9 t)/(1 − t²)
b = (9 − 2 t)/(1 − t²).
```

For t=0 and t=1/20 the effective field (S−2I)g is (2,9). The temperature is identical on every point of the sampled y=0 line. Both crystals have opposite-sign principal thermopowers. Every synthetic voltage on the 56 actual ordered contact pairs agrees, including both relay polarities, yet the intrinsic transverse components of Sg are 9 and 9.1. The numerical difference illustrates identifiability only; there is no experimental error bound or inferred sign reversal here.

An independently fixed full crystal tensor, known temperatures at the contacts, or an independently justified strictly longitudinal gradient changes the inference. Our affine witness matches the line profile only. It does not match every pixel of a finite-width tape image. If the temperature field were globally affine and a reliable two-dimensional strip supplied non-collinear samples, both gradient components could be inferred in that model. Extrapolation off the tape and comparison to thermal images would require their actual thermal boundary conditions and sufficient calibration. This result preserves the authors’ conditional effective-field reconstruction and the qualitative same-crystal observation.

## Reproduction

Run `python charge_and_heat.py` and `python independent.py` for the exact rational controls. The second program independently forms and row-reduces the incidence, coordinate and combined matrices. It checks 112 synthetic directed model rows and 112 triangle sums on the reported S2 geometry. No measured voltages or Peltier images enter these calculations.

Run `python source_boundary.py` to verify the two source hashes and the text of the admitted methods and figures, using Python 3 and Poppler pdftotext. For local original inputs use `python source_boundary.py supple2.pdf author-original.tar.gz`. The foreclosed empirical endpoint remains unscored. Reversed-relay differences, source-model FEM output and the synthetic witness cannot substitute for an independently calibrated thermal response.
