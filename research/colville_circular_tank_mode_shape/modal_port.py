"""First symmetric interfacial mode in a rigid circular cross-section, with an exact rectangular control."""
import json
import math
import numpy as np
from scipy import linalg, sparse
from scipy.sparse.linalg import splu

def boundary_mass(x):
    n=len(x);M=np.zeros((n,n))
    for j,dx in enumerate(np.diff(x)):
        M[j:j+2,j:j+2]+=dx*np.array([[2.,1.],[1.,2.]])/6.
    return M

def port(fill,n,rectangle):
    # x >= 0 is the symmetry half; mirror Neumann wall at x=0.
    R=.2; h=2*R*fill
    pts=[];rings=[]
    for k in range(n+1):
        if rectangle:
            y=-h+h*k/n;w=R
        else:
            ang=math.acos(1-2*fill)*k/n;y=-R*math.cos(ang);w=R*math.sin(ang)
        indices=[]
        for x in (np.linspace(0,w,n+1) if w>0 else [0.]):
            indices.append(len(pts));pts.append((x,y))
        rings.append(indices)
    tri=[]
    for lo,hi in zip(rings,rings[1:]):
        for j in range(n):
            if len(lo)==1:tri.append((lo[0],hi[j],hi[j+1]))
            else:tri.extend([(lo[j],lo[j+1],hi[j+1]),(lo[j],hi[j+1],hi[j])])
    tri=np.asarray(tri);xy=np.asarray(pts);u=xy[tri]
    dx=u[:,[1,2,0],0]-u[:,[2,0,1],0];dy=u[:,[1,2,0],1]-u[:,[2,0,1],1]
    area2=np.abs(dx[:,0]*dy[:,1]-dx[:,1]*dy[:,0]);assert (area2>0).all()
    local=(dx[:,:,None]*dx[:,None,:]+dy[:,:,None]*dy[:,None,:])/(2*area2[:,None,None])
    shape=(len(pts),)*2
    L=sparse.coo_matrix((local.ravel(),(np.repeat(tri,3,axis=1).ravel(),np.tile(tri,(1,3)).ravel())),shape=shape).tocsc()
    first=rings[-1][0];C=L[:first,first:].toarray();Q=L[first:,first:].toarray()-C.T@splu(L[:first,:first]).solve(C)
    return xy[first:,0],(Q+Q.T)/2

def mode(fill,n,gas=.001204,rectangle=False):
    x,Ql=port(fill,n,rectangle);xg,Qg=port(1-fill,n,rectangle)
    assert np.allclose(x,xg,rtol=0,atol=1e-14)
    M=boundary_mass(x);Z=linalg.null_space((np.ones(len(x))@M)[None,:])
    L=Z.T@M@Z;F=M@Z
    J=F.T@(linalg.pinvh(Ql,rtol=1e-11)+gas*linalg.pinvh(Qg,rtol=1e-11))@F
    val,v=linalg.eigh((J+J.T)/2,L)
    y=Z@v[:,-1];y=y/y[0]
    return {"frequency_Hz":math.sqrt(9.80665*(1-gas)/val[-1])/(2*math.pi),
            "wall_over_center":float(y[-1]),"center_per_wall_amplitude":1/abs(float(y[-1])),
            "surface_volume_residual_m":abs(float(np.ones(len(x))@M@y))}

def qualify():
    results={}
    for fill in (.3,.5,.67):
        results[str(fill)]={str(n):mode(fill,n) for n in (16,32,64)}
        a=results[str(fill)]["32"];b=results[str(fill)]["64"]
        assert abs(a["frequency_Hz"]/b["frequency_Hz"]-1)<.004
        assert abs(a["center_per_wall_amplitude"]/b["center_per_wall_amplitude"]-1)<.02
        assert b["surface_volume_residual_m"]<1e-12 and b["wall_over_center"]<0
    z=mode(.5,32,0);a=mode(.5,32,.3)
    atwood=(a["frequency_Hz"]/z["frequency_Hz"])**2
    assert abs(atwood-(1-.3)/(1+.3))<1e-11 and abs(a["wall_over_center"]-z["wall_over_center"])<1e-10
    rect=mode(.3,48,0,True);k=math.pi/.2
    exact=math.sqrt(9.80665*k*math.tanh(k*.12))/(2*math.pi)
    assert abs(rect["frequency_Hz"]/exact-1)<.002 and abs(rect["wall_over_center"]+1)<.004
    print(json.dumps({"rectangle":rect,"rectangle_exact_Hz":exact,"atwood_squared_frequency_ratio":atwood,
                      "circular":results,"assumed_density_ratio":.001204,"measured_ordinates_read":0},sort_keys=True))
if __name__=="__main__":qualify()
