from fractions import Fraction as R
import json
# F' positive: two exact continuous piecewise-polynomial potentials. The added
# profile has compact support and zero derivative at both interval boundaries.
def H(T,a,b):
    T,a,b=map(R,(T,a,b))
    if T<=a:return R(0)
    if T>=b:return R(1)
    u=(T-a)/(b-a)
    return 3*u*u-2*u*u*u
def edge(a,b,alpha,lo,hi):
    return R(b)-R(a)+alpha*(H(b,lo,hi)-H(a,lo,hi))
scenarios=[('device1-40K',((20,22),(40,44),(70,77)),(40,60),(44,60)),('device1-70K',((20,22),(40,44),(70,77)),(70,105),(77,105)),('device2-50K',((5,R(15,2)),(10,20),(15,30)),(50,75),(50,75))]
for name,observed,query,(lo,hi) in scenarios:
    base=[edge(a,b,0,lo,hi) for a,b in observed]
    out={}
    for A in (R(0),R(1),R(100000)):
        assert [edge(a,b,A,lo,hi) for a,b in observed]==base
        assert edge(*query,A,lo,hi)==edge(*query,0,lo,hi)+A
        for j in range(65):
            u=R(j,64);assert 1+A*6*u*(1-u)/(hi-lo)>=1
        out[str(A)]=str(edge(*query,A,lo,hi))
    print(name,json.dumps({"known_intervals":[list(map(str,e)) for e in observed],"sample_equal_thermal_currents":list(map(str,base)),"held_example_interval":query,"two_potentials_and_unbounded_sequence":out},sort_keys=True))
print("All intervals and current units in this control are ideal, synthetic. Example queries set bulk cold temperature equal to bath, hot equal to 1.5*bath. No experimental values are inputs. Phase, absolute calibration, thermometer spatial integration, 30 mV contact bias and finite-frequency response remain unqualified.")
