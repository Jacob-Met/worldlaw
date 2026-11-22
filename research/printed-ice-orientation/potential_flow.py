"""Cell-centered exterior potential flow with impermeable solid voxels.

Unit fluid density.  Dirichlet potential at a finite outer box.  The three
right-hand sides prescribe translations of the obstacle along the grid axes.
"""
import numpy as np
import inspect
from scipy import sparse
from scipy.sparse.linalg import LinearOperator, cg


def grid(length, resolution, outer_radius=3.5):
    step=length/resolution
    # Central uniform zone spans the shape, with stretched cells outside it.
    half=np.arange(resolution//2+2, dtype=float)*step
    edges=list(half)
    width=step
    while edges[-1] < outer_radius*length:
        width*=1.30
        edges.append(edges[-1]+width)
    e=np.asarray(edges)
    return np.concatenate((-e[:0:-1],e))


def voxel_solid(tri, edges):
    centers=(edges[:-1]+edges[1:])/2
    n=len(centers)
    crossings=np.zeros((n,n,n+1),dtype=np.int16)
    # A fixed subgrid translation avoids shared-vertex hits along a ray.
    xy_jitter=np.min(np.diff(edges))*np.array([0.002183,0.001523])
    xs=centers+xy_jitter[0]
    ys=centers+xy_jitter[1]
    for a,b,c in tri:
        e=b-a
        f=c-a
        det=e[0]*f[1]-e[1]*f[0]
        if abs(det)<1e-16:continue
        ix=np.arange(*np.searchsorted(xs,[min(a[0],b[0],c[0]),max(a[0],b[0],c[0])]))
        iy=np.arange(*np.searchsorted(ys,[min(a[1],b[1],c[1]),max(a[1],b[1],c[1])]))
        if not len(ix) or not len(iy):continue
        p=xs[ix,None]-a[0]
        q=ys[None,iy]-a[1]
        u=(p*f[1]-q*f[0])/det
        v=(q*e[0]-p*e[1])/det
        i,j=np.nonzero((u>=0)&(v>=0)&(u+v<=1))
        z=a[2]+u[i,j]*e[2]+v[i,j]*f[2]
        np.add.at(crossings,(ix[i],iy[j],np.searchsorted(centers,z)),int(-np.sign(det)))
    winding=np.cumsum(crossings,axis=2)
    if np.any(winding[:,:,-1]!=0):raise ValueError('open scanline winding')
    return winding[:,:,:-1]>0


def added_mass(solid,edges):
    n=len(edges)-1
    widths=np.diff(edges)
    fluid=~solid
    ids=np.full(solid.shape,-1,dtype=np.int32)
    ids[fluid]=np.arange(fluid.sum(),dtype=np.int32)
    size=int(fluid.sum())
    diag=np.zeros(size)
    rhs=np.zeros((size,3))
    off_i=[];off_j=[];off_val=[]
    for k in range(3):
        gid=np.moveaxis(ids,k,0)
        low=gid[:-1]; high=gid[1:]
        face=np.broadcast_to(widths[:,None]*widths[None,:],low.shape)
        cond=face/((widths[1:]+widths[:-1])/2)[:,None,None]
        both=(low>=0)&(high>=0)
        i=low[both];j=high[both];g=cond[both]
        np.add.at(diag,i,g);np.add.at(diag,j,g)
        off_i.extend((i,j));off_j.extend((j,i));off_val.extend((-g,-g))
        # Opposed signs encode the exterior-domain normal of each fluid face.
        m=(low>=0)&(high<0);np.add.at(rhs[:,k],low[m],face[m])
        m=(high>=0)&(low<0);np.add.at(rhs[:,k],high[m],-face[m])
        for side,width in [(gid[0],widths[0]),(gid[-1],widths[-1])]:
            m=side>=0;np.add.at(diag,side[m],2*face[0][m]/width)
    if np.max(np.abs(rhs.sum(axis=0)))>1e-8:
        raise ValueError('closed solid has nonzero net imposed flux')
    diagonal_ids=np.arange(size,dtype=np.int32)
    off_i.append(diagonal_ids);off_j.append(diagonal_ids);off_val.append(diag)
    mat=sparse.coo_matrix((np.concatenate(off_val),(np.concatenate(off_i),np.concatenate(off_j))),shape=(size,size)).tocsr()
    pre=LinearOperator(mat.shape,matvec=lambda x:x/diag,dtype=float)
    sol=[]
    for j in range(3):
        tolerance={'rtol':2e-7} if 'rtol' in inspect.signature(cg).parameters else {'tol':2e-7}
        x,info=cg(mat,rhs[:,j],M=pre,atol=0,maxiter=2500,**tolerance)
        if info or np.linalg.norm(mat@x-rhs[:,j])>4e-7*np.linalg.norm(rhs[:,j]):
            raise RuntimeError('potential solve did not converge')
        sol.append(x)
    result=rhs.T@np.stack(sol,axis=1)
    return (result+result.T)/2
