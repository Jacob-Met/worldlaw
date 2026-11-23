"""Exact synthetic electrical witnesses on the eight published contact coordinates."""
from fractions import Fraction as Q
from itertools import permutations

# Figure S2 coordinates in millimetres, transcribed without opening the S3 voltage table.
POINTS = tuple((Q(x),Q(y)) for x,y in [('0','0'),('.01','1.17'),('.82','1.31'),
    ('.26','1.52'),('.40','-.39'),('.92','.04'),('1.67','1.05'),('1.0','1.93')])
EDGES = tuple(permutations(range(8),2))

def differences(values):
    return {(i,j):values[i]-values[j] for i,j in EDGES}

def voltage_case(t):
    t = Q(t)
    gold = Q(2)
    # A 45-degree rotation of a diagonal tensor has lab entries [[a,b],[b,a]].
    # Pick its two eigenvalues to preserve the same effective field (2,9).
    u = (2 - 9*t)/(1-t*t)
    b = (9 - 2*t)/(1-t*t)
    a = u + gold
    g = (Q(1),t)
    intrinsic = (a+b*t, b+a*t)
    effective = tuple(f-gold*h for f,h in zip(intrinsic,g))
    assert effective == (2,9) and (a+b)*(a-b)<0
    voltage = differences([effective[0]*x+effective[1]*y for x,y in POINTS])
    return intrinsic, (a+b,a-b), voltage

def main():
    import json
    first = voltage_case(0)
    second = voltage_case(Q(1,20))
    assert first[2] == second[2] and first[0][1] == 9 and second[0][1] == Q(91,10)
    # Eight terminals and a spanning star give rank seven. Every other edge is
    # reproduced by differences of its two star potentials.
    held = first[2]
    potential = [Q(0)]+[held[i,0] for i in range(1,8)]
    assert differences(potential)==held
    bias=Q(13,17)
    for i,j in EDGES:
        fwd,rev=held[i,j]+bias,held[j,i]+bias
        assert (fwd+rev)/2==bias and (fwd-rev)/2==second[2][i,j]
    arbitrary_offsets=[Q(i*i,11) for i in range(8)]
    plus=differences([v+off for v,off in zip(potential,arbitrary_offsets)])
    minus=differences([-v+off for v,off in zip(potential,arbitrary_offsets)])
    assert all((plus[k]-minus[k])/2==held[k] for k in EDGES)
    print(json.dumps({'ordered_edges':56,'rank':7,'undirected_cycles':21,
        'polarity_even_terms':28,'line_temperature_same_for_all_x':True,
        'intrinsic_transverse_fields':['9','91/10'],'effective_field':['2','9'],
        'opposite_principal_signs_in_both':True,
        'principal_thermopowers':[[str(c) for c in item[1]] for item in (first,second)],
        'known_external_full_tensor':False,'measured_voltage_rows_used':0},sort_keys=True))

if __name__=='__main__':main()

