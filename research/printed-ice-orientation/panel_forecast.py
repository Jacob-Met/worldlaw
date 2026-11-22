"""Shape-only successor using physical surface panels on the unbounded domain."""
import numpy as np

from exterior_panels import panel_added_mass,subdivide
from mesh_forecast import clean_solid,angles_from_spectrum
from mesh_geometry import geometry
from quantized_union import widest_silhouette


def forecast(name,tri):
    tri,removed=clean_solid(tri)
    g=geometry(tri)
    if g['bad_edges'] or g['zero_area']:raise ValueError(('surface topology',name))
    frame_tri=g['triangles']@g['axes']
    extent=np.ptp(frame_tri.reshape(-1,3),axis=0)
    result={'name':name,'removed_zero_area':removed,'inertia_ratios':g['ratios'].tolist(),'area':g['area'],
            'area_volume_units':'volume normalized to one','principal_extents':extent.tolist(),
            'fingerprint':g['radial_fingerprint'],'panel_outputs':[]}
    for level,t in enumerate((frame_tri,subdivide(frame_tri))):
        matrix,checks=panel_added_mass(t)
        val,vec=np.linalg.eigh(matrix)
        if val[0]<=0:raise ValueError(('nonpositive added mass',name,level,val.tolist()))
        theta,rank=angles_from_spectrum(val,vec)
        result['panel_outputs'].append({'level':level,**checks,'mass_tensor':matrix.tolist(),
                    'spectrum':val.tolist(),'top_rank':rank,'angles':theta.tolist()})
    result['silhouette']=widest_silhouette(frame_tri)
    return result
