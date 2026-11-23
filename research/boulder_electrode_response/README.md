# Boulder geoelectric field availability for a fixed storm comparison

The April 24, 2023 electric record supplies a missing-data marker in both geographic components for every second of the UTC day. The magnetic record has both components for every second. This prevented the planned four-event comparison of a one-dimensional Earth response with distortion and full-tensor alternatives. No magnetic or electric amplitudes were converted to numbers, no transfer was fitted, and all eight proposed predictor scores remain unavailable.

## Observed coverage

| Fixed UTC day | Role | Missing magnetic vector seconds | Missing electric vector seconds | Complete paired 4,096-second windows out of 21 |
| --- | --- | ---: | ---: | ---: |
| 2017-05-28 | Development | 0 | 0 | 21 |
| 2017-09-08 | Development | 0 | 0 | 21 |
| 2018-08-26 | Development | 0 | 0 | 21 |
| 2021-11-04 | Held | 0 | 7,980 | 17 |
| 2023-04-24 | Held | 0 | 86,400 | 0 |
| 2024-05-11 | Held | 0 | 2,580 | 19 |
| 2024-10-10 | Held | 0 | 960 | 20 |

The prospective eligibility rule required at least 12 complete windows on every listed day. The final 384 seconds fall outside the registered 21 windows. Files were received as opaque source bytes for hashing. Two separate native implementations inspected their timestamps and the presence of specified fill tokens in the two measured fields. Neither retained copies of those raw records in this publication. The independent process re-retrieved fourteen files totaling 85,902,474 bytes, verified every original SHA-256, and checked all 1,209,600 vector timestamps. On the missing day each electric channel contains exactly 86,400 literal `99999.00` tokens. Electric missingness was simultaneous in both components on every date. These findings concern the distributed variation product and do not distinguish instrument outage, archive gaps or distribution processing.

## Physical question and source boundaries

USGS defines E-N/E-E as the north/east electric components in mV/km, and X/Y as geographic magnetic components in nT. Its catalog identifies BOU at 40.137°N, 105.237°W. The instrument paper describes orthogonal pairs of Ag/AgCl dipoles at nominal lengths of 100 m and 200 m. The service returns one north/east electric pair for this request and leaves its physical dipole length unspecified. October 12–14, 2016 and the published example figure were treated as prior exposure. The timing probe used only that example's official text headers. The service describes digital magnetometer sampling at 100 Hz with centered, 123-tap, 10-Hz-to-1-Hz vector filtering. The paper reports a 30,000-second analog high-pass in the electric acquisition. Neither record independently calibrates axis-specific electric gain and delay. [Instrument paper](https://doi.org/10.5194/gi-2017-27) · [USGS data contract](https://www.usgs.gov/tools/web-service-geomagnetism-data)

The released bezpy v0.1.1 package supplies a BOU conductivity profile and its layered-Earth frequency response. Its maintainers explicitly describe the original BOU profile provenance as uncertain. For an isotropic one-dimensional conductivity structure and frequency-independent real distortion, the horizontal impedance takes the form `Z(ω)=z(ω)A` for a fixed real matrix A. When the real part is invertible, the established phase tensor is a scalar multiple of the identity. Axis-dependent gain, timing, filtering and imperfect magnetic excitation all constrain its interpretation. The study had registered a development magnetic Gram eigenvalue ratio of at least 0.01 in each frequency band. The availability refusal preceded calculation of any such ratio. A single complex magnetic vector at one frequency cannot identify a free 2×2 response at that frequency. [Caldwell, Bibby and Brown](https://doi.org/10.1111/j.1365-246X.2004.02281.x) · [Pinned author code and BOU profile](https://github.com/greglucas/bezpy/tree/3ac04d05f354d891c1df2011ce2d50780589cf7f/bezpy/mt)

The intended endpoint used contemporaneous magnetic input throughout a full Hann window. It was an offline conditional prediction of measured electrode fields. The direct layered response, seven calibrated or reference roles in total alongside the project candidate, finite bands and scoring unit are fixed in protocol.json. The nearby COP24 survey used different physical coordinates, and published LiveWire electric targets were synthesized from magnetometry. Neither provides the missing BOU electrode readings. A preliminary generic metadata request ended at DNS resolution. The later comparison with an actual pinned magnetotelluric data client authenticated the official element catalog and showed that the client's geomagnetic importer assigns magnetic metadata in its conversion path. Electrical units here come from USGS itself. [LiveWire data and methods](https://doi.org/10.1029/2024JH000151)

Run `python3 replay.py .` for an offline verification of both original mask receipts. With access to the official service, `python3 independent.py` retrieves the fourteen pinned files and independently counts lexical missing markers and timestamps. `availability.py` implements the first prospective gate. The physical predictor remains unexecuted. The native originals, failed metadata request, exposure limits and zero numerical responses stay visible in this record.
