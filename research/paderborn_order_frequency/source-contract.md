# Paderborn KAt bearing source qualification

The proposed evaluation concerns the change in vibration at two steady shaft speeds. The fixed-load pair is N15_M07_F10 and N09_M07_F10. Both use nominal 0.7 Nm torque and 1,000 N radial force. Set 2 changes torque and set 3 changes radial load at 1,500 rpm. Neither supplies another matched-speed test. The organizer reports approximately 45–50 °C, without specifying identical temperatures by bearing and session. The original paper identifies 20 four-second recordings per condition, with speed, radial force and torque measured and vibration sampled at 64 kHz.

Lessmeier et al. describe six distinct healthy bearings with different run-in histories, 12 artificial defects and 14 accelerated-life bearings. Each bearing, rather than a window or four-second segment, is the independent unit for a transfer claim. The six healthy references are separate specimens and cannot reveal a particular damaged bearing's pre-damage vibration. A contrast to their mean has a corresponding descriptive interpretation.

The established order–frequency comparison retains physical frequency on the carrier axis and uses shaft order for the modulation axis. Abboud et al. already describe that separation. Antoni et al. published a Fast-SC estimator, a computational alternative to the averaged cyclic periodogram. A candidate damage-excess forecast would add a training-derived low-speed healthy reference to the difference between the high-speed damaged and healthy surfaces in common order–frequency coordinates. Comparators must have access to the same healthy reference recordings and other-bearing training pairs. The held low-speed vibration and all modulation or resonance statistics derived from it stay sealed until predictions are locked. Any whole-surface comparison must specify a fixed common support, resolution, scaling, noise-floor treatment and equal bearing weights before scientific array access.

The organizer's release pages list 32 bearings and a CC BY-NC 4.0 license. Native acquisition of the public catalog, paper and corrected instrument page succeeded. The official archive index and HEAD requests to K001, KA08, KB23 and KI04 returned HTTP 503. The cached official directory lists KA08, also identified in Table 4 as an outer-ring drilling defect. The independent Zenodo deposit lists 31 archives, omits KA08, names a depositor from a different university, and labels itself CC BY 4.0. We have no official file checksum matching the mirror and no evidence of license relicensing by the rights holder.

The author's publication identifies MATLAB Central submission 60561 as its Octave/MATLAB implementation. The public submission page lists Fast_SC.m and the synthetic demonstration. Native access to the submission landing page returned HTTP 403, while its public viewer shell returned HTTP 200. These receipts verify the release identity and viewer availability, not original source bytes or a numerical execution. The native worker has libarchive and does not have MATLAB or Octave on PATH.

No waveform, speed trace or classified held response has been opened. Gate and candidate fitting remain pending source qualification.

## Primary sources

- [KAt organizer catalog and dataset license](https://mb.uni-paderborn.de/en/kat/research/bearing-datacenter)
- [Operating conditions](https://mb.uni-paderborn.de/en/kat/research/bearing-datacenter/operating-conditions)
- [Instrument and data acquisition](https://mb.uni-paderborn.de/en/kat/research/bearing-datacenter/test-rig-and-measurement-equipment)
- [Lessmeier, Kimotho, Zimmer and Sextro, 2016, Tables 4–7](https://mb.uni-paderborn.de/fileadmin-mb/kat/PDF/Veroeffentlichungen/20160703_PHME16_CM_bearing.pdf)
- [Third-party mirror inventory](https://doi.org/10.5281/zenodo.15845309)
- [Abboud et al., angle/time cyclostationarity](https://www.sciencedirect.com/science/article/pii/S0263224115003528)
- [Antoni et al., Fast-SC](https://doi.org/10.1016/j.ymssp.2017.01.011)
- [Antoni's released implementation](https://www.mathworks.com/matlabcentral/fileexchange/60561-fast_sc-x-nw-alpha_max-fs-opt)

## Subsequent source checks

The official MathWorks viewer rendered all 47 source blocks of Fast_SC.m. The 12,721 non-whitespace characters match the independent pinned executable copy exactly (SHA-256 de7a5aa882d12811db5aab8dd7c96ee5f09352d465441ef44c877a44a91c76e2). This is a rendered-text comparison, not an original byte digest. The executable's complete bytes have SHA-256 3f5e4bc502ec3c8d909dc2bfce767480cafdb66b08113eeb122593ba4a2b4263. The first-party file lists its author as Jérôme Antoni and links a two-clause BSD license. All 31 mirror archive lengths match the separate 32-archive data-loader registry at commit 1ca6bf36937555e4b4e91619a21a4eefd5d0ad0c.

The registry derived from the fact sheets lists all six healthy bearings as IBU. Of the 14 accelerated-life bearings, six are FAG, seven are MTK and one is IBU. Adding the registered difference between healthy surfaces is algebraically a common surface correction. We will treat it as a control.

For unnormalized cyclic-spectrum magnitudes a linear filtering model has two gain factors, one at each sideband. A synthetic two-tone source test at 320 and 512 Hz and modulation 192 Hz placed the largest output at the 320 Hz row, not their 416 Hz midpoint. Its amplitude ratio was 0.372693825, versus the exact sideband product 0.372694611 and the squared midpoint gain 0.378330209. This result comes from the Python translation, pending separate native GNU Octave qualification. In a physical prediction, healthy ordinary spectral changes contain contributions from forcing and transfer paths. They do not identify mechanical gains without additional assumptions.
