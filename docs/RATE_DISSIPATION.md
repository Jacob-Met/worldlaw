# Continuous speed-domain investigation of the supplied rate law

Native outcome #212, successor to merged energy accounting #208 / PR211. Candidate rebased on main5c7362d96bfd75edc7b1a931cae3fc5cc279bdfe; successor is not yet merged. The user supplies a maximum absolute speed in the existing dynamics energy instrument and asks whether the fixed learned rate law can supply energy anywhere in that interval. No fitting, selection, acquisition or stored observation changes.

For r=|ω|, the maintained library's rate power is r(f+d r+q r²). The sign on0<r≤V is therefore the sign of the quadratic factor. Its maximum is attained at an endpoint, or at the interior vertex only when q<0. Existing bounded exact rational arithmetic from `unknown-lab/chronos-exact-halfplanes.mjs` evaluates those candidates over the actual binary64 coefficients supplied by the model. This reuses maintained arithmetic rather than adding a numerical solver.

When the positive maximum is at r=0, zero power at that endpoint is not misreported as a positive-power witness. With S=|d|+|q|V, choose r=min(V,f/(2S)) (or V if S=0). Then r>0 and f+d r+q r²≥f/2>0. The returned witness includes exact rational speed/power and enclosing binary64 display values. If V=0, the domain contains only zero power regardless of the factor. Arithmetic capacity/refusal remains atomic.

The result is a real-arithmetic mathematical property of the polynomial defined by the supplied binary64 coefficients. It does not certify the separately rounded operations of the numerical solver. It is not a coefficient-confidence region, physical passivity certificate, conservative stability statement, actuator accounting or proof of the omitted physics. Rational witnesses can lie between representable binary64 speeds. Exact positive power can have a display enclosure beginning at zero after binary64 underflow; the rational numerator remains decisive.

The opt-in query sits beside sampled energy accounting. Its initial maximum is the largest sampled speed of the current executed prediction; users can declare another maximum. A query is temporary and explicitly resets after reopening, while the existing notebook replays its original source/model. A new query does not silently become a saved experimental declaration. Model/rerun changes discard stale results.

## Executed controls

Eight direct native tests pass: interior active pocket with negative endpoints and independent rational substitution of its witness; strictly positive witness when factor maximum is at zero; tangent-zero, zero law and zero-only domain; domain expansion without model mutation; subnormal positive coefficients; positive exact power below binary64 range; conservative/command independence; malformed and oversized input refusal.

Actual isolated Studio Chrome receiving passes default nonpositive interval; imported authored observations for τ=−θ−sign(ω)+8ω−8ω|ω|; detected positive power at speed0.5 despite negative endpoint factors; exact witness disclosure;390px no overflow; stale witness clearing on invalid query; and explicit reload reset. These are authored synthetic controls, not physical evidence or new unseen measurements. The exact input model inferred by the maintained fitter has binary64 coefficient rounding; the witness applies to those supplied coefficients, not an idealized rounded display equation.

Independent review by direct mechanism worker found no blocker and independently executed all8native tests. Reviewed endpoint/vertex completeness, zero-domain semantics, positive-speed witness bound, underflow custody and input admission; no independent UI acceptance was claimed.
