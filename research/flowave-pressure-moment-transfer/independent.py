"""Independent scalar Fourier and full fixed-denominator recount of a locked bank."""
import argparse
import cmath
import hashlib
import json
import math
from pathlib import Path
import zipfile

GROUPS = {'E':11, 'F':11, 'G':9}
ARMS = ('joint_four_ray','joint_two_ray','joint_one_ray','joint_still_water','joint_small_aperture',
        'surface_two_ray','joint_four_ray_damped','force_ridge','gauges_force_ridge','matched_donor','joint_flexible','zero')
SETTINGS=('primary','second_block','double_rate')
FRACTIONS=(6,8,10,11,13,14,16,18,19,21,22)
SOU='7275a2c6c580bde15b8f1ed0ab89aea3d52da436c43580fa08608b01cc457e3f'


def digest(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f,'sha256').hexdigest()


def unpack(value):
    return [complex(*pair) for pair in value]


def moments(archive,name,setting):
    group=name[2]
    cycles=13 if group=='G' else FRACTIONS[int(name[3:])-1]
    rate=512 if (name,setting)==('ETG0001','double_rate') else 256
    offset=112 if (name,setting)==('ETG0001','second_block') else 32
    size=32*rate
    series=[]
    with archive.open('DataShareET/FP/'+name+'.txt') as f:
        for line in f:
            cells=line.split()
            if len(cells)!=6:continue
            try:
                x,y=float(cells[3]),float(cells[4])
            except ValueError:continue
            series.append((x,y))
    selected=series[offset*rate:(offset+32)*rate]
    if len(selected)!=size:raise ValueError('short record')
    # Independently compute both scalar dot products using compensated sums.
    result=[]
    for col in (0,1):
        z=[2*row[col]*cmath.exp(-2j*math.pi*cycles*(offset*rate+k)/size)/size
           for k,row in enumerate(selected)]
        result.append(complex(math.fsum(a.real for a in z),math.fsum(a.imag for a in z)))
    return result


def validate(raw,forecast,outcome):
    names=[f'ET{g}{i:04d}' for g,n in GROUPS.items() for i in range(1,n+1)]
    if names!=forecast['test'] or set(outcome['settings'])!=set(SETTINGS):raise ValueError('roster')
    ec=0; comparisons=0; largest=0.; witnesses={}; counts={}
    def compare(a,b):
        nonlocal comparisons,largest
        diff=abs(a-b);largest=max(diff,largest);comparisons+=1
        if diff>1e-9*max(1,abs(a),abs(b)):raise ValueError(('numerical recount differs',a,b))
    with zipfile.ZipFile(raw) as archive:
        for setting in SETTINGS:
            data=outcome['settings'][setting]; pred=forecast['settings'][setting]['forecasts']
            if set(pred)!=set(ARMS) or set(data['metrics'])!=set(ARMS):raise ValueError('arm roster')
            truth=[moments(archive,n,setting) for n in names]
            for exact,stored in zip(truth,outcome['truth'][setting],strict=True):
                for z,q in zip(exact,unpack(stored),strict=True):compare(z,q)
            metrics={}
            for arm in ARMS:
                err=[]
                for i,target in enumerate(truth):
                    point=unpack(pred[arm][i])
                    value=math.sqrt(math.fsum(abs(q-z)**2 for q,z in zip(point,target,strict=True)))
                    err.append(value);compare(value,data['errors'][arm][i]);ec+=1
                metrics[arm]={}
                for group in ('all','E','F','G'):
                    values=[v for v,n in zip(err,names) if group=='all' or n[2]==group]
                    for suffix,v in (('mean',math.fsum(values)/len(values)),('worst',max(values))):
                        key=group+'_'+suffix;metrics[arm][key]=v;compare(v,data['metrics'][arm][key])
                if arm==ARMS[0]:
                    i=max(range(len(err)),key=err.__getitem__)
                    if names[i]!=data['worst']['id']:raise ValueError('wrong worst')
                    witnesses[setting]={'id':names[i],'moment_nm':[[v.real,v.imag] for v in truth[i]],
                        'prediction_nm':pred[arm][i],'vector_error_nm':err[i]}
            gates={k:all(v<metrics[a][k] for a in ARMS[1:]) for k,v in metrics[ARMS[0]].items()}
            if gates!=data['gates']:raise ValueError('gate disagreement')
            counts[setting]=sum(gates.values())
    if (counts['primary']==8)!=outcome['joint_primary']:raise ValueError('joint disagreement')
    return dict(condition_errors=ec,numeric_comparisons=comparisons,largest_absolute_difference=largest,
                gates_of_eight=counts,raw_worst=witnesses)


if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('raw',type=Path);p.add_argument('forecast',type=Path);p.add_argument('score',type=Path)
    p.add_argument('forecast_sha256');p.add_argument('score_sha256')
    args=p.parse_args()
    for path,sha in ((args.raw,SOU),(args.forecast,args.forecast_sha256),(args.score,args.score_sha256)):
        if digest(path)!=sha:raise ValueError('whole input differs')
    print(json.dumps(validate(args.raw,json.loads(args.forecast.read_bytes()),json.loads(args.score.read_bytes())),
                     sort_keys=True,allow_nan=False))
