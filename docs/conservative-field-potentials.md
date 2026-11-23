# Conservative field potentials on measured periodic stencils

On a uniform periodic grid, two adjacent cells enter the measured field row as `left` and `right`. A fitted `gradient(phi)` computes (phi(right) − phi(left))/(2h). A fitted `laplacian(phi)` computes (phi(left) − 2phi(center) + phi(right))/h². Each sum over the periodic grid vanishes when the potential is defined on the required stencil. The operand may combine the field, one, and pointwise scalar operations. The acquisition supplies the local command only, so spatially differentiating a command or another derivative is outside the available observation.

The old source terminals are field, command, dx and dxx. Take center and command zero. At spacing 1 with neighbors 0 and 2, or spacing 1/2 with neighbors −1/4 and 3/4, both derivative terminals are dx=1 and dxx=2. The centered derivative of the squared field is respectively 2 and 1/2. Any function of the four old terminals returns the same prediction on both rows and therefore has maximum absolute error at least 3/4. Evaluating the potential at the measured neighbors recovers both values. This statement concerns the discrete flux across grids. A continuous chain-rule identity does not imply the same identity for these centered differences.

## Source-defined numerical comparison

The executable comparison in `tests/conservative-stencil.test.mjs` gives all three fits identical 33 training rows on three rings. It scores each on the same 25 changed rows across two new grid sizes, spacings and phases. The ordinary quadratic SINDy control fits and refits its active columns after sequential coefficient thresholding at 0.01. The two grammar fits have the same four-node, two-term and beam-eight settings. Only the proposed fit can apply a derivative to a pointwise potential.

| Physical rate | Quadratic SINDy max error | Prior grammar max error | Stencil grammar max error |
| --- | ---: | ---: | ---: |
| Gradient of square | 0.1993 | 0.1724 | 2.78e−17 |
| Gradient of tanh | 0.0296 | 0.0287 | 1.11e−16 |
| Laplacian of sine | 0.0217 | 0.0284 | 3.33e−16 |
| Laplacian of absolute value | 0.1145 | 0.1211 | 5.55e−17 |
| Linear diffusion | 1.11e−16 | 1.11e−16 | 1.11e−16 |
| Actuated gradient of square | 0.1143 | 0.0813 | 2.78e−17 |

At absolute derivative tolerance 1e−9, the two controls each pass one of six laws and the stencil grammar passes six. All six fitted stencil models also pass the independent changed-input trajectory check. It integrates the raw physical formula with 32 midpoint steps per saved interval on a 14-cell ring with a new spacing, initial phase and sinusoidal command. Across all saved states the largest position error is 3.46e−10 on the actuated flux. These are six authored numerical laws with direct rate supervision. The existing frozen development, calibration and evaluation worlds are separate datasets.

The model still sees only one ring. Two fields can agree at the center and immediate neighbors yet differ by two in a second neighbor. Their corresponding five-point fourth differences at spacing one also differ by two. Every predictor confined to the observed ring has a worst error of at least one on those rows. The public fit abstains under a 0.99 error gate.
