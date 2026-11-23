"""Acoustically matched 26-point designs and authentic Koyama kernel coefficients."""
import itertools
import numpy as np
from scipy.special import spherical_jn
from projection import C,OFF,OLD,MOVED,H
from author_filters import author_weights

PAIRS=[(i,int(np.flatnonzero(np.all(OFF==-p,axis=1))[0])) for i,p in enumerate(OFF) if tuple(p)>tuple(-p)]
DROP=np.array([sorted(v for pair in trip for v in pair) for trip in itertools.combinations(PAIRS,3)
               if set(v for pair in trip for v in pair)!=set(range(26,32))])

def directional_covariance(k,pos,ray):
    differences=pos[:,None,:]-pos[None,:,:]
    z=2j*ray-k*differences
    return spherical_jn(0,np.sqrt(np.sum(z*z,axis=-1)))

def optimal_layout(center,source):
    ray=(source-center)/np.linalg.norm(source-center)
    pos=np.vstack((OFF*H,np.zeros((1,3))))
    K=directional_covariance(2*np.pi*3680/C,pos,ray)
    P=np.linalg.inv(K[:32,:32]+.001*np.eye(32))
    beta=K[32,:32]@P
    # Exact conditional-variance increment when dropping each six-row subset.
    compressed=P[DROP[:,:,None],DROP[:,None,:]]
    row=beta[DROP]
    solution=np.linalg.solve(compressed,row.conj()[...,None])[...,0]
    losses=np.einsum("ij,ij->i",row,solution).real
    if np.min(losses)<-1e-9:raise ValueError("Invalid conditional variance")
    ix=min(range(len(losses)),key=lambda i:(round(float(losses[i]),12),tuple(DROP[i])))
    keep=np.setdiff1d(np.arange(32),DROP[ix])
    assert len(keep)==26 and np.max(np.sum(OFF[keep]**2,axis=1))==4
    # Check the winning, best-original, and relocated native Schur formulas.
    V=K[32,32]-(K[32,:32]@P@K[:32,32])
    for D in (DROP[ix],np.setdiff1d(np.arange(32),OLD),np.setdiff1d(np.arange(32),MOVED)):
        keep2=np.setdiff1d(np.arange(32),D)
        expected=K[32,32]-K[32,keep2]@np.linalg.solve(K[np.ix_(keep2,keep2)]+.001*np.eye(26),K[keep2,32])
        d=beta[D]@np.linalg.solve(P[np.ix_(D,D)],beta[D].conj())
        if abs(expected-(V+d))>1e-8:raise ValueError("Precision submatrix cross-check failed")
    return keep

def method_weights(author,freq,center,source,layout):
    pos=center+H*OFF[layout]
    iso=author_weights(author,freq,pos,center,source,False)
    direct=author_weights(author,freq,pos,center,source,True)
    ray=(source-center)/np.linalg.norm(source-center)
    joint=directional_covariance(2*np.pi*freq/C,np.vstack((pos,center)),ray)
    expected=np.linalg.solve((joint[:-1,:-1]+.001*np.eye(26)).T,joint[-1,:-1])
    np.testing.assert_allclose(direct,expected,atol=1e-8,rtol=1e-8)
    return iso,direct
