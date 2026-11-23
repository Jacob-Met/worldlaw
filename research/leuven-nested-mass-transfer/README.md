# KU Leuven added-mass transfer

The measured question is whether a transfer learned on one six-mass configuration predicts the frequency response after removing specified masses. The healthy plate had 144 hammer positions and seven accelerometers. The fixed held position, node 121, contributed neither a drive nor a response to fitting the six-mass change. The four smaller configurations contributed no calibration data.

Let G be the healthy reciprocal dynamic receptance and U be the six attached point locations. In a fixed frequency bin, the point-update formula factors the response change through the healthy fields B and an internal scattering matrix T. Removing a set of perturbations J, leaving A, gives

    T_new = T_AA - T_AJ inv(T_JJ) T_JA.

This is the inverse of the A principal submatrix of the original internal dynamic stiffness. It requires the removed masses to be independent local perturbations and the retained attachments and healthy plate to stay reproducible. The measured frequencies, glue, suspension, and repeated impact averaging can violate that assumption. The identity cannot predict an unmeasured change from healthy fields alone, because the release contains no direct healthy transfer measurements between the six mass locations.

Measured healthy transfer is H_ij = l_i G_ij r_j. The healthy reciprocal sensor-port graph supplies the relative gain w_i = r_i/l_i. Dividing each drive column by its w_i gives symmetric coordinates up to a common factor. The measured healthy source fields are B = diag(l) G_SU diag(r_U). Fitting the calibrated change gives an internal core diagonally congruent to the physical one, up to a common multiplier. The Schur complement commutes with that diagonal congruence. Restoring the drive-column gain returns predictions to the released units. This calculation does not estimate an absolute hidden receptance in physical units.

Without a cross-configuration restriction, composed two-sided pseudoinverse interpolation and unregularized full-core fitting can agree exactly. The smaller-configuration receiver never refits a core. Its mandatory projection comparator applies that interpolation to the same six-mass change using just each target's known subset columns. Other controls include the unchanged healthy response, a count-scaled six-site response, count-scaled all-144-node composition of the authors' minimum-norm spatial estimator, and three diagonal approximations. The authors' code targets damage localization. Their 144-node least-squares operation is adapted here to the different held-response endpoint.

The five repeated hammer impacts were averaged. All reported configurations share one plate. Each smaller acquisition has 13 distinct measured coordinates touching the held port: six off-diagonal entries on each side and its self response. All 8,192 frequencies count, including those whose source calibration failed. The single elongated 315 g mass covers three different nodes and is outside the subset intervention.

The preregistered calibration cutoffs are numerical screens. Neither their pass nor failure calibrates measurement noise or proves an intrinsic violation of structural reciprocity.
