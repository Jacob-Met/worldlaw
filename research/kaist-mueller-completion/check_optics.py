"""Check the two physical completion formulas on generated matrices with known VV."""
import numpy as np
from completion import cpspan, mueller, pure_cofactor


def random_jones(rng):
    return rng.normal(size=(2,2)) + 1j*rng.normal(size=(2,2))


def main():
    rng=np.random.default_rng(174)
    worst=0.
    for _ in range(160):
        j=random_jones(rng)
        m=mueller(j)
        m/=m[0,0]
        target=m[3,3]
        span=cpspan(m[:3,:3])
        val,status,_,_=pure_cofactor(m[:3,:3])
        assert status=="pure_accepted" and span is not None
        assert span[0]-1e-7<=target<=span[1]+1e-7
        worst=max(worst,abs(target-val))
        mixture=m+mueller(random_jones(rng))
        mixture/=mixture[0,0]
        lo,hi=cpspan(mixture[:3,:3])
        assert lo-1e-7<=mixture[3,3]<=hi+1e-7
    assert worst<1e-8
    right=np.array([1,1j])/np.sqrt(2)
    left=right.conj()
    endpoints=[]
    for s in (right,left):
        m=mueller(np.outer(right,s.conj()))
        m/=m[0,0]
        assert np.allclose(m[:3,:3],np.diag([1.,0.,0.]))
        assert pure_cofactor(m[:3,:3])[0] is None
        assert np.allclose(cpspan(m[:3,:3]),[-1,1])
        endpoints.append(m[3,3])
    assert np.allclose(endpoints,[1,-1])
    print("160 nonsingular Jones controls, 160 mixtures and both singular sign cases passed")


if __name__=="__main__":
    main()
