"""Projected triangle-union area and a fixed multistart search on unoriented directions."""
import math

import numpy as np
import shapely


def frame(normal):
    n=np.asarray(normal,dtype=float)
    n=n/np.linalg.norm(n)
    seed=np.eye(3)[np.argmin(np.abs(n))]
    x=np.cross(n,seed);x/=np.linalg.norm(x)
    return np.stack([x,np.cross(n,x)],axis=1)


def projective_directions(n):
    i=np.arange(n)
    z=(i+0.5)/n
    phi=i*np.pi*(3-np.sqrt(5))
    r=np.sqrt(1-z*z)
    return np.column_stack((r*np.cos(phi),r*np.sin(phi),z))


def union_area(tri,n,precision=2**-32):
    xy=tri@frame(n)
    # A visible point of a closed solid has at least one outward-facing front
    # triangle. Keeping both faces works for all silhouette degeneracies.
    tri_area=(xy[:,1,0]-xy[:,0,0])*(xy[:,2,1]-xy[:,0,1])-(xy[:,1,1]-xy[:,0,1])*(xy[:,2,0]-xy[:,0,0])
    polys=shapely.polygons(xy[np.abs(tri_area)>1e-14])
    return float(shapely.area(shapely.union_all(polys,grid_size=precision)))


def widest_silhouette(tri,base_count=96):
    directions=np.vstack((np.eye(3),projective_directions(base_count)))
    areas=np.array([union_area(tri,n) for n in directions])
    first_best=float(areas.max())
    # Retain separated modes to permit plateaus and disjoint local optima.
    starts=[]
    for i in np.argsort(areas)[::-1]:
        n=directions[i]
        if all(abs(n@m)<math.cos(math.radians(14)) for _,m in starts):
            starts.append((areas[i],n))
        if len(starts)==4:break
    modes=[]
    for area,n in starts:
        for step in (9,4,1.5,0.5):
            basis=frame(n)
            theta=np.arange(6)*np.pi/3
            directions=np.cos(np.deg2rad(step))*n+np.sin(np.deg2rad(step))*(np.column_stack((np.cos(theta),np.sin(theta)))@basis.T)
            vals=np.array([union_area(tri,u) for u in directions])
            j=int(np.argmax(vals))
            if vals[j]>area:area,n=float(vals[j]),directions[j]
        modes.append((area,n.tolist()))
    modes.sort(key=lambda pair:-pair[0])
    # Equal-weight the distinct retained near-maxima, rather than picking one
    # with knowledge of the observed fall. The search is numerically finite.
    keep=[]
    for area,vec in modes:
        n=np.array(vec)
        if area>=0.9995*modes[0][0] and all(abs(n@m)<math.cos(np.deg2rad(2)) for m in keep):
            keep.append(n)
    angles=np.rad2deg(np.arccos(np.clip(np.abs(keep),0,1))).mean(axis=0)
    checks=[]
    for area,n in modes:
        coarse=union_area(tri,n,2**-26)
        checks.append(abs(coarse-area)/area)
    return {'initial_best':first_best,'modes':modes,'angles_min_mid_max':angles.tolist(),
            'max_precision_check_relative':max(checks),'grid_sizes':[2**-32,2**-26]}
