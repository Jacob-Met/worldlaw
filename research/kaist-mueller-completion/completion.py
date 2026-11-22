"""Single-bin completion for the signed circular-to-circular Mueller coefficient.

Input matrices have been divided by their positive M00. All output coordinates
use the published right-handed ingoing/outgoing scattering-plane convention.
"""
import numpy as np


I = np.eye(2)
Q = np.diag([1., -1.])
U = np.array([[0., 1.], [1., 0.]])
V = np.array([[0, -1j], [1j, 0]])
S = (I, Q, U, V)
BASIS = np.array([[np.kron(b.T, a).real / 4 for b in S[:3]] for a in S[:3]])
K = np.kron(V.T, V).real / 4
METRIC = np.diag([1., -1., -1.])


def mueller(jones):
    return np.array([[np.trace(s @ jones @ t @ jones.conj().T).real/2
                      for t in S] for s in S])


def cpspan(block, tol=1e-9):
    """Gil real-covariance admissibility, bounded in [-1,1] for M00=1.

    Solves the scalar matrix pencil analytically up to eigensolver precision.
    An empty interval is reported and never imputed as a valid interval.
    """
    a=np.asarray(block,dtype=float)
    if a.shape != (3,3) or not np.all(np.isfinite(a)) or abs(a[0,0]-1)>1e-8:
        raise ValueError("expected finite 3 by 3 normalized IQU block")
    h0=np.einsum("ij,ijkl->kl",a,BASIS)
    relaxed=h0+tol*np.eye(4)
    roots=np.linalg.eigvals(-16*K@relaxed)
    r=sorted(float(np.clip(y.real,-1.,1.)) for y in roots
             if abs(y.imag)<=1e-7 and -1.-1e-7<=y.real<=1.+1e-7)
    edges=np.array(sorted(set([-1.,1.,*r])))
    mids=(edges[1:]+edges[:-1])/2
    def ok(x):
        return np.linalg.eigvalsh(relaxed+x*K)[0] >= -5e-12
    valid=[float(x) for x in edges if ok(x)]
    for j,x in enumerate(mids):
        if ok(x):
            valid.extend([float(edges[j]),float(edges[j+1])])
    if not valid:
        return None
    return min(valid),max(valid)


def pure_cofactor(a):
    """Fixed closest repeated-eigenvalue rule with explicit refusal categories."""
    a=np.asarray(a,float)
    values=np.linalg.eigvals(METRIC@a.T@METRIC@a)
    candidates=[]
    for i,j in [(0,1),(0,2),(1,2)]:
        x,y=values[i],values[j]
        delta=float((x.real+y.real)/2)
        pairerr=max(abs(x-y),abs(x.imag),abs(y.imag))
        candidates.append((float(pairerr),delta))
    err,delta=min(candidates)
    if not 1e-8 < delta <= 1.000001:
        return None,"singular_or_nonphysical_pair",delta,err
    if err>1e-5*max(delta,.05):
        return None,"imperfect_repeated_eigenvalue",delta,err
    # Both right- and left-hand Lorentz equations require a PSD rank-one residual.
    for v in [a.T@METRIC@a-delta*METRIC, a@METRIC@a.T-delta*METRIC]:
        e=np.linalg.eigvalsh(v)
        if max(abs(e[0]),abs(e[1]),max(0.,-e[2]))>1e-5:
            return None,"rank_one_condition_failed",delta,err
    target=np.linalg.det(a)/delta
    if abs(target)>1.00001:
        return None,"outside_optical_range",delta,err
    return float(np.clip(target,-1.,1.)),"pure_accepted",delta,err


def optical_controls(a):
    """Every finite positive-intensity bin gets each control's forecast."""
    s=cpspan(a)
    fresnel=float(np.clip(a[2,2],-1.,1.))
    pure,status,delta,err=pure_cofactor(a)
    info={"pure_status":status,"delta":delta,"pair_gap":err,"empty":s is None}
    if s is None:
        lo=hi=fresnel
    else:
        lo,hi=s
    # A magnitude tie is an identified ambiguity. A zero fallback is retained.
    if abs(abs(lo)-abs(hi))<=1e-8 and abs(hi-lo)>1e-8:
        maximum=0.
        info["max_purity_ambiguous"]=True
    else:
        maximum=lo if abs(lo)>abs(hi) else hi
        info["max_purity_ambiguous"]=False
    return {"zero":0.,"fresnel_uu":fresnel,"pure":fresnel if pure is None else pure,
            "gil_max_abs":float(maximum),"midpoint":(lo+hi)/2,
            "lower":lo,"upper":hi},info
