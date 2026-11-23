"""Recount signed voltages with standard-library Decimal quadrature and an independent NPY reader."""
import argparse
import ast
import csv
from decimal import Decimal as D, getcontext
import hashlib
import json
from pathlib import Path
import struct
import zipfile

getcontext().prec=40
ARCHIVE='7be44ab317b7666be7cd88b5b33e0cb606f2fc9250e723b31f7b88815f87cfb5'
SCORES='cb0d2d2ae2761342b78ebe6d8c551f082a9608aecec294338477a8019be30993'
RANGES=[(i,min(999,i+10)) for i in range(0,999,10)]
HELD=range(37,42)

def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def array(member):
    if member[:8]!=b'\x93NUMPY\x01\x00':raise ValueError('NPY format version')
    n=struct.unpack_from('<H',member,8)[0]
    h=ast.literal_eval(member[10:10+n].decode('ascii').strip())
    if h!={'descr':'<f8','fortran_order':False,'shape':(100,24)}:raise ValueError('dtype or shape')
    return struct.unpack('<2400d',member[10+n:])

def physical(root,i,source):
    n=source[str(i)]
    if root is None:
        missing={tuple(x) for x in n['missing_reference_coordinates_zero_based']}
        return [None if (w,k) in missing else D(str(x)) for w,row in enumerate(n['all_integrals_volt_seconds']) for k,x in enumerate(row)]
    f=root/(f'{i:02d}-terminal.csv')
    if digest(f)!=n['raw_sha256']:raise ValueError('physical source substitution')
    with f.open() as s:
        r=csv.DictReader(s);rows=[]
        for index,raw in enumerate(r):
            if D(raw['Time'])!=D(index)/100:raise ValueError('nonuniform voltage clock')
            rows.append([D(raw[f'Vol_{k}']) for k in range(1,25)])
    if len(rows)!=1000:raise ValueError('raw acquisition length')
    out=[]
    for a,b in RANGES:
        for k in range(24):
            v=[rows[j][k] for j in range(a,b+1)]
            out.append((v[0]+2*sum(v[1:-1])+v[-1])/200 if all(x.is_finite() for x in v) else None)
    return out

def recount(study,raw_dir):
    npz=study/'open-motion-forecasts.npz';score=study/'held-score.json'
    if digest(npz)!=ARCHIVE or digest(score)!=SCORES:raise ValueError('archived inputs')
    s=json.loads(score.read_bytes());roles=list(s['mean_RMS_V']);truth=s['physical']
    expected={f'{i}-{r}.npy' for i in HELD for r in roles}
    means={r:[] for r in roles};max_diff=D(0);checks=0;residuals=0;measurements=0
    def agree(a,b):
        nonlocal checks,max_diff
        dif=abs(a-D(str(b)));checks+=1;max_diff=max(max_diff,dif)
        if dif>D('5e-13'):raise ValueError(f'physical score difference {dif}')
    with zipfile.ZipFile(npz) as z:
        if set(z.namelist())!=expected or len(z.namelist())!=45:raise ValueError('archive members')
        for i in HELD:
            target=physical(raw_dir,i,truth);reference=physical(None,i,truth)
            for q,x in zip(target,reference):
                if (q is None)!=(x is None):raise ValueError('finite measurement mask')
                if q is not None:
                    agree(q,x);measurements+=1
            for role in roles:
                forecast=array(z.read(f'{i}-{role}.npy'));errors=[]
                for ind,(x,y) in enumerate(zip(forecast,target)):
                    if y is None:continue
                    a,b=RANGES[ind//24]
                    errors.append((abs((D.from_float(x)-y)*100/(b-a)),ind))
                residuals+=len(errors)
                rms=(sum(e*e for e,_ in errors)/len(errors)).sqrt();means[role].append(rms)
                mae=sum(e for e,_ in errors)/len(errors);peak,ind=max(errors,key=lambda z:z[0])
                original=s['per_run'][str(i)][role]
                agree(rms,original['rms_V']);agree(mae,original['mae_V']);agree(peak,original['worst_abs_V'])
                if ind//24!=original['window'] or ind%24+1!=original['coil']:raise ValueError('worst raw index')
    m={k:sum(v)/5 for k,v in means.items()}
    for k in m:agree(m[k],s['mean_RMS_V'][k])
    alternatives=set(roles)-{'shared-flux','nominal-load'}
    strict=all(m[r]<m[a] for r in ('shared-flux','nominal-load') for a in alternatives)
    wins={k:sum(x<y for x,y in zip(means['shared-flux'],means[k])) for k in ('shared-path','load-blind')}
    missing_counts=[len(t['missing_reference_coordinates_zero_based']) for t in truth.values()]
    # Native completeness requires each coil observed and >=95% per session.
    eligible=all(n<=120 for n in missing_counts)
    for v in truth.values():
        missing=v['missing_reference_coordinates_zero_based']
        eligible &= all(sum(1 for w,c in missing if c==k)<100 for k in range(24))
    gate=eligible and strict and min(wins.values())>=4
    if gate!=s['accepted'] or wins!=s['five_run_wins']:raise ValueError('gate disagreement')
    return dict(physical_source='five original voltage CSVs' if raw_dir is not None else 'archived signed integrals and explicit missing mask',
                measured_cells=measurements,finite_residuals=residuals,total_forecasts=108000,recount_checks=checks,
                max_absolute_difference=str(max_diff),wins=wins,all_means_pass=strict,gate=gate)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('directory',nargs='?',type=Path,default=Path(__file__).resolve().parent)
    p.add_argument('--raw-dir',type=Path);a=p.parse_args();print(json.dumps(recount(a.directory,a.raw_dir),indent=2,sort_keys=True))
