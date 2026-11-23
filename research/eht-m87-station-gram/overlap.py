from fractions import Fraction as Q
import itertools,json
def det(m):
    return sum(((-1)**sum(p[i]>p[j] for i in range(len(m)) for j in range(i+1,len(m))))*
               prod(m[i][j] for i,j in enumerate(p)) for p in itertools.permutations(range(len(m))))
def prod(xs):
    y=1
    for x in xs:y*=x
    return y
def inspect(p):
    a=(1-p)/2;c=1-3*a
    assert c>=0 and p>0
    # One common segment and three pair-only segments. Fields from a point source
    # have unity modulus, with one unresolved within-bin station phase reversal.
    slots=[(c,(1,1,1)),(a,(1,1,0)),(a,(1,0,1)),(a,(0,1,-1))]
    A=[[sum(w*row[i]*row[j] for w,row in slots) for j in range(3)] for i in range(3)]
    W=[[sum(w*abs(row[i]*row[j]) for w,row in slots) for j in range(3)] for i in range(3)]
    G=[[A[i][j]/W[i][j] for j in range(3)] for i in range(3)]
    for i,j in itertools.combinations(range(3),2):
        assert W[i][j]==p and A[i][i]*A[j][j]>=A[i][j]**2
    assert det(A)>=0 and det(G)==-((1-p)/p)**2
    # Retained normalized pairs both unity; PSD with known unit diagonal forces
    # the omitted 23 coherence to unity. Nonnegative rescaled exposure recovers
    # a true Gram only because the station masks/weights are known in this example.
    assert G[0][1]==G[0][2]==1 and G[1][2]==2-1/p
    return dict(p=str(p),retained=[str(G[0][1]),str(G[0][2])],held=str(G[1][2]),
                determinant_pair_normalized=str(det(G)),determinant_unscaled=str(det(A)),common_fraction=str(c))
for p in (Q(3,4),Q(9,10),Q(99,100),Q(999,1000),Q(1)):
    print("IDEAL_MASK",json.dumps(inspect(p)))
print("Gain/gauge check: arbitrary 3x3 or 4x4 Hermitian observed off-diagonals B with zero diagonal admit PSD completion B+tI for t>=max_i sum_j|B_ij| by diagonal dominance. Without calibrated gain/power caps any missing complex edge therefore fits some Gram. This is an outer-class result, not sufficiency for a physical intensity image at the actual baselines.")

