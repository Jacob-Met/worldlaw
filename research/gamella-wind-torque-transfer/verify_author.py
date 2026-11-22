"""Compare two actual middle-duty training pulses to the unmodified published simulator."""
import hashlib
import json
import sys
import types
from pathlib import Path
import numpy as np
import wind_transfer as w
import wt_models

# Preserve all source bytes. Set its package context so the released relative import resolves.
path=Path('author_simulator.py')
sim=types.ModuleType('authentic.wind_tunnel_simulators')
sim.__package__='authentic'
sys.modules['authentic']=types.ModuleType('authentic')
sys.modules['authentic.wind_tunnel_models']=wt_models
exec(compile(path.read_bytes(),str(path),'exec'),sim.__dict__)

def verify():
    u,y=w.panel('0.5')
    rows=[]
    for flag in [0,422]:
        t,i,o,h=u[flag].T
        p,wi,wo=sim.simulator_a2_c3(i,o,h,y[flag,0,1],w.INERTIA,w.tau,w.DRAG,
            t-t[0],wt_models.model_a1(i[0],.1,w.WMAX),wt_models.model_a1(o[0],.1,w.WMAX),
            74.82473949999999,w.WMAX,186.7/3600,.75,.15,0,.2,random_state=3)
        vi=w.speeds(i[None],t[None])[0]
        vo=w.speeds(o[None],t[None])[0]
        dp=w.component(vi,h)-w.component(vo,h)+y[flag,0,1]+np.random.default_rng(3).normal(0,.2,50)
        err=[float(np.max(np.abs((wo-vo)*w.RPM))),float(np.max(np.abs(p-dp)))]
        if max(err)>1.e-8:raise ValueError(f'authentic mismatch {err}')
        if not np.array_equal(p.astype('<f4'),dp.astype('<f4')):raise ValueError('stored pressure')
        rows.append({'flag':flag,'max_abs_rpm_pa':err,'stored_pressure_f32_equal':True})
    return {'simulator_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'training':rows}
if __name__=='__main__':print(json.dumps(verify(),indent=2))
