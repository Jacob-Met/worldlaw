# Can Livingston and Virgo support a two-polarization prediction for Hanford at GW170817?

The optical sky position gives a full-rank Livingston/Virgo response. In the measured source check, Livingston's matched-filter signal-to-noise ratio (SNR) was **20.7773**. Virgo's was **2.2535**, below both the registered threshold of 5 and the largest of 18 off-event controls (2.7714). The source gate failed. All Hanford strain, including its off-event noise, stayed sealed. There are zero Hanford forecasts or scores. This is a result for one registered source-only test of an event independently established by the original collaboration.

## What can be reconstructed in the absence of noise?

Each detector reads a linear combination of two tensor polarizations, shifted by its arrival time. At the J2000 position of SSS17a and GPS 1187008882.43, LALSuite 7.26.1 gives the following nominal long-wavelength responses (polarization angle zero). Deriving the responses independently from the detector arms gives agreement within 1.67e−8; the calculated arrival times agree within 1e−12 s.

| Detector | Plus | Cross | Arrival relative to Earth center (ms) |
|---|---:|---:|---:|
| Hanford | 0.079278 | −0.885567 | +18.794305 |
| Livingston | 0.131502 | 0.739104 | +15.500880 |
| Virgo | −0.160772 | −0.257862 | −6.390532 |

The source matrix has singular values 0.802946 and 0.105757, condition number 7.59235. After time alignment, the unique linear combination that reproduces Hanford for every pair of tensor amplitudes weights Livingston by −1.917354 and Virgo by −2.061395. The least-norm single-site projections give −1.142900 and +2.334931, respectively. A single sensor alone cannot predict all polarizations.

For independent source noises with equal variance the two-site rule amplifies noise RMS by 2.81524. With separately measured source noise spectra, the nominal amplitude factor relative to Livingston alone has median 7.07458, minimum 4.13614 and maximum 11,689.8 over the 4,032 retained frequency bins. The maximum occurs at 50 Hz, where the Virgo/Livingston power ratio is 32,158,198. The 50 Hz value describes one narrow line. Hanford error remains unmeasured. The calculation assumes uncorrelated source noise. No target noise spectrum is used.

## Source-only physical screen

The optical position came from Swope imaging 10.9 h after a network-guided search. The event time is the publicly known network trigger time. This is an archival analysis conditional on those facts, and the release already describes a weak Virgo response. No source posterior was consulted.

The v2 catalog was examined without reading strain. Its Livingston product uses glitch subtraction. The available regression documentation did not establish every upstream detector dependency of that particular archived series, so the actual course used the pre-subtraction v1 C00 calibrated Livingston and Virgo files. Livingston alone received the published fixed inverse-Tukey notch around GPS 1187008881.389, zero within 0.1 s and tapering over 0.5 s on each side. Both native quadrature templates and detector data received identical time-domain windows before band selection. Nominal calibration is used. Published event-era parameter estimation reports LIGO amplitude/phase uncertainties below 7%/3° and Virgo approximately 10%/10° at one sigma; those estimates are context and are not a recalibration of the v1 files.

A Livingston-only bank of 222 TaylorF2 equal-component, zero-spin template evaluations selected a detector-frame chirp-mass grid point of 1.1973 solar masses and local time 56.448555 s in the declared 64 s block. This search covered 35–100 Hz and excluded 59–61 Hz. Noise spectra were estimated separately over the first 600 s of each source file. The three conditions were frozen before source data. The Virgo check used the −21.891412 ms Virgo-minus-Livingston delay and a ±0.976563 ms window, without a second mass search.

| Registered condition | Observation | Outcome |
|---|---:|---|
| Livingston SNR ≥8 | 20.777342 | Pass |
| Virgo SNR ≥5 | 2.253526 | Fail |
| Virgo exceeds every fixed off-event control | 2.253526 vs 2.771363 | Fail |

At the predicted arrival, the Virgo SNR is 2.205796. Its largest point is the last sample of the allowed window, with whitened quadratures (1.640382, 1.545162). Off-event block 10 has SNR 2.617991 at center and 2.771363 at the positive window endpoint, with quadratures (1.254612, −2.471113). One of the 18 off-event maxima exceeds the on-event value. These finite controls do not provide a population-level false-alarm rate. Zero target files and no target-derived timing correction entered this result. Other waveforms or broader bands may provide different source evidence. This course also uses nominal event geometry and does not marginalize over calibration-response functions or apply an additional data-quality veto.

## Reproduce

Run `python3 replay.py .` for the offline geometry and receipt checks. `synthetic.py` recovers injected mass, time and SNR from both exact detector windows. For fresh source data, `screen.py` needs the packages pinned in `runtime.json` and the two public files. `independent_source.py` rechecks their exact SHA-256, computes the median Welch spectrum directly, and solves the two-quadrature Gram matrix with its explicit inverse. It reproduced 20 SNR maxima (Livingston, on-event Virgo and all 18 backgrounds) to within 4.25e−12. It tests the winning source template without rerunning selection over the full bank. Both original products total 253,737,393 bytes. The source screen took approximately 153 s including acquisition and execution.

[Optical position](https://doi.org/10.1126/science.aap9811) · [Event paper](https://doi.org/10.1103/PhysRevLett.119.161101) · [Original data and local glitch gate](https://gwosc.org/events/GW170817/) · [Calibrated source catalog](https://gwosc.org/eventapi/json/O1_O2-Preliminary/GW170817/v1/) · [Glitch-subtraction note](https://dcc.ligo.org/LIGO-T1700406/public) · [Detector constants](https://lscsoft.docs.ligo.org/lalsuite/dev/lal/group___detector_constants.html)
