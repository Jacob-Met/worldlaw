# Distinguishing periodic half-domain coupling from local diffusion

On an even grid of N sites with spacing h, let μ(k)=4 sin²(πk/N)/h². Local diffusion D plus a half-domain shift of strength G gives a modal decay Dμ(k)+2G for odd k and Dμ(k) for even k. A local diffusivity D*=D+2G/μ(3) yields exactly the same evolution for a constant plus mode 3 for all preparation phases, amplitudes and times. With the same noise law the complete observation distributions coincide. Repetition cannot identify the mechanism.

The receiver ranks proposed excitations by the normalized determinant of their two-column decay-rate matrix. Adding an even mode to mode 3 separates the coefficients. The estimator profiles out the initial sine and cosine amplitudes and fits nonnegative coefficients. Eight equal, nonoverlapping block powers must show decreasing order at a one-sided exact permutation p-value of 0.01. This screens weak excitation under constant modal amplitude with stationary, independent Gaussian sensor noise. Resolving the two decay coefficients does not validate a whole physical mechanism.

The stdin CLI exposes three operations. To choose the next experiment:

    echo '{"operation":"design","observedModes":[3],"menu":[[3],[2,3]],"n":32,"spacing":0.25}' | node scripts/periodic-parity.mjs

For fit, supply recordings in the existing Worldlaw state-trajectory schema plus a list of deliberately excited modes for each recording. A rank-one fit gives the local comparator and explicitly reports rank_deficient. For forecast, supply model, 2–64 prefix observations, future times, grid spacing and the modes. No future measured states enter the API. It predicts the mean and declared modes for two spatially homogeneous linear models under zero command.

Prospective registration 194367 fixes two same-cost acquisitions, three seeds (19191, 29009, 41341), three noise levels (15, 25, 40 dB), and the actual Nullgarden omitted half-shift law versus its matched local rival. Both share the producer's initial mode injection and sensor construction. Repeat and changed queries have equal squared amplitude, grid and time budget. The fitter receives anonymized observations. Eleven observed samples initialize predictions on a third, untouched k1+3 preparation. Each forecast is written before reading reference states. The gate requires all 18 repeat fits to refuse joint identification, all 18 changed fits to permit joint estimation and all nine omitted-world mixed forecasts to beat both local fits. The 20-law composite admission and active-PDE error gates remain open.

    node --test tests/periodic-parity.test.mjs
    node scripts/receive-periodic-parity.mjs /path/to/nullgarden/src/state-operator-course.mjs .receipts/periodic-parity

Pin the independent Nullgarden producer to 4af7717a866e0246e7c0bcd81977cea53cddbd8c.
