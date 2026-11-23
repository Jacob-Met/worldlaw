"""Exact Gaussian-rational cross-check for arbitrary nonreciprocal port matrices."""
from itertools import product
from sympy import I, Matrix, Rational as Q, cancel


def norm(m):
    return m.applyfunc(cancel)


def chain(s):
    return norm(Matrix([[-s.det(),s[0,0]],[-s[1,1],1]])/s[1,0])


def scatter(t):
    return norm(Matrix([[t[0,1],t.det()],[1,-t[1,0]]])/t[1,1])


def raw(a,b,c):
    u,v=b[1,1]-a[1,1],c[0,0]-b[0,0]
    d=cancel(b[0,1]*b[1,0]+u*v)
    assert d!=0
    return norm(Matrix([[a[0,0]+a[0,1]*a[1,0]*v/d,a[0,1]*b[1,0]*c[0,1]/d],
                        [a[1,0]*b[0,1]*c[1,0]/d,c[1,1]-c[0,1]*c[1,0]*u/d]]))


def main():
    base=[Matrix(2,2,[Q(3+j+p,13)+I*Q(2*j-p+1,11) for j in range(4)]) for p in (0,4,9)]
    exact=zero=0
    order_changes=0
    for port,index,power in product((0,1,2),(1,2),(0,8,24,48,90)):
        mats=[m.copy() for m in base]
        mats[port][index]=(3+2*I)/2**power
        a,b,c=mats
        forward=raw(a,b,c);reverse=raw(c,b,a)
        order_changes+=forward!=reverse
        for x,z in [(a,c),(c,a)]:
            got=scatter(norm(chain(x)*chain(b).inv()*chain(z)))
            assert raw(x,b,z)==got
            exact+=1
    for port,index in product((0,1,2),(1,2)):
        mats=[m.copy() for m in base]
        mats[port][index]=0
        a,b,c=mats
        for x,z in [(a,c),(c,a)]:
            h=raw(x,b,z)
            assert all(v.is_finite for v in h)
            zero+=1
    print({'exact_matrix_cases':exact,'distinct_order_pairs':order_changes,
           'finite_true_zero_transmission_extensions':zero,'scientific_wave_rows':0})


if __name__=='__main__':main()
