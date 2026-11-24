# A quarter-grid wave hides a genuine dispersive mechanism

On a uniform periodic grid, centered first difference D and three-point Laplacian Δ commute. For wave number k, DΔu = −μ(k)Du, μ(k) = 4 sin²(πk/N)/h². The independent omitted-mechanism simulator evolves u by −.06DΔu−.3D(u²) under zero command. Its matched local rival uses +.06μ(8)Du−.3D(u²).

The equivalence is exact throughout a particular nonlinear motion. A profile m+A sin(πj/2+φ) on 32 sites has nonconstant frequencies 8 and, after squaring, 16. The centered derivative kills the Nyquist frequency 16, so D(u²)=2mDu and the dynamics preserve a rotating quarter-wave. Both laws produce the same states, including under changed phase or amplitude, with the same mean. Under the source's shared sensor law their entire observation distributions coincide. Exciting an additional spatial scale breaks that relation. More generally, change only site j+2 by .2 on the grid with h=.25: the observed local triplet (j−1,j,j+1) is unchanged, while the true time derivative at j changes by −.384. No instantaneous function of that local triplet can reproduce both derivatives.

The estimator fits three columns Du, DΔu and D(u²) using 41-point compact temporal weak tests and the measured sine/cosine responses of the declared modes. A one-mode projection cannot separate the first two columns, even with exact observations. Its comparator reports the effective advection. The two-column local estimator and three-column dispersive estimator share the changed data, temporal windows, Fourier measurements, and normalized QR solve. The quadratic feature uses neighboring time-sample products to remove the additive independent sensor-variance term, at O(dt²) temporal bias for smooth data. The finite rank test concerns these three operators only.

After registration 194649, before simulation, parameters and the 11-point Fourier-shrunk forecast prefix were fixed in 194656. Measurements use the unmodified outside_dispersion procedure from Nullgarden 4af7717a866e0246e7c0bcd81977cea53cddbd8c, alongside a locally implemented Burgers-plus-advection rival with the same author-supplied initial augmentation on both arms. Repeat k8 or add k4+8 at equal total modal power, then forecast a new k3+6 preparation at the original 15/25/40 dB and seeds 19191/29009/41341. Each forecast is written before reading clean reference states. All 18 equal-cost fits, nine omitted comparisons and nine genuine local tradeoffs remain in the receiver. The twenty-law calibrated admission goal is separate.

From repository root:

    node --test tests/periodic-dispersion.test.mjs
    node scripts/receive-periodic-dispersion.mjs /path/to/nullgarden/src/state-operator-course.mjs
    node scripts/periodic-dispersion.mjs < request.json

The CLI accepts operation fit with recordings and a parallel list of tested modes, or operation forecast with model, eleven-sample prefix, grid spacing and a positive number of steps. The fit consumes only measured states, commands and declared modes. Future state observations cannot enter the forecasting interface.
