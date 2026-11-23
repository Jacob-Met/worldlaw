# Warsaw zero-baseline carrier increments

## Source and rights

Borio, Susi and Węzka archived a split choke-ring antenna connected to two static Septentrio PolaRx5S receivers on 8 March 2024. The publication calls one archive WUT300POL in its prose, while its release table names WUT000POL. Authenticate both actual archive MD5s, the README, header receiver identifiers, Galileo observation and clock conventions, overlap and station identity before interpreting that discrepancy. Keep all first queries to file inventories and RINEX headers. No phase, Doppler, code observations, per-value slip indicators or ephemeris inputs are used in this qualification. Official standard: IGS RINEX 3.04. Author study: DOI 10.3390/engproc2026126051. It constructs a synthetic triple-component pseudorange from E5a/E5b/E6; the same-source result is prior information. The present outcome is an observed E5b carrier-phase *change* in metres.

## Conditional measurement

In a phase-connected same-satellite interval, convert the change in reported carrier cycles to metres by c/f. Each receiver gets its own common nondispersive increment G, which includes its clock. Let the two receive the same slant first-order propagation increment S. A conditional model is E[Y(r,j)] = G(r)+ S/f(j)^2. The two E5b outputs are excluded together from predictors. Both instruments observe the same path and satellite; they are two electronic observations of one source on one day.

For Galileo E1, E5a and E5b use 1575.42, 1176.45 and 1207.14 MHz. Set q=(1/fb²−1/fa²)/(1/f1²−1/fa²)=1381457/12173057, and Dr=Yr,1−Yr,a. Every linear unbiased prediction of the E5b increment for receiver r under the above arbitrary three latent terms has the form

    Yr,a + q Dr + c (Dother − Dr).

The two receiver intercept constraints and the common spectral constraint leave exactly one free coefficient. Under equal independent channel errors the donor-error variance in units of their common variance is (1−q+c)²+(q−c)²+2c², minimized at c=(2q−1)/4. The negative coefficient (approximately −.19326) reflects the noisy E5a value already present in the prediction. Covariance between receiver tracking errors and the target can change the best coefficient. Unknown satellite-common signals, multipath and receiver-specific electronic effects are distinct possible causes. If an unrestricted term proportional to 1/f enters, k(1/f−1/f1)(1/f−1/fa) is invisible to both donors and changes the E5b mean; two receivers alone cannot resolve this extra shared function.

## Prospective source gates

Use a single tracking code per band shared by the two instruments; a pilot-only triple is preferred when the headers admit it. Record observable scale factors, time system, phase shifts, interval, loss-of-lock and half-cycle semantics. No target-based fit or choice among tracking codes. Determine genuine cycle continuity and what target qualification metadata can establish without using held values. Retain all absent output/signal-loss counts and report availability with any error conditional on complete triples. Raw RINEX time differences only support their stated effective sampling convention. Hardware time or tracking-loop correlation needs independent qualification.

A predictive course requires complete registered epochs/whole hours, a frozen cross-receiver assembly, both nearest-band and first-order one-receiver controls, a train-only disturbance coefficient and an equally informed unconstrained empirical comparator. Keep author meta-signal observations and extra frequencies outside a two-donor comparison. A later scored protocol must fix its date/interval split, error units, stored unit rounding and worst-hour criteria before the corresponding outputs are opened. A source or intake refusal supplies no measured accuracy or positioning result.

[Source release](https://doi.org/10.5281/zenodo.15118153) · [Author experiment](https://doi.org/10.3390/engproc2026126051) · [RINEX 3.04](https://files.igs.org/pub/data/format/rinex304.pdf)
