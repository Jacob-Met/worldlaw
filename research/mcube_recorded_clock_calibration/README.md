# How closely do the recorded robot and optical clocks align?

For one MIT MCube calibration sequence, shifting the logged tip position by 22 ms reduced the held-half error in predicting the optical marker coordinate from **1.1794 to 0.3925**. The shift looks forward. A marker reading logged at time t was best approximated by the arm-derived position logged at t + 22 ms, after fitting scale and offset on the first half. This is an offline alignment result on one instrument recording. It does not measure a hardware timestamp bias or provide an online predictor for that marker.

| First-half rule | Training RMSE | Second-half RMSE | Largest absolute second-half error |
|---|---:|---:|---:|
| Zero recorded-time offset, fitted gain and intercept | 1.10453 | 1.17940 | 2.38265 |
| Fitted recorded-time offset, gain and intercept | 0.39022 | 0.39246 | 1.35518 |

All errors are in the native optical-marker x-coordinate. Each half contains 4,859 common grid points from the same recording. These closely spaced points describe the two halves of one move sequence. They do not represent 4,859 independent calibration experiments.

## Same-row failure

At timestamp 1436880734721204637 ns, the marker reported 76.8646393. The fitted-offset model predicted 75.5094625, its largest absolute second-half miss. At the same row the zero-offset model predicted 77.6908654 and had the smaller absolute error, 0.8262261 versus 1.3551767. The tip coordinates used at zero and fitted offsets were 0.4574530452 and 0.4552439005, respectively. The full registered receiver retains this row.

## Measurement and forecast boundary

The calibration files are Output_tip_tcpvicon.txt and Output_vicon_tcpvicon.txt in peterkty/pnpush at c8352f5fe9a4f03aa07bf3753e04ca7898df6e1f. They derive from the separate tcp_vicon_delay.bag. The parser records the last Vicon marker's x coordinate and the x coordinate of the generated /tip_pose. The tip callback obtains the latest common transform between link_ft and base_link, then attaches the triggering joint-state message header. These are different observations and timestamping paths. Transform age, synchronization, motion and marker identity can all affect the fitted offset. The affine scale near 1,000 is consistent with different coordinate units; scores retain the exact marker coordinate as recorded.

The input files contain 3,411 tip readings and 4,136 marker readings, each with distinct timestamps. The median time steps are 11.661 ms and 10.009 ms. The two records overlap for about 39.945 s. The midpoint at 1436880721835204637 ns splits the recording without shuffling. The original estimator used a 4 ms grid, last-observation hold limited to 40 ms, and a margin so that the observations used for a half originate within that half. Each of the 251 offsets from −250 to +250 ms in 2 ms steps was fitted only on the first half, using the identical row roster. The five lowest training errors occurred at −22, −24, −20, −26 and −18 ms. A separate intercept and slope were fitted for zero offset. Exactly those two trained rules were evaluated on the second half.

This analysis preserves the source header times. It does not reconstruct acquisition or arrival times. The calibration's generated /tip_pose differs from the 2017 pushing converter, whose alternative pusher sources are the robot Cartesian log timestamp and the RRI message header. Its optical channel uses a tracked object pose. Transferring −22 ms to those streams would require an independent link between the release paths. No pushing recordings, terminal-pose outcomes or force-contact calibration targets enter these scores.

## Consequences for a separate pushing comparison

The published pdproc reader at b187315443eb269c95d2b1d6ce9e1ef047facf1b can use later observations at two stages. Its yaw-jump repair scans subsequent samples; its interval averaging and linear interpolation can span a query boundary. Selecting a prefix of such an already processed file cannot establish a causal predictor. The separate prospective policy in prospective-input-contract.md truncates raw channels first, uses backward-only sampling and preserves missingness. The supplied prefix reader has a sentinel test that refuses access to any future value.

A source-only synthetic comparison verified the original 2011 variational heteroscedastic Gaussian-process algorithm, as distributed in IPL-UV/simpleR at ced8e7b0063fee3a921e65c048f9df893e61a4ee. All 18 MATLAB source files matched their released Git blobs. Under GNU Octave 8.4.0, changing the three test labels changed the loss but preserved all three predictions and variances exactly. Neither those synthetic forecasts nor the clock calibration reproduces the published 2017 pushing checkpoint. Its square/plywood illustration uses a 0.2 s horizon; the full prescribed 10 mm motion at 20 mm/s takes 0.5 s. The separate conditional point-contact calculation and its assumptions are given in comparator-contract.md.

## Replay

Run `python3 calibrate_logtime.py` to fetch and authenticate the two original public calibration files and repeat the frozen analysis. Run `python3 metrology_recount.py` for an independently written standard-library reconstruction. It advances a cursor through each original source stream, checks every grid row, reconstructs all 251 first-half fits and both second-half predictions, and verifies the original worst row. Numeric results and both raw-file SHA-256 identities are in metrology-native-original.jsonl. These two replays need network access to the pinned public files. The source files remain with the authors. `python3 prefix_clock.py` and `python3 conditional_contact.py` run local synthetic checks without downloading data.

The author_vhgpr.py file preserves the original estate runtime invocation and verifies all published MATLAB source blobs. It assumes the named private Octave installation; the replay of measured calibration errors has no Octave dependency.

## Primary sources

- [Yu, Bauza, Fazeli and Rodriguez, original apparatus and measurement paper](https://arxiv.org/abs/1604.04038)
- [MCube organizer’s experiment definitions and data roster](https://web.mit.edu/mcube/push-dataset/index.html)
- [Original calibration acquisition, parser and text files](https://github.com/peterkty/pnpush/tree/c8352f5fe9a4f03aa07bf3753e04ca7898df6e1f/catkin_ws/src/pnpush_planning/time_delay)
- [Author-recommended preprocessing implementation](https://github.com/mcubelab/pdproc/blob/b187315443eb269c95d2b1d6ce9e1ef047facf1b/scripts/preprocess.py)
- [Bauza and Rodriguez, repeated pushes and heteroscedastic models](https://arxiv.org/abs/1704.03033)
- [Released algorithm implementation used for the synthetic qualification](https://github.com/IPL-UV/simpleR/tree/ced8e7b0063fee3a921e65c048f9df893e61a4ee/VHGPR)
