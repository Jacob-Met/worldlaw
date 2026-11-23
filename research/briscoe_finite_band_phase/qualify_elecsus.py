"""Check dense half-sum and crossed-analyzer projections against ElecSus 3.0.8, no data."""
import pathlib,subprocess,sys,os,time,hashlib,json
import numpy as np
from scipy.signal import hilbert
pin="1933456b905739fb31c89665cdc6733e769e5ec0"
p=pathlib.Path("official-elecsus").resolve();p.mkdir()
def git(*args):return subprocess.check_output(["git",*args],cwd=p)
git("init","-q");git("fetch","--depth=1","-q","https://github.com/durham-qlm/ElecSus.git",pin);git("checkout","--detach","-q","FETCH_HEAD");assert git("rev-parse","HEAD").decode().strip()==pin
sys.path.insert(0,str(p/"elecsus"/"libs"));import spectra as spec
import AtomConstants as ac
wave=ac.RbD2Transition.wavevectorMagnitude
X=np.linspace(-35000,35000,1401)
par={"Elem":"Rb","Dline":"D2","Bfield":6000.,"T":75.,"rb85frac":1.8,"lcell":.002,"Btheta":0.,"Bphi":0.}
start=time.monotonic()
C=np.array(spec.calc_chi(X,par));N=np.sqrt(1+C[:2])
E=np.exp(1j*wave*.002*(N-1))
amps=abs(E)**2;cross=abs(E[0]-E[1])**2/4
L=np.array([1,1j,0])/np.sqrt(2);R=L.conj();H=np.array([1.,0.,0.])
z=[]
for e in [L,R,H]:
    s,f=spec.get_spectra(X,e,par,outputs=["S0","E_out"])
    z.append((np.real(np.asarray(s).ravel()),np.asarray(f)))
e1=min(max(abs(z[0][0]-amps[0])),max(abs(z[0][0]-amps[1])))
e2=min(max(abs(z[1][0]-amps[0])),max(abs(z[1][0]-amps[1])))
eh=max(abs(z[2][0]-amps.mean(0)))
ef=max(abs(abs(z[2][1][1])**2-cross))
# For a Lorentzian causal pole the finite-period transform approaches the
# expected phase of the complex field. Establish the sign before any scans.
x=np.linspace(-250,250,32768,endpoint=False);chi=-.012/(x+1j);band=abs(x)<3
phase=.5*chi.real;rec=.5*hilbert(-chi.imag).imag
signerr=float(max(abs(phase[band]-rec[band])));wrong=float(max(abs(phase[band]+rec[band])))
out={"source":pin,"spectra_blob":git("rev-parse","HEAD:elecsus/libs/spectra.py").decode().strip(),"grid":len(X),"seconds":time.monotonic()-start,"L_input_which_calc_chi":int(np.argmin([max(abs(z[0][0]-a)) for a in amps])),"R_input_which_calc_chi":int(np.argmin([max(abs(z[1][0]-a)) for a in amps])),"max_errors":[e1,e2,eh,ef],"lorentz_sign_max":signerr,"reversed_sign_max":wrong,"scientific_scans":0}
print(json.dumps(out,sort_keys=True),flush=True)
assert max(e1,e2,eh,ef)<1e-8 and signerr<1e-5 and wrong>100*signerr
