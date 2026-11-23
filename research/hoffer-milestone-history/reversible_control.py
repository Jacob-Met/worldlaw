"""Exact equilibrium counterexample to inferring one-coordinate Markov dynamics from path reversal."""
from fractions import Fraction as Q
from itertools import product

def conditional_rates(k,s):
    # Symmetric 0..4 random walk conditioned to reach 4 before 0 has h(k)=k/4.
    return {k+1:s*Q(k+1,k),k-1:s*Q(k-1,k)}

def certify():
    sites=range(5)
    speeds=(Q(1),Q(2))
    # For each lane, pi(k,s) proportional to 1/s. Switch lanes only at 0 and 4.
    pi={(k,s):Q(1)/(s*Q(15,2)) for k,s in product(sites,speeds)}
    assert sum(pi.values())==1
    Qmat={}
    for k,s in pi:
        Qmat[k,s]={(l,s):s for l in (k-1,k+1) if l in sites}
        if k in (0,4):
            other=2 if s==1 else 1
            Qmat[k,s][k,other]=s
    for i,row in Qmat.items():
        for j,val in row.items():
            assert pi[i]*val==pi[j]*Qmat[j][i]
    flux=[pi[0,s]*s*Q(1,4) for s in speeds]
    weights=[f/sum(flux) for f in flux]
    assert weights==[Q(1,2)]*2
    def passage(k,m,s):
        return Q(m*m-k*k,6)/s
    for m in (2,4):
        for k in range(1,m):
            for s in speeds:
                f=passage(k,m,s)
                assert sum(v*(passage(l,m,s)-f) for l,v in conditional_rates(k,s).items())==-1
    prefix=[passage(1,2,s) for s in speeds]
    suffix=[passage(2,4,s) for s in speeds]
    expectation=lambda vals:sum(w*v for w,v in zip(weights,vals))
    # Given the lane, the strong Markov property makes the two durations independent.
    cov=expectation([a*b for a,b in zip(prefix,suffix)])-expectation(prefix)*expectation(suffix)
    assert cov==Q(1,16)
    return {"stationary_law":{str(k):str(v) for k,v in pi.items()},"reactive_lane_weights":list(map(str,weights)),
            "prefix_means":list(map(str,prefix)),"suffix_means":list(map(str,suffix)),"covariance":str(cov),
            "scope":"Synthetic irreducible reversible five-coordinate/two-lane chain; event times in normalized units."}
if __name__=="__main__":
    print(certify())
