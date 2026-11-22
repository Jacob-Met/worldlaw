"""Mesh-only orientation predictions in the author's min/mid/max inertia coordinates."""
import numpy as np

from mesh_geometry import geometry
from potential_flow import added_mass,grid,voxel_solid
from projected_union import widest_silhouette


def clean_solid(tri):
    twice_area=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)
    keep=twice_area>0
    return tri[keep],int(np.sum(~keep))


def angles_from_spectrum(values,vectors):
    # The largest-eigenvalue eigenspace determines the direction. For weak
    # separation, average angle over a uniform line/direction within that space.
    top=values>=values[-1]*(1-0.015)
    count=int(sum(top))
    if count==1:
        dirs=vectors[:,-1,None].T
    elif count==2:
        t=2*np.pi*(np.arange(4096)+0.5)/4096
        dirs=np.column_stack((np.cos(t),np.sin(t)))@vectors[:,top].T
    else:
        # The acute angle between a fixed axis and an isotropic line averages
        # one radian. This is not the angle of the mean direction.
        return np.full(3,np.rad2deg(1.0)),count
    return np.rad2deg(np.arccos(np.clip(np.abs(dirs),0,1))).mean(axis=0),count


def predict(name,tri,resolutions=(24,40),with_silhouette=True):
    tri,removed=clean_solid(tri)
    g=geometry(tri)
    if g['bad_edges'] or g['zero_area']:
        raise ValueError((name,'boundary after zero-area removal',g['bad_edges'],g['zero_area']))
    frame_tri=g['triangles']@g['axes']
    length=2*np.max(np.abs(frame_tri))
    out={'name':name,'removed_zero_area':removed,'inertia_ratios':g['ratios'].tolist(),
         'area':g['area'],'volume_native':g['volume'],'fingerprint':g['radial_fingerprint'],
         'faces':len(tri),'grid':[]}
    for res in resolutions:
        e=grid(length,res)
        solid=voxel_solid(frame_tri,e)
        h=np.diff(e)
        v=float(np.einsum('ijk,i,j,k->',solid,h,h,h))
        if not .65<v<1.35:raise ValueError((name,'voxel volume',res,v))
        matrix=added_mass(solid,e)
        val,vec=np.linalg.eigh(matrix)
        if val[0]<=0:raise ValueError((name,'nonpositive added mass'))
        angles,rank=angles_from_spectrum(val,vec)
        out['grid'].append({'resolution':res,'voxel_volume':v,'mass_tensor':matrix.tolist(),
                            'spectrum':val.tolist(),'top_rank':rank,'angles':angles.tolist()})
    if with_silhouette:
        out['silhouette']=widest_silhouette(frame_tri)
    return out
