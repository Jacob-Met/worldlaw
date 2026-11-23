# Galileo E5b carrier-range increments at a split antenna

The equal-noise two-receiver correction passed two of four development criteria. It reduced mean hourly RMS error from **3.91547 to 3.84114 mm** against each receiver's own first-order dual-frequency estimate. A two-coefficient fit from the same four measurements reached **3.80963 mm** and won the worst-hour comparison as well. The joint criterion failed. The final six hours of carrier observations remain unopened.

## Acquisition and observable

Daniele Borio, Melania Susi and Kinga Węzka released 1 Hz RINEX 3.04 observations from two static Septentrio PolaRx5S receivers connected through a GPS Source S14 splitter to one LEIAT504GG antenna in Warsaw on March 8, 2024. Both receivers report firmware 5.5.0. All 48 hourly observation headers were checked. The prose names WUT300POL for the first receiver, while the archive roster, enclosed files and serial 3069597 identify WUT000POL. The second receiver has serial 4100503. The analysis reads no navigation file. [Original observations and README](https://doi.org/10.5281/zenodo.15118153)

For each receiver, the measured endpoint is the change in Galileo E5b phase (L7Q), in metres, between two epochs 60 seconds apart. Both receivers' E1 and E5a changes over the **same** interval are available at issuance. This is conditional prediction of an instrument reading. It gives no advance-time, position, receiver-noise identification or independent ionosphere measurement. Both E5 components belong to the transmitted AltBOC signal. Receiver filtering, carrier tracking, inter-frequency correlations and clock handling matter. The author release cites quad-frequency Hatch–Melbourne–Wübbena combinations, which use a different observable and information set. Phase in cycles uses c = 299792458 m/s and frequencies 1575.42, 1176.45 and 1207.14 MHz. RINEX missing observations may be blank or zero and blank LLI can mean OK or unknown. [RINEX 3.04 Appendix A](https://files.igs.org/pub/data/format/rinex304.pdf) · [Author combination](https://doi.org/10.33012/2024.19793)

## What the receiver pair can predict

Let a₀ and a₁ be the receivers' E5a changes, and d₀ and d₁ their E1 minus E5a changes. Define m=(d₀+d₁)/2 and d=(d₀−d₁)/2. A frequency-independent receiver term and a common first-order slant term proportional to 1/f² yield interpolation coefficient q=1381457/12173057. The own-receiver estimate is aᵣ+q dᵣ. For a primary receiver-pair correction use aᵣ+q m±d/2, with plus at WUT0. Its assumptions give equal, independent observation errors in metres. Both estimates have exactly the same pair mean in ideal arithmetic. Any change in their squared errors comes from the receiver difference. A common extra term proportional to (1/f−1/f₁)(1/f−1/fₐ) vanishes at both donor frequencies and can shift E5b at both receivers by any amount. Two receivers alone cannot identify such a component.

The primary predicts the disagreement with coefficient 0.5. The morning fit obtained 0.873385 for disagreement and 0.117650 for the mean. The full affine controls used the same four measurements and had rank five including the intercept. Single-core training used 6,027 complete paired windows in hours 00–11 GPS. The donor-only forecast for 12–17 finished at 16:52:42 UTC on the execution date. The distinct outcome receiver started at 16:54:16 after the forecast hash entered Git. All eight procedures used the same six measured evaluation hours.

| Procedure | Mean hourly RMS (mm) | Worst hourly RMS (mm) |
|---|---:|---:|
| affine_huber | 3.81525 | 4.30510 |
| affine_ls | 3.81008 | 4.29720 |
| average_slope | 3.94566 | 4.41992 |
| differential_fit | 3.81291 | 4.29534 |
| iid_corrected | 3.84114 | 4.32015 |
| nearest_a | 7.11494 | 8.44832 |
| own_first_order | 3.91547 | 4.39078 |
| symmetric_fit | 3.80963 | 4.29264 |

Among 2,830 observed satellite-windows, 2,717 qualified on donor coverage and flags. All 2,717 had both finite E5b endpoints and clean target flags throughout the 61 samples. The hourly counts were 443, 374, 389, 474, 508 and 529. The linear correction gained 0.07433 mm on mean and 0.07063 mm on worst hour against own-first-order, but lost 0.03152 and 0.02751 mm to symmetric_fit. Multiple windows repeat satellites, sky conditions, clocks and receivers within a single day. These observations provide no sampling interval across sites.

## Largest miss

At 12:08–12:09 GPS, E36 at WUT0, E1 and E5a increased by 30,953.503925 and 30,953.430241 m. The other receiver measured 32,058.105793 and 32,058.044342 m. The primary predicted 30,953.440967 versus 30,953.471452 m observed, a **−30.4851 mm** error. Own-first-order missed by −32.849 mm. Both receivers retained all 61 target observations with clear stored LLI. Those flags do not distinguish tracking error, atmospheric structure or receiver clock effects. The independent source reader preserved all 122 rows and the native phase counts in raw-worst-window.json.

## Reproduction

Obtain the two observation ZIPs from Zenodo, keeping their original filenames. From this directory run `OPENBLAS_NUM_THREADS=1 python3 replay.py /path/to/archives` with NumPy installed. The script authenticates both complete archives, reproduces the development forecasts and score, and independently recounts the native donor/target projection. Decompression reads full mixed observation records; the forecast parser numerically selects only E1/E5a in hours 12–17. No later-hour data rows enter any reader. The byte-exact frozen compressed bank and score, including the full donor census and forecasts, are identified in result.json and development-lock.json. Readers with those objects can run `python3 cold_recount.py forecast.json.gz score.json.gz` using the standard library. The independent Decimal recount compared 43,472 forecast components and 208 score summaries (maximum discrepancy 2.15×10⁻¹³ m on summaries). A separate original rebuilt 16,712 source component records, all eight worst-case identities and the six-hour roster in combination with the cold recount.

The first two metadata originals failed on public DNS. A later original obtained the first complete archive and first 178,343,876 bytes of the second before curl reported a truncated transfer. A distinct resume preserved that fragment, completed both archives, verified both source MD5 and SHA-256 values, and exhausted the 48 headers before analysis. The original run order, retained failures and all decision criteria appear in native-receipts.json, source-protocol.md and prospective.md.
