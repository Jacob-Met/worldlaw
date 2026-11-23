# Which calibration measurements identify an immersed cantilever?

The published four-probe experiment supports a calibration result and a graphical admission result. Both proposed experimental forecasts remained unscored. The original air-and-water calculation requires absolute dry modal frequencies for the same probes. The archived numerical tables do not supply them. A separately frozen two-wet-standard procedure needed two resolved long-probe marks in both modes for each reference liquid. It resolved all four short-probe pairs and none of the four long-probe pairs. All 20 long-probe frequency targets for the other five liquids remain unopened.

## What the experiment supplies

Payam, Trewby and Voïtchovsky recorded thermally driven modes on four silicon-nitride cantilevers. The nominal widths are 40 and 20 µm, crossed with lengths of 100 and 200 µm, with nominal thickness 0.8 µm. Pure liquids were examined with the MFP-3D Infinity. The polymer-concentration results used a separate Cypher ES. Figure 2 places each measured wet frequency against two literature properties of the same fluid. An individual symbol identifies water, isopropanol, acetone, butanol, decane, hexanol or bromoform. Color and fill identify the probes. Sample names establish the liquid condition across probes. Simultaneity, fabrication tolerances, common aliquots and raw thermal-fit uncertainties remain unspecified for this analysis.

The authenticated Europe PMC XML (75,177 bytes) and supplementary archive (5,925,278 bytes) contain two main tables, four equation graphics, five experimental figure families and the eight-page SI PDF. The tables list probe characteristics and selected property-estimation errors. The archive contains no raw thermal spectra or table of the eight absolute dry frequencies. Nominal beam geometry and a relative dry-mode spacing do not supply this measurement. Reported calculated-versus-measured comparisons and recalibration with other known liquids represent separate information. The Durham manuscript and direct RSC supplement requests returned 403. The Europe PMC supplementary-file route succeeded. [Author paper](https://doi.org/10.1039/C6AN02674E) · [Primary XML](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC5450008/fullTextXML) · [Archived supplement and figures](https://www.ebi.ac.uk/europepmc/webservices/rest/PMC5450008/supplementaryFiles)

## A water-only ambiguity

In the author's equation 2, write the positive dry angular frequency as F, wet angular frequency as t², and ξ = √(ρη). In each probe the same two effective coefficients a and b enter both modes. Each positive wet root satisfies

```text
(1 + aρ)t⁴ + bξt³ − F² = 0.
```

For a known reference density ρw and scalar s near one, set ρ′ = sρ + (1−s)ρw, ξ′ = ξ, d = s − a(1−s)ρw and λ = s/d. Apply a′ = a/d, b′ = λb and F′² = λF² separately in each probe. Substitution gives 1+a′ρ′ = λ(1+aρ). All three polynomial coefficients scale by λ. Where the transformed quantities stay positive, the unique positive root is unchanged for every probe, fluid and mode. The water properties and every within-probe dry modal ratio also stay fixed. For a nonwater density, the transformed viscosity is ξ²/ρ′.

This establishes an exact ambiguity for probe-specific effective coefficients, a single calibrated water standard, and unknown absolute dry frequencies. The published pure samples have independently accepted properties. Admitting a second known density different from ρw breaks this particular density symmetry. An absolute dry modal frequency also breaks it for a probe with a positive density coefficient. Neither fact guarantees a well-conditioned inverse. The exact controls check 27 parameter combinations and 54 matched 48-bisection brackets. The universal conclusion follows from the polynomial identity.

## What a second wet standard can supply

Subtract the two wet equations mode by mode to eliminate the dry squared frequency. The two columns of the resulting system are the between-standard contrasts in ρt⁴ and ξt³. If its two rows are independent, one can recover a,b, calculate each F², and then check signs and error sensitivity. An exact synthetic example recovers a=b=1 with determinant −249696307/4500000. In another example water has ρ=ξ=1, the second standard has ρ=31, ξ=8, and each wet t is halved. The ξt³ column vanishes identically. Three positive choices of b produce different dry frequencies with the same observations in both known liquids. These examples distinguish a full-rank reconstruction from a possible design failure without using a measured target.

## What happened in the actual figure

The second registration fixed acetone and bromoform as anchors, their symbol columns, a two-row vertical-gap criterion and a central-fill difference greater than 0.15. The main JPEG is 783 by 645 pixels, SHA-256 `d27c2ab49d053afa852428c8751fb4d8bc0a2fbf8fa7bdedaadc7521275dddff`. Each cell below shows all retained bands in image-row coordinates. All edges and fill fractions are retained in the two receipts.

| Calibration liquid | Mode | Red short probes | Blue long probes |
|---|---:|---|---|
| Acetone | 1 | 44–53 and 72–83 | 188–205 |
| Acetone | 2 | 253–263 and 275–285 | 382–403 |
| Bromoform | 1 | 140–151 and 162–173 | 214–229 |
| Bromoform | 2 | 332–343 and 362–374 | 410–427 |

The long-probe marks merged under the registered reader. For example, the second acetone mode produced a single 22-row band, with 19 of 25 central pixels blue. The image cannot pass this particular separation rule. The cantilevers could have different physical frequencies inside those bands, and another transcription could recover additional graphical information. None of the five remaining liquids' long-probe frequencies entered a fit, prediction, score or admission decision. Image decoding necessarily read the complete JPEG into memory. Only two declared anchor strips supplied the numerical inputs.

The independent rectangle-first reader redecoded the authenticated original archive. A separate worker reconstructed all color tests, endpoints, fill fractions and eight decisions from the lossless RGB strips with standard-library integer arithmetic. The independent fresh-download attempts retain their missing-Pillow and network-timeout outcomes. The small-RGB route certifies the transfer from those two source strips. The two independent readers do not provide new physical measurements.

## Reproduce the checks

```sh
python3 exact_controls.py
python3 cold_replay.py --expected original-admission.json
```

Both commands work from this directory with the Python standard library and the committed files. For a complete source-archive read, use Pillow and pass the unchanged archive to `anchor_admission.py` and `independent_anchor.py`. The SHA-256 of that archive is `7c02c144eec191841a07122545406dd70f33992b667883861820e9ab750356e3`. The archive contains the authors' figure, so both programs verify it before reading their anchor regions. Source-equation and two-standard admissions, exact arithmetic, raw pixel control and experimental forecast status are recorded separately.
