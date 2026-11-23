"""Independent rational Racah-weight checks of the projected two-spin Hamiltonian."""
from fractions import Fraction as Q
from math import factorial, isclose
from recoupling import angular_square, projection, recouple, triangle

def tri2(a,b,c):
    if not triangle(a,b,c):return Q(0)
    return Q(factorial((a+b-c)//2)*factorial((a+c-b)//2)*factorial((b+c-a)//2),factorial((a+b+c)//2+1))

def six_squared(a,b,c,d,e,f):
    norms=tri2(a,b,c)*tri2(a,e,f)*tri2(d,b,f)*tri2(d,e,c)
    if not norms:return Q(0)
    lower=[(a+b+c)//2,(a+e+f)//2,(d+b+f)//2,(d+e+c)//2]
    upper=[(a+b+d+e)//2,(a+c+d+f)//2,(b+c+e+f)//2]
    total=Q(0)
    for n in range(max(lower),min(upper)+1):
        t=Q((-1)**n*factorial(n+1))
        for k in lower:t/=factorial(n-k)
        for k in upper:t/=factorial(k-n)
        total+=t
    return norms*total**2

def main():
    nblocks=0;nweights=0;worst=0
    for j in range(12):
        for f in range(j+3):
            if not any(triangle(p,1,2*f) for p in range(abs(2*j-3),2*j+4,2)):continue
            ps,ds,h2=projection(j,f)
            ks=[k for k in range(abs(2*j-1),2*j+2,2) if triangle(k,3,2*f)]
            lam=[(angular_square(k)-angular_square(2*j)-angular_square(1))/2 for k in ks]
            for p,expected in zip(ps,ds):
                probs=[(p+1)*(k+1)*six_squared(3,2*j,p,1,2*f,k) for k in ks]
                assert sum(probs)==1 and sum(q*l for q,l in zip(probs,lam))==expected
                assert sum(q*(l-expected)**2 for q,l in zip(probs,lam))==h2
                nweights+=len(probs)
            if len(ps)==2:
                for si in (-3.1,-.02,0,.17,2.1):
                    for reverse in (-1,1):
                        s={p:reverse*(i*2.3-.2) for i,p in enumerate(ps)}
                        values=list(recouple(j,f,s,si,'coupled').values())
                        anchor=[s[p]+si*float(d) for p,d in zip(ps,ds)]
                        check=anchor[0]*anchor[1]-si**2*float(h2)
                        err=abs(values[0]*values[1]-check)
                        worst=max(worst,err)
                        assert isclose(values[0]*values[1],check,rel_tol=1e-12,abs_tol=1e-12)
                        assert isclose(sum(values),sum(anchor),abs_tol=1e-12)
            nblocks+=1
    # J² I(Si)·I(S) leaves all single-spin spectra invariant. For 0→1 the
    # two double-spin subensembles have weights 3/8 and 5/8.
    pair=[(angular_square(t)-angular_square(1)-angular_square(3))/2 for t in (2,4)]
    assert pair==[Q(-5,4),Q(3,4)]
    shifts=[2*x for x in pair]
    assert shifts[1]-shifts[0]==4 and Q(3,8)*shifts[0]+Q(5,8)*shifts[1]==0
    print("RACAH",nblocks,nweights,"WORST",worst,"NULL",shifts)
if __name__=="__main__":main()
