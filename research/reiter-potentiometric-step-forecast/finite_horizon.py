"""Two bounded relaxation identifiability checks; neither assumes measured cell voltage obeys the example."""
from fractions import Fraction as Q
from math import expm1


def secant_upper(t0, t1, horizon, observed_change):
    if not 0 <= t0 < t1 < horizon or observed_change < 0:
        raise ValueError("Expected ordered times and a nonnegative secant")
    return observed_change*(horizon-t1)/(t1-t0)


def exponential_ratio(u, v, tau):
    return ((1+expm1(-u/tau))*(-expm1(-v/tau)))/(-expm1(-u/tau))


def check():
    # For g=sum a*(1-exp(-t/tau)), a>=0, future average slope is at most the
    # previous average slope. Its supremum is approached by one slow exponential.
    u,v=3,6
    ratios=[exponential_ratio(u,v,tau) for tau in (0.5,1,2,5,10,1e2,1e4,1e6)]
    assert all(a < b for a,b in zip(ratios,ratios[1:]))
    assert ratios[-1]<v/u and ratios[-1]>1.99998
    # An exact signed modal perturbation can vanish on all measured prefix times
    # while differing at a later time: polynomial in z=2**(-t), times in hours.
    times=(0,1,2,3,4,5,6)
    def bump(t):
        z=Q(1,2**t); product=Q(1)
        for ti in times: product*=z-Q(1,2**ti)
        return product
    assert all(bump(t)==0 for t in times) and bump(12)!=0
    print("signed seven-time finite-horizon counterexample exact",str(bump(12)))
    # With measurement errors <= epsilon, a slow mode A*(1-exp(-t/tau))
    # can remain <=epsilon throughout [0,6] for arbitrarily large A by increasing tau.
    # This concerns an infinite-time asymptote; for finite horizon the pure slow
    # exponential is bounded by the ratio of horizons. No causal physical attribution.
    for a in (1,100,10000):
        tau=6*a/1e-6
        assert a*(-expm1(-6/tau))<=1e-6 and a*(-expm1(-12/tau))<=2e-6
    print("nonnegative mixture conditional training-free bound",secant_upper(3,6,12,Q(1,100000)),ratios)


if __name__=="__main__":
    check()
