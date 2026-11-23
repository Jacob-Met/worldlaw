# Ground titanium contact stiffness depends on which normal-loading phase supplies the reference

For seven interfaces, the full Mindlin ratio predicts the authors’ mean tangential reversal stiffness more closely than half that ratio when the reference is the preceding normal loading. Substituting the later unloading stiffness changes the preferred ratio at three interfaces and reverses the specimen-balanced average error. The measurements come from three physical specimen groups.

| Normal stiffness used | Full Mindlin | Half Mindlin | Multiplier fit on other specimens | Constant fit on other specimens |
| --- | ---: | ---: | ---: | ---: |
| Before shear, loading | 31.916 | 122.877 | **26.471** | 175.747 |
| After shear, unloading | 104.592 | **65.205** | 70.630 | 175.747 |
| Arithmetic mean of both | 54.661 | 94.041 | **50.228** | 175.747 |

Values are absolute errors in stiffness per nominal contact area, in kN/mm³. Each physical specimen group receives equal weight. Unloading occurred after cyclic shear. Only the first row uses a normal reference available before shear. The fitted multiplier improves on the fixed full-ratio prediction in that row.

## Apparatus and comparison

Parel, Paynter and Nowell loaded two titanium pads against a specimen, increased the tangential force cyclically, then removed the normal load. The load cell measured the total tangential force across both pads. The paper uses half that force per interface. A camera observed one contact. The investigators fitted displacement profiles on each side of a masked interface and extrapolated them to its center. This estimates the local displacement jump at the exposed surface. The normal stiffness comes from a fitted normal curve. The tangential target is the reported mean starting stiffness across retained loading and reversal steps. [Paper, methods and Tables 1, 2 and 5](https://pmc.ncbi.nlm.nih.gov/articles/PMC7735307/)

The seven interfaces with paired measurements comprise three rough sites R1–R3 on one specimen, three smooth sites S1–S3 on a second, and S4 on a third. S5 has a tangential estimate from eight of nine steps and lacks a measured normal stiffness. The seven paired interfaces retain 54 of 65 tangential steps. The authors excluded some estimates with substantial uncertainty. Each published mean supplies one target.

The specimen-level comparison gives every group equal weight and every interface within a group equal weight. The constant and the through-origin least-squares multiplier use the other two specimen groups with the same weighting. Every method receives the same normal-phase stiffness. The ratio candidates follow from the paper’s Poisson ratio of 0.31, giving the full multiplier $r=138/169$ and the half multiplier $r/2$. The 2017 Oxford thesis abstract reports approximately half the Mindlin ratio. The 2020 paper reports approximately the full ratio, particularly with the loading reference. The source material available for this comparison does not establish why the publications differ or whether all their data and estimators coincide. [2017 thesis record](https://doi.org/10.5287/ora-qz0qqyrng) · [2020 article](https://doi.org/10.1098/rspa.2020.0329)

## Interface results and reported uncertainty

For two positive predictions $rN$ and $rN/2$ of tangential stiffness $T$, full is closer exactly when $T/N>3r/4=207/338$. The two stiffnesses use identical area units. With the loading reference all seven nominal ratios favor full. S2, S3 and S4 favor half when the unloading reference is used. Four others still favor full.

S3 gives the clearest reversal. The measured normal reference increases from 504.917 to 1140.553 kN/mm³. The reported tangential mean stays at 470.754 kN/mm³. The corresponding published ratios are 0.932 ± 0.213 and 0.413 ± 0.088. Both intervals lie entirely on their respective sides of the preference threshold. The full-ratio signed prediction error changes from −58.455 to +460.585 kN/mm³. S1 gives the largest absolute full-ratio error with the loading reference, an underprediction of 90.191 kN/mm³.

| Error treatment | Loading full / half / unresolved | Unloading full / half / unresolved | Mean reference full / half / unresolved |
| --- | ---: | ---: | ---: |
| Independently vary the two stiffness estimates over their published margins | 5 / 0 / 2 | 2 / 1 / 4 | 2 / 0 / 5 |
| Use Table 5’s reported ratio margin | 5 / 0 / 2 | 1 / 1 / 5 | 2 / 0 / 5 |

The first row encloses $T-3rN/4$ over a rectangular range. For a mean normal reference its margin is the mean of the two normal margins. The second uses the published ratio’s own error propagation. Neither construction adds information about joint sampling probabilities. All 21 computed ratios agree with the published entries within the rounding intervals implied by the printed three-decimal inputs and outputs. The evidence retains every signed error, denominator and comparison.

## What the published means can resolve

The original question concerned predicting the virgin tangential displacement trajectory from the same interface’s earlier normal loading. That question requires the first loading branch, load/frame matching and the physical displacement calibration. If a positive mean $M$ averages $m\ge2$ positive retained stiffness estimates, any proposed first value $x$ strictly between zero and $mM$ is compatible with that mean by assigning each other step $(mM-x)/(m-1)$. Individual-step constraints could tighten this range. The published mean alone cannot reconstruct the first trajectory, and some first-step inclusion identities are unavailable. Friction inferred from a held tangential fit would reveal information from the target.

There is also an exact overlap between the proposed normal-curve prediction and the paper’s empirical comparator. For the virgin branch, its scalar approximation is $u(Q)=(\mu/r)[\delta_n(P)-\delta_n(P-Q/\mu)]$. On the log form $\delta_n(P)=s\log(P)+c$, the derivative gives $K_t=r(P-Q/\mu)/s$. This reproduces the paper’s equation 5.3 at zero starting tangential load when $s$ is its equivalent interface roughness. Empirical evidence for additional predictive content would require measured departures from that form and independent friction information. Plasticity, unequal pad load sharing and direction-dependent roughness remain possible.

The published-table diagnostic was fixed in post 190543 before retrieving the numerical tables. The full-ratio conclusion of the paper, its R2 example and the description of S5 near sliding were already public and known. The diagnostic reanalyzes those reported fits. The 3.95 GB raw release contains images, instrument loads, DIC exports and MATLAB processing. The ordinary file link returned HTTP 403. Two original archive/method intake requests had unresolved admission records. The Oxford repository’s landing page was received, and its linked thesis PDF returned HTTP 403 on a separate native original. The raw displacement-trajectory question remains open. [Dryad dataset and processing description](https://doi.org/10.5061/dryad.x0k6djhg7)

## Replay

Run `python3 research/parel-contact-stiffness-phases/replay.py` from the repository. It recomputes and checks every result in `results.json` using rational arithmetic on the released decimal values. Pass `--article-html PATH` to additionally verify the exact original PMC HTML and re-extract all relevant fields from its three tables. The input snapshot’s SHA-256 is `1e643f27fceace5f8a939e79307420b4b27d059892c4d6e4ab1a4b39e8b30bda`. A later live HTML rendering can contain the same published values with different page bytes.
