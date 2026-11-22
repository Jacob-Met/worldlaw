# Kuopio tank voltages under repeated current configurations

On three public KTC2023 **training** phantoms, a water-referenced electrical model predicted 14 withheld current configurations with a mean RMSE of **2.0330 mV**. A source-fitted blend scored 2.1869 mV and unconstrained superposition scored 2.2008 mV. The model ranked first on each phantom. It did poorly on the four configurations that repeated the same drive orientation. There, directly transferring the corresponding water-referenced reading scored **0.0305 mV**, compared with **1.7957 mV** for the model. The other ten configurations reversed polarity. On those, the two methods scored 3.7017 and 2.1154 mV respectively. Orientation was examined after scoring. The prespecified results and all eleven forecasts are retained.

The experiment tests voltage prediction on one 32-electrode tank. The released geometry also gives a separate limit on missing electrodes. Across the six partially observed challenge layouts, every one of 7,753 omitted level/drive/readout positions has an explicit ambiguity under reciprocal, strictly passive terminal laws. Predicting a repeated excitation uses information absent in those missing-contact problems. The 21 actual competition phantoms and all photographic segmentations remained unopened. [Organizer instructions](https://fips.fi/wp-content/uploads/2024/06/KTC2023_Instructions_v3_Oct12.pdf) · [Corrected public dataset](https://doi.org/10.5281/zenodo.10986692)

## Inputs, experimental units and controls

Sixteen odd-numbered contacts can inject current. All 32 participate in voltage measurement, giving 31 adjacent voltage differences per injection. The 76 published configurations comprise 62 unoriented contact pairs. Fourteen pairs appear twice. We kept the first listed acquisition for each pair and predicted the second listed acquisition of all fourteen simultaneously. Every predictor received the same target specimen's 62 allowed columns. The query geometry was known. The signed currents in the files ranged from 1.4100 to 1.5142 mA in magnitude. The reported voltages are signed real values in volts.

Water and public training phantom 1 supplied calibration. All 76 columns of these two separate tank configurations were available for choosing and fitting source controls. Each of public training phantoms 2, 3 and 4 was then scored once. Each phantom contributes 434 observed voltages, with equal weight across the three per-phantom RMSEs. Voltage edges and injections within a phantom share the same physical apparatus, water reference and measurement process. The acquisition files establish the order of stored columns. They provide no timestamp or independent noise realization certificate for these pairs. This experiment does not forecast a later time, isolate contact impedance, or estimate a new tissue or material property.

The trusted loader authenticated each full MATLAB file, then decoded the current and differential-readout matrices. It read only the 62 selected contiguous voltage blocks for same-phantom prediction. It checked the current and readout matrices against the water file before emitting any forecast. The exact 33-array archive was locked before either scorer decoded the fourteen target voltage blocks. The mean controls were fixed in advance. [Author release with the four public training cases](https://github.com/alexdenker/ktc2023_postprocessing/tree/5f0b13f807d3482e964f236ada6e86b5c66477f5)

For the raw linear model, each measured voltage is a linear functional of the supplied current vector. The water-referenced version models the difference from the matching water record, then adds that configuration's water voltage back. The amplitude factor for direct transfer is the signed ratio of the two currents on the same electrode pair. Supplying water for the known query configuration is part of the information budget. It does not require observing the target specimen at that configuration.

In the reciprocal model, let \(B\) contain the measured edge patterns and let \(U\) span the currents. For current coordinates \(K=U^T J\), the model fits \(Y=XK\). Since \(U=BC\), a reciprocal terminal operator requires \(C^T X\) to be symmetric. The candidate estimates \(X\) by generalized least squares under this constraint. It estimates a 31-by-31 weighting matrix from the fourteen water-subtracted phantom-1 repeat discrepancies and shrinks it halfway toward an isotropic matrix. This weighting can include instrument structure and source-model error. It is a covariance proxy, without a measured independent noise model. A separately assembled dense KKT system verified the constrained solver to 1.78×10⁻¹⁵ on an independent small numerical case. When the column set is complete across all 31 readouts and the constraint is removed, a common nonsingular left weighting does not change the least-squares minimizer.

Matched controls included the water reading alone, direct same-pair transfer, unconstrained superposition, unweighted reciprocity and an equally constrained model that reverses only the voltage-edge association. Two empirical controls were fitted using the conditioning specimen alone. One transferred its per-configuration residual to each new specimen. The other mixed 74.3573% of the weighted reciprocal estimate with 25.6427% of the direct water-referenced estimate. No weights were selected on phantoms 2–4.

## Forecast results

All entries are RMSE in mV. The last column is the unweighted mean of the three phantom scores. The eleven roles and all 14,322 forecast values are included.

| Method | Phantom 2 | Phantom 3 | Phantom 4 | Mean |
|---|---:|---:|---:|---:|
| Water query alone | 33.8860 | 28.0818 | 33.7297 | 31.8992 |
| Raw same-pair transfer | 46.8654 | 42.6932 | 44.1816 | 44.5801 |
| Water-referenced same-pair transfer | 3.6288 | 3.6419 | 2.1150 | 3.1285 |
| Same-pair transfer plus source configuration bias | 6.0178 | 6.3660 | 4.4577 | 5.6139 |
| Raw unconstrained superposition | 25.3919 | 22.8400 | 24.4114 | 24.2144 |
| Water-referenced superposition | 2.6176 | 2.8353 | 1.1497 | 2.2008 |
| Raw reciprocal | 25.4348 | 22.8620 | 24.4325 | 24.2431 |
| Water-referenced reciprocal | 2.6278 | 2.8310 | 1.1261 | 2.1950 |
| Water-referenced reciprocal, covariance weighting | 2.4148 | 2.6051 | 1.0793 | 2.0330 |
| Same constraint dimension, reversed edge order | 7.1686 | 10.8602 | 1.3695 | 6.4661 |
| Source-fitted reciprocal/direct blend | 2.5484 | 2.7249 | 1.2875 | 2.1869 |

The registered gate required lower mean error and a win on at least two of three specimens against each of four physical controls and two stronger empirical controls. Both parts passed. The independent receiver used a separate MATLAB reader and direct scalar residuals. It reproduced all 33 RMSEs and MAEs, all 462 per-configuration RMSEs, every arm's worst coordinate and voltage, and both gate decisions. The original tables also retain each arm's error under the source covariance metric.

### Largest candidate error

Phantom 3, configuration 31 and edge 30 produced an observed **−0.733988287 V**. The candidate predicted **−0.752082777 V**. Donor configuration 16 applied exactly the same signed current, +1.5052 mA at contact 31 and −1.5052 mA at contact 1. Its observed voltage was −0.733920130 V. The water measurements for donor and query were −0.737016880 and −0.737035400 V. This is the largest candidate miss across all three cases. Direct transfer at that row was substantially better. The table gives signed prediction minus observation in mV at this identical coordinate for every arm.

| Method | Signed error (mV) |
|---|---:|
| Water query | −3.04711 |
| Raw same-pair transfer | +0.06816 |
| Water-referenced same-pair transfer | +0.04964 |
| Same-pair transfer plus source bias | +0.04972 |
| Raw superposition | +23.98383 |
| Water-referenced superposition | −18.30417 |
| Raw reciprocal | +24.50125 |
| Water-referenced reciprocal | −18.33638 |
| Weighted reciprocal | −18.09449 |
| Reversed edge order | −25.21189 |
| Source-fitted blend | −13.44185 |

The native worst-case packet contains both complete 31-edge voltage vectors, both water acquisitions, the signed drive vectors, every forecast on that acquisition and each arm's error at the selected edge. The comparable polarity table includes all four same-direction and ten reversed-direction patterns. It records a tradeoff and leaves the eleven locked forecasts untouched.

## Which missing measurements are determined by the geometry?

Let \(u\) be an injection column in mA and \(v\) a signed edge readout. A terminal impedance operator \(R\) on the zero-sum electrode space gives the voltage \(v^T R u\). A common potential offset cancels. The linear reciprocal phasor convention is \(R=R^T\). Passivity uses the real part of conjugate power, or the Hermitian part of \(R\). Real positive definite examples suffice for the ambiguity below. Stable linear contacts and a common effective current convention are assumptions. The supplied currents alone do not calibrate the front-end gain, injection trajectory or phase for each acquisition.

For a retained layout let \(p\) be the dimension of the available current span and \(q\) the dimension of the sensed edge span. The former lies in the latter. A general linear terminal map yields \(pq\) degrees of freedom in the observed data. Reciprocity reduces this by \(p(p-1)/2\). Repeated and scaled injections increase the number of recorded readings without increasing those dimensions.

| Level | Kept readings | Current rank | Edge rank | General dimension | Reciprocal dimension | Omitted readings with an ambiguity |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2,356 | 15 | 31 | 465 | 360 | 0 |
| 2 | 1,624 | 14 | 29 | 406 | 315 | 732 |
| 3 | 1,404 | 13 | 27 | 351 | 273 | 952 |
| 4 | 1,200 | 12 | 25 | 300 | 234 | 1,156 |
| 5 | 1,012 | 11 | 23 | 253 | 198 | 1,344 |
| 6 | 630 | 10 | 21 | 210 | 165 | 1,726 |
| 7 | 513 | 9 | 19 | 171 | 135 | 1,843 |

For each omitted coordinate define \(A=uv^T+vu^T\) and let \(P\) project onto the zero-sum vectors supported on the retained contacts. The difference \(D=A-PAP\) contributes zero to every retained reading. At the query, \(v^TDu=\lVert D\rVert_F^2/2\). An integer-arithmetic check established that this quantity is positive for every omitted coordinate after normalizing the nonzero current amplitude. The separate numerical constructor uses the recorded amplitudes. Starting from identity on the zero-sum space, both operators \(I\pm D/(4\lVert D\rVert_F)\) are reciprocal and have energy eigenvalues at least 0.75 there, in the chosen V/mA scale. Their retained readings agree and their query readings differ. The constructor returns a pair for each requested omitted row, or the same-coordinate identity for a retained row.

These witnesses certify nonuniqueness within a broad passive terminal class around a strictly passive interior base. They do not construct two realizable saline conductivity maps with equal observations, or classify arbitrary boundary points with zero dissipation. The held repeat-voltage task uses full physical contact access and a query current in the admitted span. It does not solve this missing-port problem.

## Comparison with the image challenge

FIPS names the Bremen/UCL postprocessing U-Net the winning submission. Its released algorithm forms five linearized conductivity reconstructions using a precomputed empty-tank Jacobian and regularization matrices, then predicts a three-class image. The authors report training with simulated phantoms. The submission points to two external Bremen Seafile directories for the learned weights and system matrices. Neither resolved on the source worker, and the authors' repository has an unresolved report of inaccessible links. The tagged entry passes a directory to the checkpoint loader and sends the level tensor to CUDA explicitly. No timing, accuracy or failure of the trained network was measured here. The organizer's v3 images correct a camera cropping distortion and its restricted and full electrical files cover 21 distinct competition phantoms. This study used none of those voltages or masks. [FIPS result and correction](https://fips.fi/data-challenges/kuopio-tomography-challenge-2023/) · [Tagged winning submission](https://github.com/alexdenker/ktc2023_postprocessing/tree/5f0b13f807d3482e964f236ada6e86b5c66477f5) · [Checkpoint and matrix access report](https://github.com/alexdenker/ktc2023_postprocessing/issues/1)

## Replay

Run `python3 replay.py` in this directory to reconstruct all 33 little-endian arrays from decimal CSV values, authenticate their 117,362-byte archive and cross-check the two original scoring transcripts. Run `OPENBLAS_NUM_THREADS=1 python3 replay.py --score` with NumPy and SciPy for an independent fresh evaluation of the same three public training files. The numerical receiver loads full training files after the prediction lock. The pre-lock forecast entry uses selective voltage decoding. Exact original forecast bytes are also available in the task attachment recorded in `source-custody.json`.

The program used a single CPU worker and standard numerical linear algebra. The accepted prediction original is separate from the rejected oversized stdout request. The preregistration, prediction lock, source digests, numerical receipts and three byte-range reads of the original forecast file are recorded in `source-custody.json`. No model training, full challenge runs, GPU inference or new physical acquisition was performed.
