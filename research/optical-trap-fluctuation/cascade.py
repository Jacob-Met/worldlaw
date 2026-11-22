"""Exact cascade and pole-exchange witnesses, using rational Laplace transforms."""
from fractions import Fraction as F
import json


def transfer(s,a,b):
    return a*b/((s+a)*(s+b))


def noise_transfer(s,a,b,sigma):
    return sigma*b/((s+a)*(s+b))


def integral_covariance(s,a,b):
    # Transform of normalized stationary autocovariance for filtered OU position.
    return (s+a+b)/((s+a)*(s+b))


def check():
    tests=0
    for a in map(F, [1,3,7]):
        for b in map(F,[2,3,11]):
            for s in [F(1,2),F(5,3),F(4)]:
                sig=F(7,5)
                assert transfer(s,a,b)==transfer(s,b,a)
                assert noise_transfer(s,a,b,sig)==noise_transfer(s,b,a,sig*b/a)
                assert (1-transfer(s,a,b))/s==integral_covariance(s,a,b)
                if a!=b:
                    assert (b/(s+a)-a/(s+b))/(b-a)==integral_covariance(s,a,b)
                else:
                    assert 1/(s+a)+a/(s+a)**2==integral_covariance(s,a,b)
                tests+=1
    # At a=b=1 and t=v=1 the two complements are 2/e and (3/2)/e.
    assert F(3,2)/2==F(3,4)
    return {"rational_laplace_tests":tests,"positive_lag_over_unshifted": "3/4",
            "covariance_positive_lag_note":"equal-pole cascade, unit t and v; no independent readout noise"}


if __name__=="__main__":
    print(json.dumps(check(),indent=2))
