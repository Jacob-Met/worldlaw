"""Verify parallel-coil KCL and document the free-excitation magnitude ambiguity."""
import json
from types import SimpleNamespace
import numpy as np
from switch_model import positive_coils


def run():
    rng=np.random.default_rng(1327);nrow=20;freq=np.geomspace(80,8250,25);om=2j*np.pi*np.tile(freq,(nrow,1))
    aa=np.tile([0,1],10);bb=aa+1;c=SimpleNamespace(omega=om,a=aa,b=bb)
    R=np.array([.75,1,1.45]);tau=np.array([.00055,.00032,.00073]);cap=np.array([5e-7,8e-7,1e-6])
    gain=np.array([.86,1,1.12]);GL=.018;CL=3.4e-6;YL=GL+om*CL
    h1,h2=positive_coils(c,np.log([R[0],R[2],*tau,*cap,GL,CL,gain[0],gain[2]]))
    def yv(i):return 1/(R[i,None]*(1+om*tau[i,None]))+om*cap[i,None]
    y1,y2=yv(aa),yv(bb)
    # Source equivalent Norton currents represented here via open-circuit voltages.
    e1=rng.standard_normal(om.shape)+1j*rng.standard_normal(om.shape)
    e2=rng.standard_normal(om.shape)+1j*rng.standard_normal(om.shape)
    v1=e1*y1/(y1+YL)/gain[aa,None];v2=e2*y2/(y2+YL)/gain[bb,None]
    direct=(e1*y1+e2*y2)/(y1+y2+YL);model=h1*v1+h2*v2;err=float(np.max(abs(model-direct)));assert err<1e-12
    # A free nonnegative independent-pluck mode envelope is enough for any
    # nonzero predicted modal magnitude to reproduce the observed magnitude.
    alt=np.abs(v1+v2);assert np.all(alt>0);factor=abs(direct)/alt
    err2=float(np.max(abs(alt*factor-abs(direct))));assert err2<1e-12
    return {'complex_KCL_cells':model.size,'maximum_complex_discrepancy':err,'free_positive_excitation_equivalence_cells':model.size,'maximum_magnitude_discrepancy':err2,
            'scope':'Dimensionless synthetic demonstration, identical matched loading, no measured component calibration.'}


if __name__=='__main__':print(json.dumps(run(),sort_keys=True))
