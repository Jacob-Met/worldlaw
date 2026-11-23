# Three polarizer images predicted a fourth better without registration

The co-located linear-analyzer identity gave the lowest mean error on 15 scenes in Morimatsu and colleagues’ TokyoTech Color-Polarization Dataset. Adding a correction for motion and brightness drift increased mean green-channel RMS error from 0.006853 to 0.010457 on a 0–1 scale, a 52.6% increase. The correction helped four scenes and reduced the largest scene RMS. It also amplified errors around sharp edges. Twelve reserve scenes remain unopened.

## The measurement

The authors rotated a SIGMAKOKI polarizer in front of a JAI CV-M9GE 3-CCD camera. Each 1024 × 768 RGB image averages 1,000 acquisitions at that analyzer orientation. We used the complete green images at 0°, 45° and 90° to predict the separately acquired green image at 135°. We report the exported 16-bit PNG intensity divided by 65,535. The paper describes 10-bit camera acquisition. The published averages do not expose the individual frames, fourth-exposure motion, or elapsed time between positions.

A deterministic split on scene names kept numbered siblings together and assigned 13 scenes to training, 15 to development and 12 to reserve. The two outdoor scenes both fell in training. Every method received the same three development exposures. Training labels from the 13 training scenes were available to the fitted controls. All 165 full-resolution development forecast maps were sealed before a separate scoring process read the 15 target exposures. That process first verified the complete 519,087,540 forecast-file bytes and all three input PNG hashes per scene against the locked manifest. The main metric averages per-scene RMS errors over the 736 × 992 interior, giving each scene equal weight. Full frames, borders, high-gradient regions and bright and dark donor pixels are retained separately. Pixel counts and repeated instrument exposures describe support, not independent replications.

## Predictions

The nominal forecast is the clipped sum I0 + I90 − I45. The proposed correction estimated translations from donor edges and extrapolated the fourth position under the angular law tθ = c + a cosθ + b sinθ. This law implies t135 − t0 = (1 + √2)(t90 − t45). For brightness, each donor tile supplied a log intensity slope among pixels with low observed curvature across the first three angles. The model then extrapolated that slope to the fourth angle. The full formulas, thresholds and support are fixed in development-freeze.md and course.py. The study did not independently measure the wedge trajectory or fourth-exposure illumination.

| Forecast | Mean interior RMS | Mean high-gradient RMS |
| --- | ---: | ---: |
| Co-located Stokes identity | 0.006853 | 0.017184 |
| Gain correction alone | 0.007277 | 0.017542 |
| Local regression including physical outputs | 0.008456 | 0.017964 |
| Affine response | 0.008707 | 0.020056 |
| Local 5 × 5 ridge regression | 0.008714 | 0.018964 |
| IGRI2 with synthesized fourth mosaic quarter | 0.009408 | 0.024345 |
| EARI with the same quarter | 0.009554 | 0.024424 |
| Angular shift alone | 0.010219 | 0.025955 |
| Angular shift and gain, primary | 0.010457 | 0.026119 |
| Last donor with extrapolated gain | 0.011448 | 0.026461 |
| Unit-background orthogonal complement | 0.575695 | 0.533186 |

Unmodified EARI and IGRI2 functions at commit bef123c5024aca12ef0eeae70fb98fedd665bf13 ran under Octave 8.4.0 with its image 2.14.0 package. In their usual demosaicking benchmark, a digital mosaic contains measured 135° samples at one quarter of its locations. We populated that quarter using the three-image nominal forecast. This synthetic sampling step supplied no measured 135° development value to either function. The endpoint was the independently recorded physical 135° exposure. These results concern this missing-channel adapter. The pinned monochrome demo builds MPFA, then calls the functions with undefined BayerDem_RGB. A separate synthetic native fixture retained that error and directly exercised the published functions. An initial training reader accepted only DEFLATE and stopped on a ZIP STORE member before fitting. Its successor authenticated seven existing image files and handled both publisher formats.

## Where the assumption failed

The primary candidate passed full support and the maximum-scene guard. Its worst scene RMS was 0.017271, versus 0.019218 for the strongest mean comparator. It failed the five-percent mean improvement, ten-of-fifteen wins and high-gradient guards. The largest pixel error occurred in its worst scene, doll2, at zero-based row 714, column 506. The four measured green counts were 7,853, 4,602, 6,422 and 7,481. The co-located forecast gave 0.14760 against 0.11415 measured. Gain alone gave 0.14812, shift alone 0.86866 and their combination 0.87159. This ablation locates the large discrepancy in the proposed resampling on that edge.

In the training scene outside, the nominal RMS was 0.07144, EARI 0.07148 and IGRI2 0.07153. At row 44, column 944, nominal error reached +0.57939. All 225 pixels in its 15 × 15 neighborhood exceeded +0.53476. The interior scene median was −0.00243 and the two upper quadrants had opposite signed mean errors. A uniform offset cannot account for the complete spatial pattern. These observations do not distinguish illumination changes, scene movement or other acquisition differences.

An exact ambiguity persists even in a spatially uniform field. The three donors 0.36, 0.432 and 0.5184 can arise from unpolarized light increasing by ×1.2 per angular step, giving 0.62208 at the fourth exposure. A stationary field with Stokes values (0.8784, −0.1584, −0.0144) gives exactly the same three donors and a fourth value of 0.4464. Both states are admissible. Any three-image predictor has absolute error of at least 0.08784 in one of these two examples. This is a bound for this constructed pair, separate from the measured errors.

## Reproduction

Run `python3 replay.py` to reconstruct the frozen decision from the measured sufficient statistics and check the ambiguity with rational arithmetic. An independent receiver read all 165 locked maps and each source PNG, recomputed 990 scene/method/slice sums, and checked all 495 retained worst-pixel witnesses. Its maximum absolute difference in an unnormalized sum was 1.56 × 10⁻⁸.

For a complete physical replay, use `python3 replay.py --physical NEW_WORK_DIRECTORY --runtime RUNTIME_JSON`. The directory must be empty. The supplied runtime JSON identifies the unmodified author source checkout, Octave executable, environment overrides and image package directories. README instructions for producing that file are in replay.py help. The launcher first receives the 13 training sets, then computes and seals all 15 development forecast sets. Only a separate invocation of the score process opens the 15 measured fourth exposures. It then executes the independent receiver. The archive URL and exact ZIP member CRCs and byte ranges are in source-freeze.json. No source images or predicted image maps are redistributed. The native receipt identities and limited comparison are in evidence.json.

A prior source screen checked all 18 MultiPolar archives, containing 32,400 numbered exposures, 44 BMP masks and 45 MATLAB masks. The released files did not establish the custom video-to-BMP coordinate transform needed to identify withheld native photosites. Its image intensities stayed sealed. The TokyoTech sequentially rotated analyzer provided a separately measured target for this study.

Morimatsu, Monno, Tanaka and Okutomi, *Monochrome and Color Polarization Demosaicking Using Edge-Aware Residual Interpolation*, ICIP 2020, and their 2021 IEEE Sensors Journal IGRI work provide the measurements and methods. [TokyoTech dataset](http://www.ok.sc.e.titech.ac.jp/res/PolarDem/index.html) · [Pinned author functions](https://github.com/ymonno/EARI-Polarization-Demosaicking/tree/bef123c5024aca12ef0eeae70fb98fedd665bf13) · [MultiPolar dataset](https://doi.org/10.17632/bkb7sdsywj.1)
