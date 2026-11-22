# Which sticking motions are identifiable from one contact face?

For a rigid body pushed at a known material point under a fixed ellipsoidal support-friction law, its sticking motion can be predicted from contact geometry and pusher material-point velocity. A force sensor can distinguish two support models that make exactly the same motion predictions on that entire face. This gives a force-free comparator for testing whether measured wrench adds predictive information during a physical push.

The within-face predictor fits four observable coefficient ratios. In an exact rational fixture it learned them from 27 source kinematic observations at nine contact locations, and predicted six twists at the two withheld mirror locations without passing any force measurement to the estimator. On the same source design, propagating the published nominal 0.5 mm object-position, 0.5 degree yaw and 0.1 mm pusher-position errors over 100 ms secants caused the preregistered stability bound to refuse. Its minimum design singular value was 0.0249376 m/s and its conservative matrix perturbation bound was 0.137434 m/s. Adding copies of the same rows scales both by the square root of the repetition count. Exact synthetic reconstruction therefore supplies no stability or physical contact result for a held trial.

The two admissible resistance matrices in one_face_observability.py give identical sticking velocities for all 33 combinations of 11 positions and three contact force directions. The corresponding virtual-force directions differ on every case. An off-face example gives different motions under the two matrices. All of its forces are compressive and the maximum absolute tangential-to-normal ratio anywhere in the fixture is 733/1344. This is an existence witness under a stated synthetic friction cone, not a measured friction coefficient of the MCube apparatus.

## Replay and scope

Run the four commands below from this directory. The first three use the Python standard library. The stability stress uses NumPy.

    python3 sticking_operator.py
    python3 one_face_observability.py
    python3 one_face_control.py
    python3 face_stability.py

The full point-contact and generalized resistance assumptions are in sticking-identification.md. The reduced parameterization and constructive predictor are in within-face-prediction.md. The prospective source-stage refusal and uncertainty envelope are in source-stability-gate.md. A failed sufficient bound does not prove that any physically consistent perturbation destroys rank. Errors shared between timestamps, channels and trials may make this envelope conservative. A finite-window secant and a robot-center velocity also require separate curvature, timing, spin and compliance qualifications before they can represent the instantaneous contacting material point.

The separate measured robot/optical calibration and its source identities are in the sibling directory mcube_recorded_clock_calibration. None of the synthetic cases here reads a 2017 pushing trajectory, fits a physical mobility tensor, classifies a real contact as sticking, or establishes that wrench improves on the same-face kinematic predictor.

The organizer links for rect1_json.zip and unreliable_files.txt returned error-page previews. A subsequent native program to verify archive signatures and the exclusion-list source remained queued on its original worker until 21:30 UTC on November 22, 2026. Both original status and poll then reported expiry. The provider returned zero output bytes. The earlier native placement had explicitly refused queue creation. The actual archive and exclusion list were therefore unverified in this course. This is a bounded source-access result, not a claim that the original recordings no longer exist. Physical held positions and all other 2017 push traces stayed unopened.
