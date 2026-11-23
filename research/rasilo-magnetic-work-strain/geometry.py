"""Exact finite-stress observability witnesses, with no measured responses."""
from fractions import Fraction

def derivative_at(roots,x):
    result=Fraction()
    for omit in range(len(roots)):
        term=Fraction(1)
        for j,t in enumerate(roots):
            if j!=omit:
                term*=x-t
        result+=term
    return result

def witness():
    stress=list(map(Fraction,(-35,-30,-20,-15,-10,-5,0,5,10,15,40,50,60,70,80,90,100)))
    anchors=set(map(Fraction,(-35,0,15,80)))
    n=0
    for chosen in stress:
        if chosen in anchors:continue
        roots=stress+[s for s in stress if s!=chosen]
        gain=derivative_at(roots,chosen)
        assert gain
        for s in stress:
            assert derivative_at(roots,s)/gain==int(s==chosen)
            n+=1
    signs=[(-1)**i for i in range(len(stress))]
    assert all(x+y==0 for x,y in zip(signs,signs[1:]))
    return {'nodes':len(stress),'selective_derivatives':n,'held_nodes':13,'trapezoid_gauge_dimension':1}

if __name__=='__main__':
    print(witness())
