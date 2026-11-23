"""Hyperfine energies within one rotational J manifold of 29Si33S."""
import math
from fractions import Fraction

def angular_square(twice):
    return Fraction(twice*(twice+2),4)

def triangle(a,b,c):
    return abs(a-b)<=c<=a+b and (a+b+c)%2==0

def projection(j,f):
    """Return the source-coupled 2F1 basis and exact J·I(Si) diagonals/offdiagonal²."""
    j2=2*j
    f2=2*f
    f1s=[p for p in range(abs(j2-3),j2+4,2) if triangle(p,1,f2)]
    ks=[p for p in range(abs(j2-1),j2+2,2) if triangle(p,3,f2)]
    if not f1s or len(ks)!=len(f1s):raise ValueError("Unknown total-spin sector")
    jj,ss,ii,ff=(angular_square(p) for p in (j2,3,1,f2))
    eigen=[(angular_square(k)-jj-ii)/2 for k in ks]
    diagonal=[]
    for p in f1s:
        pp=angular_square(p)
        diagonal.append((pp+jj-ss)*(ff-pp-ii)/(4*pp))
    if sum(diagonal)!=sum(eigen):raise ValueError("Angular trace mismatch")
    off2=Fraction(0) if len(eigen)==1 else diagonal[0]*diagonal[1]-eigen[0]*eigen[1]
    if off2<0:raise ValueError("Angular determinant mismatch")
    return f1s,diagonal,off2

def recouple(j,f,sulfur,si_c,method):
    """Sulfur-only offsets keyed by 2F1; si_c in the same frequency units."""
    f1s,diagonal,off2=projection(j,f)
    unperturbed=[sulfur[k] for k in f1s]
    levels=[s+float(d)*si_c for s,d in zip(unperturbed,diagonal)]
    if method=="diagonal" or len(levels)==1:return dict(zip(f1s,levels))
    if method!="coupled":raise ValueError("Unknown recoupling method")
    # Adiabatically turn on the Si term at fixed S term, assigning the source's F1
    # parent label by the energy order at zero Si spin rotation.
    if unperturbed[0]==unperturbed[1]:raise ValueError("Degenerate F1 label at zero coupling")
    middle=(levels[0]+levels[1])/2
    half=math.hypot((levels[1]-levels[0])/2,si_c*math.sqrt(float(off2)))
    sign=1 if unperturbed[0]<unperturbed[1] else -1
    return {f1s[0]:middle-sign*half,f1s[1]:middle+sign*half}
