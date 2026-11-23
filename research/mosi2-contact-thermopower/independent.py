"""Independent exact matrix-rank and polarity checks for the algebraic witnesses."""
from fractions import Fraction as F
from itertools import combinations, permutations

from charge_and_heat import POINTS, voltage_case


def rank(rows):
    data=[list(map(F,row)) for row in rows]
    k=0
    for c in range(len(data[0])):
        piv=next((i for i in range(k,len(data)) if data[i][c]),None)
        if piv is None:continue
        data[k],data[piv]=data[piv],data[k]
        scale=data[k][c]
        data[k]=[v/scale for v in data[k]]
        for i in range(k+1,len(data)):
            t=data[i][c]
            if t:data[i]=[a-t*b for a,b in zip(data[i],data[k])]
        k+=1
    return k


def main():
    import json
    edges=list(permutations(range(8),2))
    incidence=[[int(i==h)-int(j==h) for h in range(8)] for i,j in edges]
    xy=[[POINTS[i][k]-POINTS[j][k] for k in range(2)] for i,j in edges]
    ranks=[rank(incidence),rank(xy),rank([b+d for b,d in zip(incidence,xy)])]
    assert ranks==[7,2,7]
    count=0
    for t in [F(0),F(1,20)]:
        E,values,v=voltage_case(t)
        # Independently rotate the principal material tensor into the lab frame.
        saa,scc=values
        tensor=(((saa+scc)/2,(saa-scc)/2),((saa-scc)/2,(saa+scc)/2))
        old=tuple(row[0]+row[1]*t for row in tensor)
        assert old == E
        for (i,j),(dx,dy) in zip(edges,xy):
            sample=old[0]*dx+old[1]*dy
            au=2*(dx+t*dy)
            assert sample-au == v[i,j] == 2*dx+9*dy
            assert v[i,j]+v[j,i]==0
            count+=1
        for i,j,k in combinations(range(8),3):
            assert v[i,j]+v[j,k]+v[k,i]==0
    print(json.dumps({'ranks_incidence_geometry_augmented':ranks,
                      'checked_ordered_model_rows':count,'checked_triangle_sums':112,
                      'measured_voltage_or_peltier_targets_scored':0},sort_keys=True))


if __name__=='__main__':main()
