"""Independent long-wavelength tensor reconstruction and source-noise budget."""
import json
import math
from pathlib import Path


def dot(a,b):
    return sum(x*y for x,y in zip(a,b,strict=True))


def tensor(arms, name, ra, dec, gmst):
    ha=gmst-ra
    si,co=math.sin,math.cos
    n=[co(dec)*co(ha),-co(dec)*si(ha),si(dec)]
    u=[-si(ha),-co(ha),0.]
    v=[-co(ha)*si(dec),si(ha)*si(dec),co(dec)]
    def vector(which):
        return [arms["LAL_"+name+"_"+which+"_"+axis+("_SI" if which=="VERTEX_LOCATION" else "")] for axis in "XYZ"]
    x,y=vector("ARM_X_DIRECTION"),vector("ARM_Y_DIRECTION")
    plus=(dot(x,u)**2-dot(x,v)**2-dot(y,u)**2+dot(y,v)**2)/2
    cross=dot(x,u)*dot(x,v)-dot(y,u)*dot(y,v)
    return plus,cross,-dot(vector("VERTEX_LOCATION"),n)/299792458.


def reconstruct(protocol, sources):
    geo=protocol["geometry"]
    rows={}
    for code,name in (("H1","LHO_4K"),("L1","LLO_4K"),("V1","VIRGO")):
        r=tensor(sources["detector_source"]["geometry"][name],name,*geo["RA_DEC"],geo["gmst_rad"])
        ref=geo["detectors"][code]
        assert max(abs(r[0]-ref["plus"]),abs(r[1]-ref["cross"]))<3e-8
        assert abs(r[2]-ref["arrival_s"])<1e-12
        rows[code]=r
    h,l,v=rows["H1"][:2],rows["L1"][:2],rows["V1"][:2]
    det=l[0]*v[1]-v[0]*l[1]
    w=((h[0]*v[1]-v[0]*h[1])/det,(l[0]*h[1]-h[0]*l[1])/det)
    assert max(abs(a-b) for a,b in zip(w,geo["weights"]))<1e-6
    return dict(rows=rows,determinant=det,weights=w,equal_uncorrelated_source_noise_rms=math.hypot(*w),
                V_minus_L_delay_s=rows["V1"][2]-rows["L1"][2])


if __name__=="__main__":
    root=Path(__file__).parent
    print(json.dumps(reconstruct(json.loads((root/"protocol.json").read_text()),
                                 json.loads((root/"source-metadata.json").read_text())),sort_keys=True))
