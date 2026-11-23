"""Real-fluid reference check for the 2018 slide's downstream-storage factor."""
import ctypes
import hashlib
import io
import json
import math
from pathlib import Path
import platform
import sys
import tempfile
from urllib.request import urlopen
import zipfile

wheel='coolprop-7.2.0-cp312-cp312-manylinux2014_x86_64.manylinux_2_17_x86_64.whl'
pin='e88ef42e81b42e42fdd3bd5b8dc541c729e16cf104f08f7a7a8ed354f65fa418'
assert sys.version_info[:2]==(3,12) and platform.machine()=='x86_64'
with urlopen('https://pypi.org/pypi/CoolProp/7.2.0/json',timeout=25) as r:
    release=json.load(r)
rows=[f for f in release['urls'] if f['filename']==wheel]
assert len(rows)==1 and rows[0]['digests']['sha256']==pin and rows[0]['size']<8000000
with urlopen(rows[0]['url'],timeout=35) as r:
    payload=r.read(rows[0]['size']+1)
assert len(payload)==rows[0]['size'] and hashlib.sha256(payload).hexdigest()==pin
print(json.dumps({'version':'7.2.0','wheel':wheel,'sha256':pin,'bytes':len(payload),'gas_reference':'HEOS, already published reference code','rock_outcome_rows_opened':0}),flush=True)
with tempfile.TemporaryDirectory(prefix='rasscal-gas-property-only-') as td:
    dest=Path(td)
    with zipfile.ZipFile(io.BytesIO(payload)) as z:
        members=[f for f in z.infolist() if not f.is_dir()]
        assert sum(x.file_size for x in members)<80000000
        for m in members:
            if any(part in ('','..','.') for part in Path(m.filename).parts) or Path(m.filename).is_absolute():
                raise ValueError('unsafe wheel path')
            z.extract(m,dest)
    libs=list((dest/'CoolProp').glob('CoolProp.cpython-312-*.so'))
    assert len(libs)==1
    binary=ctypes.CDLL(str(libs[0]))
    props=None
    for symbol in ('PropsSI','_Z7PropsSIPKcS0_dS0_dS0_'):
        try:
            props=getattr(binary,symbol)
            break
        except AttributeError:
            pass
    if props is None:raise RuntimeError('official PropsSI symbol unavailable')
    props.argtypes=[ctypes.c_char_p,ctypes.c_char_p,ctypes.c_double,ctypes.c_char_p,ctypes.c_double,ctypes.c_char_p]
    props.restype=ctypes.c_double
    print(json.dumps({'api_symbol':symbol,'native_binary_member':str(libs[0].relative_to(dest)),'native_binary_sha256':hashlib.sha256(libs[0].read_bytes()).hexdigest()}),flush=True)
    for gas in ('Helium','Methane'):
        fluid=('HEOS::'+gas).encode()
        def prop(key,p):
            value=props(key.encode(),b'T',300.0,b'P',p,fluid)
            assert math.isfinite(value) and 0<value<1e15,(key,p,value)
            return value
        for mpa in (1,5,10,20):
            p=mpa*1e6;rho=prop('Dmass',p);cp=prop('Cpmass',p);cv=prop('Cvmass',p);sound=prop('A',p)
            kappa=(cp/cv)/(rho*sound**2); analytic=prop('isothermal_compressibility',p)
            finite=[(prop('Dmass',p+h)-prop('Dmass',p-h))/(2*h*rho) for h in (100000,50000)]
            assert abs(analytic/kappa-1)<1e-8
            error=[abs(k/kappa-1) for k in finite]
            data={'gas':gas,'temperature_K':300,'pressure_MPa':mpa,'density_kg_m3':rho,'cp_J_kg_K':cp,'cv_J_kg_K':cv,'sound_m_s':sound,'viscosity_Pa_s':prop('viscosity',p),'Z':prop('Z',p),'isothermal_compressibility_Pa_inv':analytic,'storage_Pkappa':p*kappa,'exact_mass_balance_over_2018_slide_pressure_slope':1/(p*kappa),'central_difference_relative_error_0p1_then_0p05_MPa':error}
            print(json.dumps(data,sort_keys=True),flush=True)
            assert error[-1]<2e-4,(gas,mpa,error)
print(json.dumps({'qualified_reference_states':8,'original_2019_REFPROP_version_known':False,'RaSSCAL_rows_read':0,'common_gas_history_or_volume_established':False}),flush=True)
