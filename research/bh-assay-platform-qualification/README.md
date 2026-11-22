# Can the two Neves assay workflows be calibrated from their published comparison?

The published figure pairs the same 384 nominal reaction conditions across two workflows. It supports a test of agreement in the authors' displayed colors. A solvent-conditioned color predictor missed the registered improvement gate in both directions. Directly copying the source color predicted 70/384 target colors correctly. The solvent-conditioned model scored 67/384 and 66/384. The evidence reviewed here does not establish a numerical assay-yield calibration.

## What was paired

Neves and colleagues describe six substrate pairs crossed with eight catalysts, two bases and four solvents per pair. Each workflow ran a separate reaction on each nominal condition. Duplicate analytical injections concern measurement precision. They supply no additional independent reactions. The paper reports no exclusions, randomization or blinding. All 384 displayed cell positions are present in both panels. Separate injection values, missing-injection flags, plate/run identifiers and processing order were unavailable in the inspected figures and tabular schemas.

Both workflows used nominally 100 °C for 16 hours. The article also describes a change from stirred glass vials to a shaken polypropylene plate, a change in nominal scale, a drying step in the smaller workflow and different dilution and sample preparation. The ratios printed in the methods imply a fivefold scale contrast in the nominal substrate quantity. Some printed absolute volumes exceed vessel capacity, so they cannot serve as authenticated dose measurements. The analytical endpoint is a calibrated UPLC-MS/charged-aerosol detector assay yield, based on a quadratic standard curve. No independent variation of time, temperature, material, scale or agitation occurred within the paired workflow contrast. After centering, the columns for quantities constant within each workflow span at most one dimension. Even access to both exact yield vectors could not separate their component effects without additional assumptions.

## Displayed endpoint and comparison

Supplementary Figure 1 contains a substrate map and a pair of aligned 16 × 24 heatmaps. The 768 cell interiors are uniform RGB fills. Neither embedded raster supplies a quantitative legend or an explicit top/bottom workflow label. The six individual block identities and experimental treatments can be aligned by layout. We use anonymous top and bottom directions and exact 24-bit color equality. The five repository CSV headers do not authenticate a 96/384 workflow pair. The two different Figure 5 workbooks report a single yield on 44 and 300 rows. The released 1.41 GB curated-data pickle was inventoried without deserializing it. The authors describe additional dataset columns in that file. We have not established that no other source contains recoverable paired numbers.

The registered protocol held out one complete 64-cell substrate block and trained on the 320 other condition pairs. The candidate uses the empirical target color conditional on source color and solvent, shrunk toward the source-only conditional distribution. Different handling of the reaction solvents motivated this comparison. All methods used the same five source blocks and the same available held-condition inputs. The two directions reuse the same pairs. The registration predates individual color decoding (task post 178481).

| Fixed prediction rule | Top → bottom correct / 384 | Bottom → top correct / 384 |
| --- | ---: | ---: |
| Copy source color | 70 | 70 |
| Source-color empirical mapping | 67 | 66 |
| Treatment-specific target mode | 49 | 51 |
| Pooled source/solvent categorical model | 60 | 60 |
| Solvent-conditioned candidate | 67 | 66 |
| Nearest source color, then nearest treatment | 60 | 63 |

Candidate correct by row-major substrate block was 1, 17, 26, 16, 1, 6 forward and 1, 17, 26, 15, 1, 6 reverse. The primary gate required strict improvement over every comparator in both directions and at least four of six strict block wins against the best comparator in each direction. Both conditions failed. In block 0, first catalyst/base/solvent, the source color was (169,211,128), the target was (161,208,127) and the solvent-conditioned prediction was (183,215,128). Every rule missed this cell. Block 4 also yielded one candidate hit in 64.

The preregistered alignment check compared true cell correspondence with every nonzero cyclic shift separately along each treatment axis. The correct alignment matched 70 colors. The best shifted counts were 30 for catalyst, 4 for base and 38 for solvent. True alignment beat those three shifts on 5/6, 6/6 and 6/6 blocks, respectively. This is a finite comparison against eleven specific rearrangements. The two panels contain 176 and 187 distinct RGB triplets. One triplet, (248,105,107), occurred 58 times in each and accounts for 58 of the 70 true matches. Removing its contribution after scoring leaves 12 matches, compared with at most 3, 0 and 3 for the same three shift families. Its physical yield and whether it denotes zero are unknown.

## What the reported 384-count histogram identifies

Under the interpretation that the published 5, 10 and 13.2 boundaries refer to absolute differences in assay-yield percentage points, the three counts (228, 105, 51) place identity-copy MAE inside 2.6953125–7.45625 points and RMSE inside 4.485218–8.082621 points (rounded outward; exact expressions in code). These are outer bounds with endpoint conventions retained, not observed scores. Both opposite signs of every change and 0/384 or 384/384 disagreements at the paper's 10% classification threshold are compatible with the histogram alone, even holding a constructed source vector and absolute differences fixed. The witness panels are mathematical examples. The published condition-specific colors carry additional information, and the counterexamples do not claim to reconstruct those colors.

## Reproduce

Use Python 3, NumPy, Pillow and Poppler. Retrieve the linked public supplementary PDF, verify SHA-256 `3a212bd126ebef0cd9bf4ae0102eb605eb95e09ff4c5cc83c3923b37e38e54d4`, and extract PDF page 3's two original images. The replay refuses changes to the expected second PNG bytes and checks the complete 9-by-24-pixel central patch in every cell. The preserved result contains every observed source/target RGB, all six exact predicted colors per cell/direction, every registered shift and every held-block score. Two environments executed the same frozen scorer and reproduced the complete output bytes. Both executions share the scoring implementation.

```sh
pdfimages -f 3 -l 3 -png supplement-original.pdf fig
python3 paired_figure.py fig-001.png figure-verification-replay.json
cmp figure-verification.json figure-verification-replay.json
python3 export_predictions.py fig-001.png figure-verification-replay.json predictions-replay.json
cmp predictions.json predictions-replay.json
python3 verify_bounds.py
```

Neves et al., *Robust out-of-distribution prediction of Buchwald–Hartwig reactions*, Nature Computational Science (2026), DOI 10.1038/s43588-026-01017-6. Figure-derived RGB observations are attributed to those authors under CC BY 4.0. This repository supplies a new cell-level digital transcription, predictions and analysis. Source metadata, format identities and original command outcomes are recorded in `source-contract.json`. [Paper](https://doi.org/10.1038/s43588-026-01017-6) · [Public supplementary PDF](https://pmc-oa-opendata.s3.amazonaws.com/PMC13593570.1/43588_2026_1017_MOESM1_ESM.pdf) · [Author code](https://github.com/schwallergroup/bh-hte-ood/tree/3a44e398d9fed3f08cf396f1153be2960193f581) · [Data record](https://doi.org/10.5281/zenodo.19636649) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
