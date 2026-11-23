"""Independent exact finite-chain and reversible-Gaussian observation controls."""
from fractions import Fraction as F
from itertools import product
def mean(v):
    return sum(v,F())/len(v)
def paths(n):
    for s in product((-1,1),repeat=n):
        p=F(1,2)
        for a,b in zip(s,s[1:]):p*=F(3 if a==b else 1,4)
        yield s,p
def taps(s,a,b):
    return [F(a*y+b*x,a+b) for x,y in zip(s,s[1:])]
def antisym(z,lag):
    return mean([x**3*y-x*y**3 for x,y in zip(z,z[lag:])])
def phase():
    kernels=[(3,1),(1,3)]
    sq=lambda a,b:[F(a*a+b*b,(a+b)**2),F(2*a*b,(a+b)**2)]
    assert sq(*kernels[0])==sq(*kernels[1])==[F(5,8),F(3,8)]
    res=[sum(p*antisym(taps(s,a,b),1) for s,p in paths(3)) for a,b in kernels]
    assert res==[F(-9,64),F(9,64)]
    return list(map(str,res))
def gaussian(n=7):
    cov=[[F(2,3)**abs(i-j) for j in range(n)] for i in range(n)]
    means=[mean(r) for r in cov]
    c=[[v-means[i]-means[j]+mean(means) for j,v in enumerate(r)] for i,r in enumerate(cov)]
    out=[[F(),F()] for lag in range(1,n)]
    for seq,p in paths(n+1):
        u=taps(seq,3,1);m=mean(u);u=[x-m for x in u];d=F(5,2);z=[d*x for x in u]
        for lag in range(1,n):
            terms=[]
            for i in range(n-lag):
                j=i+lag;x,y=z[i],z[j];h=c[i][j];v=c[i][i]-c[j][j]
                terms.append(x**3*y-x*y**3+3*h*(x*x-y*y)+3*v*x*y+3*h*v)
            out[lag-1][0]+=p*mean(terms)
            out[lag-1][1]+=p*d**4*antisym(u,lag)
    assert all(a==b for a,b in out) and any(a for a,b in out)
    return [str(a) for a,b in out]
def generator():
    a,d,l=F(2),F(1),F(1)
    m11=a*d/(a+2*l);m20=d*m11;m31=3*a*d*m20/(3*a+2*l);m40=d*m31
    L=[[-a,0,0,2*a*d],[a*d,-2*l,0,0],[0,0,-3*a,0],[0,0,3*a*d,-2*a-2*l]]
    dot=lambda u,v:sum(i*j for i,j in zip(u,v))
    p=[1,0,0,0];q=[0,0,1,0];out=[]
    for _ in range(5):
        out.append(dot([m40,m31,0,0],p)-dot([m20,m11,m40,m31],q))
        p,q=[dot(r,p) for r in L],[dot(r,q) for r in L]
    assert out==[0,0,0,-12,192]
    return list(map(str,out))
if __name__=='__main__':
    print('Phase-reversed FIRs',phase())
    print('Six-lag finite-mean Gaussian identities',gaussian())
    print('Ideal telegraph derivatives at zero',generator())
