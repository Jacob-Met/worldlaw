# A signed slowing limit for spheres approaching a plane

The leading normal-wall correction to added mass can slow a sinking sphere by at most 0.006250% relative to the same-drag control at a center height of ten radii. At two radii the ceiling is 0.772213%. **The available source does not establish the calibrated differential precision needed for the proposed long-range physical comparison.** All 30 publisher-listed trajectories remain unopened. No measured velocity, position, residual, or contact event was scored.

## Experiment and observable

Hagemeier et al. imaged spheres released by vacuum tweezers in a 110 mm cylindrical container of water and glycerol. Density 1,141 kg/m³ and dynamic viscosity 0.008 Pa·s were measured in-house. No per-run temperature or corresponding viscosity uncertainty was established. Coordinate zero is the top center of the steel bottom slab. With the measured center height h=y and sphere radius R, the surface clearance is h−R. The actual steel diameters are 16.7 and 14.4 mm. The capacity calculation uses the published densities with particle mass defined by density times spherical volume.

The authors list three separate repetitions each for Steel_16, Steel_14, POM_20 and PTFE_06, ten for PTFE_10, six for PTFE_20, and two for Rubber_22. Each case is described as separate center-coordinate, component velocity and summary-figure files. Our native directory request failed DNS before receiving metadata. The run counts come from the authors' public catalog. No inner archive roster or physical signal was authenticated here.

The camera acquires at 1,000 frames/s and 8.89 pixels/mm with a 10 µs exposure. Tracking fits a quadratic to each correlation peak for subpixel centroids. The release velocities are derived from adjacent tracked positions and median-filtered. They share the centroid errors. No calibrated uncertainty at the proposed differential scale or median-filter width was established. A nominal pixel and frame interval alone cannot give a noise floor, and repeated releases can share systematic image errors. The paper also describes a retrospective release-time correction. The comparison below uses matched height.

The archival aggregate exposure includes the published PTFE 20/10/6 fit factors, the reported PTFE10 and POM peak speeds, steel impact summaries, Table 1 nominal velocities and impact Stokes numbers, and the authors' statements about early slowing, rubber uptake and rotation. Only their a priori terminal speeds are used for illustrative conversions. No fitted factor, trajectory or contact statistic enters the calculations. [Dataset](https://doi.org/10.17632/mf27c92nc3.1) · [Published article](https://doi.org/10.1016/j.ijmultiphaseflow.2021.103589) · [Methods and equations](https://arxiv.org/abs/2009.02250)

## Why the bound survives drag feedback

Let s be downward travel, v=ds/dt≥0, and F_g buoyancy-corrected weight. The two arms start at the same height and speed and share drag D(h,v) nondecreasing in v. The author's Eqs. 4, 6 and 21 use constant added mass, Brown–Lawler drag, the larger bottom/free-surface factor and a positive fitted multiplier. The product v²C_D increases even where C_D alone decreases. The paper excludes history forces and lift. Its per-condition fitted multipliers used that condition's measured response and would be unavailable for a fresh held-condition forecast.

For displaced fluid mass m_f, let M₀=mₚ+m_f/2 and M(h)=M₀+(3/16)m_f(R/h)³. The latter is the leading normal-wall image approximation. The kinetic energy E=Mv²/2 obeys dE/ds=F_g−D(h,√(2E/M)). This is equivalent to M dv/dt + (dM/ds)v²/2 = F_g−D. The image arm starts with at least as much energy as the fixed-mass arm. At equal energy its speed is no larger and hence its drag is no larger. Scalar comparison gives E_image≥E_control throughout the common monotone traversal. Consequently

```text
v_image/v_control ≥ 1/sqrt(1 + α(R/h)³)
α = (3/16) m_f/M₀ ≤ 1/8 for sinking spheres mₚ≥m_f.
```

This bounds slowing in one direction. A synthetic counterexample included below has a positive candidate-minus-control speed gradient from equal initial speeds under a strong monotone drag. The finite-expression theorem does not bound omitted hydrodynamic terms, viscosity changes, wake memory or contact physics. Higher-order terms can matter particularly at two radii. One monotone speed-height path also cannot uniquely distinguish a changing inertia from a state-dependent drag. [Potential-flow added-mass tabulation](https://brennen.caltech.edu/fluidbook/basicfluiddynamics/unsteadyflows/addedmass/valuesoftheaddedmass.pdf)

| Center height | Universal maximum slowing | Seven-material equivalent at nominal speeds, 1 ms |
|---|---:|---:|
| 2 radii | 0.772213% | 0.01665–0.03100 pixels |
| 5 radii | 0.049963% | 0.001073–0.001998 pixels |
| 10 radii | 0.006250% | 0.000134–0.000250 pixels |

The last column expresses a matched-height speed decrement in equivalent camera units. It is neither an observed one-frame displacement nor an instrument noise estimate. If a control speed lower bound v_min holds over x=h/R∈[a,b], integrate the reciprocal-speed inequality using √(1+α/x³)−1≤α/(2x³). The added transit time is at most Rα(a⁻²−b⁻²)/(4v_min). From ten to two radii, assuming the floor is half each material's published *nominal* terminal speed gives 0.01468–0.41773 ms. None of those speed floors is a measurement.

## Numerical qualification

Independent speed-domain Runge–Kutta integration uses the changing-mass gradient and an explicit clock. It checks all seven material inputs under three synthetic entry speeds and three synthetic positive drag multipliers. Both models use the same illustrative liquid depth of 24 radii. All 63 tests satisfy the signed inequality on 512-step grids. Refining from 256 to 512 steps changes both final speeds and the transit-time difference by at most 4.1×10⁻¹¹ in their respective SI units. Synthetic extra times span 0.00448–0.21364 ms. These checks establish numerical consistency, with no inference about actual experimental error. A more precise independently calibrated experiment could change the physical eligibility decision.

Run `python3 replay.py .` in this directory to authenticate the original outputs, recount the 42 capacities at 75-digit precision and inspect the 63 numerical checks. The source arithmetic and independent speed solver exited zero with drained descendants. The DNS refusal remains a separate original. No enlargement of the physical coefficient or fit to recordings was attempted.
