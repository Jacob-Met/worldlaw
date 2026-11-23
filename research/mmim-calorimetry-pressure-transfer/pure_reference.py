import hashlib,json,platform,sys,subprocess,tempfile,pathlib
from urllib.request import urlopen
p=pathlib.Path(tempfile.mkdtemp(prefix='p2-salt-eos-reference-'));print('WORK',p,flush=True)
metadata=json.load(urlopen('https://pypi.org/pypi/CoolProp/7.2.0/json',timeout=30))
tag='cp'+str(sys.version_info.major)+str(sys.version_info.minor);files=[f for f in metadata['urls'] if (tag+'-'+tag+'-') in f['filename'] and 'manylinux' in f['filename'] and 'x86_64' in f['filename']]
print('WHEEL_METADATA',platform.machine(),tag,[(f['filename'],f['size'],f['digests']['sha256']) for f in files],flush=True)
assert len(files)==1 and platform.machine()=='x86_64'
f=files[0];raw=urlopen(f['url'],timeout=60).read();assert len(raw)==f['size'] and hashlib.sha256(raw).hexdigest()==f['digests']['sha256']
wheel=p/f['filename'];wheel.write_bytes(raw)
# Extract only this verified numerical wheel in the fresh per-job tree.
import zipfile
with zipfile.ZipFile(wheel) as z:
 for n in z.namelist():
  rel=pathlib.PurePosixPath(n)
  if rel.is_absolute() or '..' in rel.parts:raise ValueError('wheel path')
 z.extractall(p/'site')
sys.path.insert(0,str(p/'site'))
import CoolProp as cp
from CoolProp.CoolProp import PropsSI,AbstractState
out={}
for solvent,temps in {"Water":[298.15,303.15,313.15,323.15,329.35,334.85,339.4,342.75,345.85,348.65,350.95,353.15,355.05,356.9,352.65,355.75,359.45,361.95,364.65,366.6,369.65,371.95,359.7,365.15,376.15,380.15,384.15,387.65,389.15,393.15,395.15,383.65,387.15,392.65,398.15,401.65,405.15,408.75,410.65,408.15,410.75,414.15,419.15,421.65,423.25,428.75,429.75,330.756,339.86,347.585,356.167,363.087,368.733,374.86,379.411,328.936,338.65,346.576,352.987,359.121,364.782,370.206,374.804,329.215,338.913,346.99,353.535,359.06,364.383,369.074,373.03],"Ethanol":[298.15,303.15,313.15,323.15,330.05,331.95,333.85,335.5,337.05,338.45,339.75,341.15,342.45,343.45,329,331.15,333.45,336.45,338.55,340.1,342.1,344.2,346.05,347.75,338.15,340.95,343.8,346.95,349.4,351.4,353.5,355.35,357.5,359.1,352.95,355.95,358.45,360.95,363.4,365.7,367.3,369.2,370.8,372.3,374.25,378.25,380.4,381.65,383.15,385,386.55,388.15,389.4,391.3],"Methanol":[298.15,303.15,313.15,323.15,311.55,315.15,317,318.68,320.65,322.63,324.55,326.4,329.55,330.5,329,331.6,333.4,335.05,336.7,338.15,339.55,341,342.3,343.7,336.4,340.1,342.9,345.2,347.55,350.05,351.9,353.7,355.5,357.15,352.35,356.15,358.5,361.15,362.55,365.2,367,368.6,370.45,371.95,361.65,365.7,367.95,371.25,374.25,376.25,378.65,381.15,383.25,385.15]}.items():
 state=AbstractState('HEOS',solvent);v={}
 for T in sorted(temps):
  state.update(cp.QT_INPUTS,1.,T)
  P=state.p();phi=state.fugacity_coefficient(0);B=state.Bvirial();C=state.Cvirial()
  state.update(cp.QT_INPUTS,0.,T); volume=1/state.rhomolar()
  v[str(T)]={'pstar_pa':P,'phi_sat':phi,'v_liq_m3_mol':volume,'B_m3_mol':B,'C_m6_mol2':C}
  if T in (298.15,303.15,313.15,323.15):
   state.specify_phase(cp.iphase_liquid);state.update(cp.PT_INPUTS,101325.,T);v[str(T)]['cp_at_101325']=state.cpmolar();state.unspecify_phase()
 out[solvent]=v
obj={'version':cp.__version__,'revision':cp.__gitrevision__,'wheel':{'filename':f['filename'],'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()},'pure':out}
data=(json.dumps(obj,sort_keys=True,separators=(',',':'))+'\n').encode();(p/'pure.json').write_bytes(data)
print('PURE_EOS',len(data),hashlib.sha256(data).hexdigest(),flush=True);print(data.decode(),end='')
