"""Exact sided winding of the four documented interior/negative sheet witnesses."""
from fractions import Fraction as Q


def sub(a,b):
    return tuple(x-y for x,y in zip(a,b))


def dot(a,b):
    return sum(x*y for x,y in zip(a,b))


def cross(a,b):
    return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])


def ray(tri,point,d):
    winding=0
    for a,b,c in tri:
        e=sub(b,a);f=sub(c,a);p=cross(d,f);det=dot(e,p)
        if det==0:continue
        s=sub(point,a);u=dot(s,p);q=cross(s,e);v=dot(d,q);t=dot(f,q)
        if det<0:det,u,v,t,sgn=-det,-u,-v,-t,1
        else:sgn=-1
        if t<=0 or u<0 or v<0 or u+v>det:continue
        if min(u,v,det-u-v)==0:raise ValueError('ray hits a mesh edge')
        winding+=sgn
    return winding


def verify(meshes):
    import numpy as np
    from mesh_forecast import clean_solid
    witness={'Ag,Cr107':(358,[-1,0]),'Ag,St42':(21,[1,2]),'Ag,St100':(977,[1,2]),'Ag,St53':(20,[1,2]),
             'Ag,Cr121':(405,[0,1])}
    result={}
    for name,(fid,expected) in witness.items():
        raw,_=clean_solid(meshes[name])
        tri=[tuple(tuple(Q(float(v)) for v in p) for p in f) for f in raw]
        a,b,c=tri[fid]
        normal=cross(sub(b,a),sub(c,a))
        p=tuple((x+y+z)/3 for x,y,z in zip(a,b,c))
        scale=Q(float(np.ptp(raw.reshape(-1,3),axis=0).max()))
        eps=scale/(10**8*max(abs(x) for x in normal))
        counts=[]
        for sign in (1,-1):
            pt=tuple(x+sign*eps*y for x,y in zip(p,normal))
            counts.append([ray(tri,pt,d) for d in ((1,3,7),(3,-5,11),(-7,4,13))])
        if counts!=[[v]*3 for v in expected]:raise ValueError((name,counts,expected))
        result[name]={'cleaned_face_index':fid,'outward_inward_three_rays':counts}
    return result
