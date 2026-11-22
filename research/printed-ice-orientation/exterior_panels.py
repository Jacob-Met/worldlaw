"""Exterior Laplace double-layer equation on the actual closed triangular surface.

For body-normal g = n dot U, exterior boundary potential solves
(1/2 I - K) phi = -Sg. The panel integrals are analytic and the unknown
potential is piecewise constant, collocated at the triangle centroid.
"""
import inspect

import numpy as np
from scipy.sparse.linalg import gmres


def subdivide(t):
    a,b,c=t[:,0],t[:,1],t[:,2]
    ab,bc,ca=(a+b)/2,(b+c)/2,(c+a)/2
    return np.concatenate([np.stack(corners,axis=1)
                           for corners in ((a,ab,ca),(ab,b,bc),(ca,bc,c),(ab,bc,ca))])


def panel_matrix(t,block=12):
    center=t.mean(axis=1)
    normal_area=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0])/2
    area=np.linalg.norm(normal_area,axis=1)
    if np.min(area)<=0:raise ValueError('nonpositive boundary-element area')
    normal=normal_area/area[:,None]
    edge=np.roll(t,-1,axis=1)-t
    length=np.linalg.norm(edge,axis=2)
    conormal=np.cross(edge,normal[:,None,:])/length[:,:,None]
    count=len(t)
    a=np.empty((count,count),dtype=float)
    rhs=np.empty((count,3))
    min_single=float('inf')
    closure=0.
    for start in range(0,count,block):
        stop=min(start+block,count)
        x=center[start:stop,None,:]
        r=[t[None,:,j,:]-x for j in range(3)]
        d=[np.linalg.norm(rr,axis=2) for rr in r]
        pair=[np.einsum('ijk,ijk->ij',r[j],r[(j+1)%3]) for j in range(3)]
        h=-np.einsum('ijk,jk->ij',r[0],normal)
        det=-2*h*area
        denom=d[0]*d[1]*d[2] + pair[0]*d[2]+pair[1]*d[0]+pair[2]*d[1]
        omega=2*np.arctan2(det,denom)
        omega[np.abs(h)<2e-14]=0.
        ii=np.arange(stop-start)
        omega[ii,start+ii]=0.
        closure=max(closure,float(np.max(np.abs(omega.sum(axis=1)-2*np.pi))))
        single=h*omega
        for j in range(3):
            # Integral of 1/r along the edge is 2*atanh(ell/(r1+r2)).
            lim=length[:,j]/(d[j]+d[(j+1)%3])
            line=2*np.arctanh(np.minimum(lim,np.nextafter(1.,0.)))
            dist=np.einsum('ijk,jk->ij',r[j],conormal[:,j])
            single+=dist*line
        min_single=min(min_single,float(single.min()))
        a[start:stop]=omega/(4*np.pi)
        a[start+ii,start+ii]=.5
        rhs[start:stop]=-(single@normal)/(4*np.pi)
    if closure>1e-6 or min_single< -1e-9:
        raise ValueError(('triangle integral consistency',closure,min_single))
    return a,rhs,normal_area,closure,min_single


def panel_added_mass(t):
    a,b,normal_area,closure,min_single=panel_matrix(t)
    potentials=[]
    residual=[]
    tol={'rtol':1e-9} if 'rtol' in inspect.signature(gmres).parameters else {'tol':1e-9}
    for j in range(3):
        potential,info=gmres(a,b[:,j],restart=80,maxiter=80,atol=0,**tol)
        err=float(np.linalg.norm(a@potential-b[:,j])/np.linalg.norm(b[:,j]))
        if info or err>2e-8:raise ValueError(('boundary equation residual',int(info),err))
        residual.append(err);potentials.append(potential)
    raw=-normal_area.T@np.column_stack(potentials)
    recip=float(np.linalg.norm(raw-raw.T,ord=2)/np.linalg.norm(raw,ord=2))
    return (raw+raw.T)/2,{'raw':raw.tolist(),'reciprocity_relative':recip,
                           'residual_relative':residual,'solid_angle_closure_rad':closure,
                           'min_single_layer_integral':min_single,'panels':len(t)}


def ellipsoid_mesh(axes,levels=1):
    # Uniform spherical subdivisions followed by scaling; independently known
    # exact tensor is diagonal for this synthetic ellipsoid.
    v=np.vstack((np.eye(3),-np.eye(3)))
    t=[]
    for i in (0,3):
        for j in (1,4):
            for k in (2,5):
                tri=v[[i,j,k]]
                if np.linalg.det(tri)<0:tri=tri[::-1]
                t.append(tri)
    t=np.array(t)
    for _ in range(levels):
        t=subdivide(t)
        t/=np.linalg.norm(t,axis=2)[:,:,None]
    return t*np.asarray(axes)
