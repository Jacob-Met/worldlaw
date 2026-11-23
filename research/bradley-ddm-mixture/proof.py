"""Exact optical-weight and stochastic non-identification checks; no dataset responses."""
from fractions import Fraction as Q

def verify():
    inputs=[(70,1),(50,2),(25,5),(10,13),(5,25),(Q(5,2),40),(1,63),(Q(1,2),77),(Q(1,10),95),(Q(1,50),99)]
    lower=[];upper=[]
    for mass,expected_small in inputs:
        w=Q(mass,100); c=Q(expected_small,100); odds=(1-w)/w
        lower.append(odds*(1/(c+Q(1,200))-1))
        upper.append(odds*(1/(c-Q(1,200))-1))
    interval=max(lower),min(upper)
    point=(Q(1100,240))**3
    assert 0<interval[0]<=interval[1]<point
    # dX=-Xdt+sqrt(2)dB1, dY=-4Ydt+sqrt(8)dB2. Both stationary variances equal one.
    # Stationary cross covariance is (sqrt(2)*sqrt(8))*rho/(1+4).
    mix=[]
    for rho in (Q(-1,2),Q(1,2)):
        cov=4*rho/5
        a=1+2*cov;b=4+2*cov
        assert a>0 and b>0
        # t=ln(2). Marginal DICFs are 1 and 15/8 for either choice of rho.
        observed=2*(a*Q(1,2)+b*Q(15,16))
        direct=1+4*Q(15,8)+4*cov*(2-Q(1,2)-Q(1,16))
        assert observed==direct
        mix.append(observed)
    assert mix==[Q(31,5),Q(54,5)]
    return dict(table1_effective_ratio_interval=[str(x) for x in interval],point_scatter_nominal=str(point),
                same_pure_DICFs_distinct_mixture=[str(x) for x in mix])

if __name__=='__main__':
    print(verify())
