"""Check two ordered relay populations with the released entire major isotherms."""
from fractions import Fraction as F
from functools import lru_cache
import json


UMAX, MIX = F('0.2968'), F('0.4121')
ADS, DES = (F('1.7487'),F('7.299')), (F('3.0533'),F('4.3106'))
LOW, HIGH = F('.72'), F('.95')
SHIFT, WIDTH = F('.016'), F('.012')
STARTS = [F('.149')+i*SHIFT for i in range(7)]


@lru_cache(None)
def exponential_interval(x):
    """Positive Taylor terms through degree 34, then a geometric tail bound."""
    if not 0 <= x < 8:
        raise ValueError('Argument outside certified domain')
    term, partial = F(1), F(1)
    for j in range(1,35):
        term *= x/j
        partial += term
    next_term = term*x/35
    return partial, partial+next_term/(1-x/36)


def major(r, ab):
    a,b=ab
    num_low,num_high=exponential_interval(r*b)
    den_low,den_high=exponential_interval(b)
    rational=MIX*(1+a)*r/(1+a*r)
    return (UMAX*(rational+(1-MIX)*(num_low-1)/(den_high-1)),
            UMAX*(rational+(1-MIX)*(num_high-1)/(den_low-1)))


def certificate():
    if not all(x+WIDTH < y for x,y in zip(STARTS,STARTS[1:])):
        raise ValueError('Intervals must be disjoint')
    # A and D are increasing. D >= A on [0,1]: the rational term
    # increases with a, and the normalized exponential term falls with b.
    # The latter is the CDF of an increasing exponential tilt on [0,1].
    assert ADS[0]<DES[0] and ADS[1]>DES[1]
    amin,amax=major(HIGH,ADS);dmin,dmax=major(LOW,DES)
    assert STARTS[0]+WIDTH < dmin <= dmax < STARTS[1]
    assert STARTS[-2]+WIDTH < amin <= amax < STARTS[-1]
    r_min,r_max=F('.75'),F('.95')
    assert major(r_min,ADS)[1] < STARTS[0]
    assert major(r_max,ADS)[0] > STARTS[-2]+WIDTH
    # For a common rank u in any of the six forward-shifted intervals,
    # a=A^{-1}(u) lies inside this grid. Lower-bound D(a)-A(a) uniformly.
    # Thus D^{-1}(u+SHIFT) <= A^{-1}(u). The last strip moves down,
    # so its new deactivation threshold is also below activation.
    grid=[r_min+F(i,1000) for i in range(201)]
    guard=min(major(l,DES)[0]-major(r,ADS)[1] for l,r in zip(grid,grid[1:]))
    assert guard>SHIFT
    # Start dry, wet to HIGH, then dry to LOW. Baseline has wet rank
    # min(A(HIGH),D(LOW)) = D(LOW). Only the first strip changes its
    # counted status. The final strip, given low off-thresholds, never activated.
    return {'input_path_rh':[0,float(HIGH),float(LOW)],'unit':'kg water per kg dry wood',
            'activating_rank_intervals':[[float(u),float(u+WIDTH)] for u in STARTS],
            'cyclic_permutation':[1,2,3,4,5,6,0],'shift_kg_kg':float(SHIFT),
            'certified_D_minus_A_lower_bound_gt_0.018':guard>F('.018'),
            'major_adsorption_at_high':float((amin+amax)/2),
            'major_desorption_at_low':float((dmin+dmax)/2),
            'comonotone_return':float((dmin+dmax)/2),
            'permuted_return':float((dmin+dmax)/2-WIDTH),
            'exact_equilibrium_disagreement':str(WIDTH),'uniform_rational_intervals':200,
            'finite_time_bulk_mass_claim':False}


if __name__=='__main__':
    print(json.dumps(certificate(),sort_keys=True,indent=2))
