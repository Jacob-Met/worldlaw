# Direct within-face kinematic predictor

The experimental file need not identify all six symmetric resistance entries for the complete-sticking model to have a unique same-face prediction. For face x=−ell, t=r_y/ell and q=(t,1,1), define a=A(1,0,0) and b=A(0,1,1). Symmetry gives b_x=a_y+a_z. Only the five coefficients (a_x,a_y,a_z,b_y,b_z) enter the pose-only observation equation

    (t z_x, t z_y+z_x, t z_omega+z_x, z_y, z_omega) dot coefficients = 0.

A common positive multiplier is unobservable. Four independent constraints and a one-dimensional residual nullspace determine the coefficients up to that scale. Training with only one starting position need not reach that rank. For exact data, the symmetric Gram matrix with entries a_x, a_y+a_z, b_y+b_z must be positive definite. Under that condition the unobserved orthogonal diagonal of a full resistance can be made sufficiently large to ensure a positive-definite completion by its Schur complement. No choice of that diagonal enters the same-face forecast.

Let u be the pusher contact material-point velocity in the body frame. A particular sticking solution for z is (u_x,u_y,0). All compatible velocities have the form (u_x,u_y,0)+s q. The scalar is

    s = − [(t a_x+a_y+a_z)u_x + (t a_y+b_y)u_y]
          / [a_x t² + 2(a_y+a_z)t + b_y+b_z].

Physical omega equals s/ell. The denominator is positive under the Gram condition. One can normalize a_x to one and write it as (t+p)²+sigma², with p=a_y+a_z and sigma²=b_y+b_z−p²>0. This parameterization can impose positivity without inventing an unobservable mobility component.

one_face_control.py learns these combinations from 27 entirely synthetic pose/point observations spanning nine training contact coordinates. The fit receives no sensor wrench or held object velocity. At mirror-reserved coordinates s_position=0.2,0.8, it reconstructs all six synthetic twists exactly from the three applied contact velocities at each site, under the stated model. This is an exact-geometry control and a source-only demonstration. On experimental data any treatment of measurement noise, rank, regularization and material-point velocity must be fixed from source recordings before accessing held outcomes. The algebra does not imply a measured contact is rigid, sticking or on the intended face.
