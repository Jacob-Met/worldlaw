"""A conditional complex-symmetric scattering update, tested with exact rational matrices."""
from fractions import Fraction as F


def mult(a,b):
    return [[sum(x*y for x,y in zip(row,col)) for col in zip(*b)] for row in a]


def transpose(a):
    return list(map(list,zip(*a)))


def inv2(a):
    (a,b),(c,d)=a
    determinant=a*d-b*c
    if not determinant:raise ValueError('singular')
    return [[d/determinant,-b/determinant],[-c/determinant,a/determinant]]


def field(column,hidden):
    # Receptance with normalized angular frequency 1 and both added masses 1/8.
    # This test uses displacement (the accelerance update has another minus sign).
    denom=[[F(8*(i==j))-hidden[i][j] for j in range(2)] for i in range(2)]
    return mult(mult(column,inv2(denom)),transpose(column))


def test():
    blocks=[[F(1),F(0)],[F(0),F(1)],[F(1),F(1)]]
    hidden0=[[F(4),F(0)],[F(0),F(5)]]
    hidden1=[[F(4),F(1)],[F(1),F(5)]]
    no_coupling=field(blocks,hidden0)
    coupling=field(blocks,hidden1)
    assert no_coupling[0][1]==0 and coupling[0][1]==F(1,11)
    # With identity first two rows, measured 2×2 perturbation fixes the
    # symmetric core. The third port is never used in this fit.
    selected=[[coupling[i][j] for j in range(2)] for i in range(2)]
    reconstructed=mult(mult(blocks,selected),transpose(blocks))
    assert reconstructed==coupling
    assert coupling[2][2]==F(9,11)
    # Both healthy full receptances can be positive definite: take observed
    # principal block 10I and use the Schur complement of that block.
    for core in [hidden0,hidden1]:
        reduction=mult(transpose(blocks),blocks)
        cs=[[core[i][j]-reduction[i][j]/10 for j in range(2)] for i in range(2)]
        assert cs[0][0]>0 and cs[0][0]*cs[1][1]-cs[0][1]**2>0
    return {'same_healthy_observables':True,'changed_cross_port':[str(no_coupling[0][1]),str(coupling[0][1])],
            'unseen_self':str(coupling[2][2]),'counts':{'calibration_positions':2,'held_positions':1},
            'experimental_FRFs_used':0}


if __name__=='__main__':print(test())
