"""Input-only rank and continuous angular-field counterexamples for the registered geometry."""
import json
import math
import numpy as np
from forecast import GAUGES, conditions, footprint, wave_number

sides=np.array([.508,.464])
angle=math.pi/8
axes=np.array([[math.cos(angle),math.sin(angle)],[-math.sin(angle),math.cos(angle)]])


def make_field(beta):
    K=wave_number(2*math.pi*13/32,0)
    a,b=K*math.cos(beta),K*math.sin(beta)
    response=np.zeros(3,complex)
    witness=[]
    for i in (-1,1):
        for j in (-1,1):
            k=np.array([i*a,j*b])
            weight=-i*j*np.exp(1j*i*a*.273)/4
            mass=sides.prod()*np.sinc((axes@k)*sides/(2*math.pi)).prod()
            dg=footprint(k,False)
            response+=weight*np.array([mass,1j*dg[1],-1j*dg[0]])
            witness.append([k.tolist(),[weight.real,weight.imag]])
    if max(abs(response.imag))>1e-12:raise ValueError('complex field mismatch')
    return response.real,witness


def result():
    failures=[];accepted={}; census={}
    for name,freq,theta,u in conditions():
        if name[2]=='D':continue
        phi=np.deg2rad([theta,theta+180,theta+90,theta-90])
        dirs=np.column_stack((np.cos(phi),np.sin(phi)))
        k=np.array([wave_number(2*np.pi*freq,u*p[0])*p for p in dirs])
        observed=np.exp(-1j*(GAUGES@k.T))
        avg=np.prod(np.sinc((k@axes.T)*sides/(2*np.pi)),axis=1)/np.cosh(np.linalg.norm(k,axis=1)*2)
        c=float(np.linalg.cond(observed))
        joint=np.vstack((observed,avg))
        cs=float(np.linalg.cond(joint))
        census[name]=[c,cs,float(np.linalg.svd(joint,compute_uv=False)[-1])]
        if c>1e5:failures.append(name)
        accepted[name]=cs<=1e5
    if failures!=['ETC0003','ETC0007'] or not all(accepted.values()):raise ValueError(failures)
    p,w=make_field(math.pi/6);q,v=make_field(math.pi/3)
    # Cancel the two pressure integrals analytically; the two moment values
    # below are numerical and use only nominal geometry, no sensor outcomes.
    residual=(q[0]*p-p[0]*q)/(abs(p[0])+abs(q[0]))
    return {'surface_only_failures':failures,'joint_passed':sum(accepted.values()),'conditions':census,
            'null_field_30deg':{'responses':p.tolist(),'rays':w},
            'null_field_60deg':{'responses':q.tolist(),'rays':v},
            'combined_unit_variation_geometry_response':residual.tolist()}


if __name__=='__main__':
    print(json.dumps(result(),sort_keys=True,allow_nan=False))
