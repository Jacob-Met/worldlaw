"""Watzl et al. (2024) equations 5–10 with the published numerical Rayleigh–Lamb chart."""
from pathlib import Path
import numpy as np
from scipy.io import loadmat
from scipy.optimize import brentq
from author_pattern import inventory,read_numeric
from hashlib import sha256
import json

import os
ROOT=Path(os.environ['WATZL_DATA'])
PHOTO_PITCH=0.00019918843482715618
chart=ROOT/'Rayleigh-Lamb-equations_numerical_solution.mat'
assert sha256(chart.read_bytes()).hexdigest()=='691806f2ae9a33ac9bba2d247d4fbabcac1bcf64df1e8024c5e85ae5462b78e7'
S=loadmat(chart,variable_names=['nuVec','fS1S2','fS3S6','fCL1'],squeeze_me=True)
NU=S['nuVec'];A=S['fS1S2'];B=S['fS3S6'];L=S['fCL1']
VALID=np.isfinite(A)&np.isfinite(B)&np.isfinite(L)&(A>0)&(B>0)&(L>0)
RATIO=np.full_like(NU,np.nan);RATIO[VALID]=B[VALID]/A[VALID]

def roots(ratio):
    candidates=[]
    for i in range(len(NU)-1):
        if not (VALID[i] and VALID[i+1]):continue
        a,b=RATIO[i:i+2]
        if a==b:
            if ratio==a:raise ValueError('continuous ambiguity in chart')
            continue
        t=(ratio-a)/(b-a)
        if 0<=t<=1:
            v=NU[i]+t*(NU[i+1]-NU[i])
            if not candidates or abs(v-candidates[-1])>1e-13:candidates.append(float(v))
    return candidates

def speed_t(cR,nu,relation):
    if relation=='eq8':
        return float(cR*np.sqrt((0.5797*(1-nu)+nu)/(0.4395*(1-nu)+nu)))
    # Rayleigh surface-wave sextic with x=(cR/cT)^2, for an isotropic elastic halfspace.
    k=(1-2*nu)/(2*(1-nu))
    x=brentq(lambda x:x**3-8*x*x+(24-16*k)*x-16*(1-k),0.,1.)
    return float(cR/np.sqrt(x))

def invert(fR,f1,f2,relation='exact'):
    result=[]
    for nu in roots(f2/f1):
        cR=PHOTO_PITCH*fR
        ct=speed_t(cR,nu,relation)
        cl=ct*np.sqrt(2*(1-nu)/(1-2*nu))
        beta=np.interp(nu,NU[VALID],(A[VALID]/L[VALID]))
        result.append({'nu':nu,'cR':cR,'cT':ct,'cL':cl,'h':beta*cl/(2*f1)})
    return result

if __name__=='__main__':
    r=inventory()[14]
    for name,key in [('n_spots',20),('delta_px',5),('img_size_px',400)]:assert read_numeric(r[name])==key
    observed={k:read_numeric(r[k]) for k in ['f_SAW','f_S1S2','f_S3S6','nu','cR','cT','cL','h']}
    out={}
    for key in ['exact','eq8']:
        rows=[invert(*fs,relation=key) for fs in zip(*(observed[k] for k in ['f_SAW','f_S1S2','f_S3S6']))]
        errs={k:[] for k in ['nu','cR','cT','cL','h']}
        for i,row in enumerate(rows):
            if len(row)==1:
                for k in errs:errs[k].append(float(abs(row[0][k]/observed[k][i]-1)))
        out[key]={'counts_by_root_number':{j:sum(len(z)==j for z in rows) for j in range(3)},'worst_relative_errors':{k:max(v) if v else None for k,v in errs.items()},'all_relative_errors_unique_only':errs}
    report={'separate_flat_pattern_acquisition':14,'target_stepped_wave_samples':0,'caliper_values_accessed':0,'methods':out}
    Path('author-arithmetic-parity.json').write_text(json.dumps(report,indent=2)+'\n')
    print({k:(v['counts_by_root_number'],v['worst_relative_errors']) for k,v in out.items()})
