"""Sharp equilibrium return interval under all ordered relay-threshold couplings."""
from fractions import Fraction as F
import json

from coupling_witness import ADS, DES, HIGH, LOW, MIX, UMAX, exponential_interval, major


def derivative_band(left,right,params):
    a,b=params
    elo,_=exponential_interval(b*left)
    _,ehi=exponential_interval(b*right)
    dblo,dbhi=exponential_interval(b)
    rational=lambda r:MIX*(1+a)/(1+a*r)**2
    return (UMAX*(rational(right)+(1-MIX)*b*elo/(dbhi-1)),
            UMAX*(rational(left)+(1-MIX)*b*ehi/(dblo-1)))


def certificate():
    # For ordered Y<=X with CDFs D>=A, the sharp directional lower
    # joint CDF for Y<=l, X<=h is D(l)-min_{[l,h]}(D-A).
    # The comonotone pairing attains the other endpoint min(D(l),A(h)).
    mid=F('.90')
    ads_lo,ads_hi=major(HIGH,ADS)
    des_lo,des_hi=major(HIGH,DES)
    end_gap=(des_lo-ads_hi,des_hi-ads_lo)
    checks=[]
    for i in range(720,950):
        l,r=F(i,1000),F(i+1,1000)
        if r<=mid:
            checks.append(major(l,DES)[0]-major(r,ADS)[1]>end_gap[1])
        else:
            checks.append(derivative_band(l,r,DES)[1]<derivative_band(l,r,ADS)[0])
    assert len(checks)==230 and all(checks)
    return_lo,return_hi=major(LOW,DES)
    assert return_hi<ads_lo
    lower=(return_lo-end_gap[1],return_hi-end_gap[0])
    def decimal_interval(ab):
        # Strict outward rounding to 12 decimal places, displayed as strings.
        n=10**12
        l=ab[0].numerator*n//ab[0].denominator
        h=-((-ab[1].numerator*n)//ab[1].denominator)
        def fmt(k):return f'{k//n}.{k%n:012d}'
        return [fmt(l),fmt(h)]
    return {'path':[0,.95,.72],'kg_per_kg':{
        'sharp_lower_endpoint':decimal_interval(lower),
        'sharp_upper_endpoint':decimal_interval((return_lo,return_hi)),
        'full_width':decimal_interval(end_gap)},
        'rational_grid_cells':len(checks),'minimum_gap_location_RH':float(HIGH),
        'support':'all ordered two-threshold populations with the exact released major curves',
        'measured_bulk_mass_used':False}


if __name__=='__main__':
    print(json.dumps(certificate(),sort_keys=True,indent=2))
