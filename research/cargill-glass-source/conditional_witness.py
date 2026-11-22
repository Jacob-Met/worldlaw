from fractions import Fraction as F
from math import log10


def verify():
    offsets=range(-2,3)
    a=tuple(F(k,1000) for k in (85,200,430,200,85))
    b=tuple(F(k,1000) for k in (75,240,370,240,75))
    assert min(a+b)>0 and sum(a)==sum(b)==1 and a==a[::-1] and b==b[::-1]
    assert all(k[0]<k[1]<k[2] for k in (a,b))
    moments=lambda k:[sum(w*j**n for w,j in zip(k,offsets)) for n in range(5)]
    ma,mb=moments(a),moments(b)
    assert ma[:4]==mb[:4] and ma[4]!=mb[4]
    # Positive affine/quadratic glass references sampled on an entire nominal 700 channel grid.
    refs=(lambda i:F(1,3), lambda i:F(1,5)+F(i,2000),lambda i:F(1,4)+F(i*i,2000000))
    def channel(k,fixture,i):return sum(w*fixture(i-j) for w,j in zip(k,offsets))
    for reference in refs:
        assert all(0<reference(i)<1 for i in range(700))
        for i in range(2,698):assert channel(a,reference,i)==channel(b,reference,i)
    n=350
    sample=lambda i:F(4,5) if i==n else F(1,10)
    ya,yb=channel(a,sample,n),channel(b,sample,n)
    assert ya-yb==F(21,500)
    # Log reflectance and positive blending do not commute.
    mean_R=(F(1,5)+F(4,5))/2
    decoded_geometric=(float(F(1,5)*F(4,5)))**.5
    assert mean_R==F(1,2) and abs(decoded_geometric-.4)<1e-14
    return {"synthetic_only":True,"stencils":[list(map(str,a)),list(map(str,b))],
            "equal_moments_through_order_three":list(map(str,ma[:4])),
            "three_reference_channels_checked":3*696,"distinct_sample_linear_signals":[str(ya),str(yb)],
            "absolute_difference":str(ya-yb),"mean_linear_reflectance":str(mean_R),
            "reflectance_from_mean_absorbance":decoded_geometric,
            "log_mean_reflectance":-log10(float(mean_R))}


if __name__=="__main__":
    import json
    print(json.dumps(verify(),indent=2))
