# Predeclared measured transfer to unused length5

This test uses the author's original air-only length5 (nominal 0.607 m) repetitions from immutable Damped_Pendulum_Dataset revision cbf82673641ecd65e902ad5c38a048387649a2a0 (Apache-2.0). Before acquiring any length5 original, the protocol froze the existing length3 (0.426 m) shared-law coefficients, inverse nominal length map, unchanged angular damping assumption, preprocessing, prefix search, screens, budgets and comparisons. The source law was trained only on the earlier length3 courses. This is an independently held receiving course under a declared protocol, not externally administered blind validation or evidence that nominal length establishes effective inertia.

Protocol SHA256: b2f5b2423a5faf00356f1daa3bfedf5305a12b00f6d642b1872a2f99733e1555.
Target repetitions1/2 acquired at 21:44:02/03 UTC train the seven local comparison laws. All nine laws were frozen at 2026-10-28T21:44:51.611Z, SHA256 afdf2184d881de3918f8f71f2d6ad0ce02905e0a594aff9ae0e714cfa0e42b2f. Receiving repetition3 was then acquired at 21:44:59.843487 UTC, SHA256 fd86c9e561af9ac94e8eeaf5f2ec6f6558e34f67965b47dd6af195e87c969e9f. Acquisition scripts preserve exact original bytes and hashes. Initial ordinary-sandbox networking was refused before any bytes were acquired; the supported approved public-download execution then succeeded.

Original 5–25 s timestamps, angle and supplied rate columns remain unchanged: 2001 rows, no smoothing, recentering or resampling. The first 101 original rows through6 s estimate initialization only; the following1900 rows score the continuous prediction. Channel independence is not assumed. The complete nine-law prefix/forecast work is reserved before execution. Every listed forecast passes both declared numerical screens.

| Frozen law | Observed-start suffix RMS / rad | Prefix-start suffix RMS / rad |
|---|---:|---:|
| Source length3 unchanged | 0.8494885322 | 0.8439337883 |
| Conditional inverse-length transfer | 0.0234378393 | 0.0397047875 |
| Local weak full-six | 0.8773816572 | 0.8905624430 |
| Local predictive full-six | 0.0384548498 | 0.0288782737 |
| Local maintained coordinate | 0.0455300337 | 0.0681622860 |
| Local position-only LM | 0.0277222561 | 0.0476920888 |
| Local joint-channel LM | 0.0268835199 | 0.0462162854 |
| Local shared-law/private-start LM | 0.0262850936 | 0.0266160272 |
| Local coordinate training starts | 0.0384548498 | 0.0288782737 |

The predeclared primary prefix-conditioned comparison improves markedly over the unchanged source-length law. However, prefix initialization worsens the mapped law relative to its observed-start forecast, and local predictive/shared-law training beats the mapped prefix forecast. All outcomes remain visible; this test does not select a winning law or initialization strategy afterward. It supports useful conditional geometric transfer across this setup change while retaining limitations of the initialization fit and unchanged-damping assumption.

The ordinary geometry-transfer session independently recomputed both original studies and exactly reproduced the frozen-model forecasts, including the stronger local shared-law result. Source-only notebooks retain all original data and explicit declarations, never cached coefficients or results. This course is now consumed evidence for future development and cannot be reused as an untouched qualification input.
