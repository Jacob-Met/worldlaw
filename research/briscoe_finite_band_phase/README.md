# Finite-band phase correction for a rubidium crossed analyzer

Adding atomic-model spectral wings to the measured finite-window Hilbert estimate increased error in all four rubidium transmission scans. The **physical comparison is postscore**. The four forecasts were locked before any crossed-analyzer intensities were read, but the registered receiver missed the archive's documented ordinate offset.

## Measurements and predictions

Briscoe et al. recorded separate circular, horizontal and crossed-linear transmission scans of one 2 mm enriched rubidium vapor cell under a longitudinal magnetic field. For each indexed repeat, the procedure used the two circular and horizontal scans and the detuning coordinates of the crossed scan. The qualitative published fits and typical analyzer/frequency offsets were known. No measured crossed intensities, final fits, or saved notebook outputs entered model fitting or forecasting. The transverse-field records involved a different specimen/reference and were excluded. [Paper](https://doi.org/10.1088/1361-6455/ad5e24) · [Author archive](https://doi.org/10.15128/r2x920fw90c)

For circular intensity transmissions L and R, the ideal crossed intensity is `(L+R−2√(LR) cos(δ+2β))/4`. Out-of-band absorption, possible all-pass fields and a constant relative phase confounded with analyzer angle limit phase identification. The hybrid adds half the Hilbert transform of the measured-minus-modeled differential log transmission to the atomic phase. The source-only fit used two circular assignments, two numerical starts, three complete source spectra, temperature, magnetic field and detuning offsets. The direct common-grid FFT has identical measured circular amplitudes. The own-axis implementation uses nominal equal bin centers and endpoint continuation, whereas the paper's bin coordinates are empirical means. Authentic ElecSus v3.0.8 supplied the complex susceptibility and numerical physical control. The separate synthetic gate checked full field and intensity paths. [ElecSus source](https://github.com/durham-qlm/ElecSus/tree/1933456b905739fb31c89665cdc6733e769e5ec0)

## Original failed receiver

The registered receiver used the deposited crossed-filter ordinate directly. The hybrid binned RMSEs were 0.999955, 0.999434, 0.999667, 1.000408. All four gates failed. Repeat 4 bin 420 had archived ordinate 1.162915 and prediction 0.151209. A separate standard-library 52-digit recount checked all 6.8 million native role residuals, 160 metrics, 80 extrema and 28 adjacent bins. Maximum metric difference was 2.99e−14. The original score and receiver are preserved.

The fitting notebook (zero-based cells 5, 17, 26, 35 and 45) and Figure 3 plotting notebook (cell 9) explicitly convert **physical transmission = archived crossed ordinate − 1**. That published rule was confirmed after scoring. The diagnostic applies exactly that rule to all 680,000 native rows. All predictions, detuning bins, controls, sample membership and weights are unchanged. Negative measurements are retained. No held normalization or calibration was fitted.

## Whole-scan binned RMSE in physical transmission

| Locked role | Repeat 1 | Repeat 2 | Repeat 3 | Repeat 4 |
|---|---:|---:|---:|---:|
| atomic wings measured residual | 0.004008 | 0.004182 | 0.003899 | 0.003832 |
| direct common fft | 0.003301 | 0.003500 | 0.003213 | 0.003154 |
| native source fit | 0.004428 | 0.004251 | 0.004174 | 0.004061 |
| direct own axes fft | 0.003281 | 0.003541 | 0.003375 | 0.003740 |
| zero phase | 0.030135 | 0.029770 | 0.029863 | 0.030048 |
| half incoherent | 0.466520 | 0.467088 | 0.466999 | 0.466403 |
| reversed atomic wing correction | 0.002635 | 0.002871 | 0.002582 | 0.002524 |
| hybrid analyzer plus 1deg | 0.007192 | 0.007344 | 0.007066 | 0.006933 |
| hybrid analyzer minus 1deg | 0.001589 | 0.001900 | 0.001653 | 0.001599 |
| pure model phase measured amplitudes | 0.004399 | 0.004261 | 0.004125 | 0.004046 |

The hybrid beat source-only ElecSus in 4/4 and lost to both direct FFT controls in 4/4. The reversed correction beat the hybrid on all four. The predeclared −1° analyzer sensitivity had the lowest RMSE. A constant relative phase and analyzer offset enter the same cosine, so this ordering does not identify the angle. The maximum actual change from adding the atomic wing correction was 0.003181 across all grids. The distinct theoretical pointwise envelope is in each lock.

The largest corrected candidate bin error was repeat 2, −4.98952 to −4.84262 GHz. Measured mean transmission was 0.183574 and the candidate predicted 0.203300. The raw worst acquisition rows, nearby bins and every same-row alternative are in both full score files. These are four repeats under one cell/field condition, with neighboring frequency points sharing calibration and processing.


## Which processed columns reproduce the raw acquisition?

A second 52-digit independent receiver reproduced all 160 physical-coordinate metrics to 9.89e−15, all 80 extrema and all 28 neighboring rows. It separately compared each of the four published measurement columns against two explicit binning conventions. Omitting the first raw row, as with the notebooks' inferred CSV header, reproduces all 750 published detunings per repeat within 6.55e−11 MHz when the original GHz coordinates are multiplied by 1000. The processed headers say GHz even though their numerical coordinates follow MHz. This alternate binning is used only to audit the exports. All forecast scores use every raw row.

For repeats 1–3 the released processed measurement column matches the raw bin means minus one with RMS discrepancies below 4.3e−16. **Repeat 4 matches the raw means minus two**, with RMS discrepancy 4.78e−17. Its processed measurement column ranges from −1.002951 to −0.739767. The analysis of physical transmission uses raw minus one identically for all four. The source documents an additional subtraction in an export path, but the archive does not establish the execution history of each CSV. The physical independent receiver's first original refused its commented four-column header. Its successor handled that literal header and retained the original error receipt.

## Reproduction

The full author ZIP is 107,468,871 bytes, SHA-256 `fc370bdedf30167fcc4737f5da0e4b235caec53db7de8e6a679f28e2ccb16c07`. Protocol and predictor source was fixed at `14fdd13266a359a5449132be27147f6671a19f43`; all four forecast arrays were received before target opening at `dc33d0646696b6e940fa7b46841240da7471b9b3`. Original NumPy headers, binary64 values and per-role digests are preserved. Run `python3 replay.py .` in this directory for offline array and receipt verification. Both `independent_recount.py` and `independent_author_ordinate.py` fetch the complete public archive, authenticate it, and independently compute native and binned errors using the Python standard library. All four released measurement columns were consulted only in the postscore audit. The author joint-fit curves never entered a prediction.
