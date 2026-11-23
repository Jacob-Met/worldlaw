"""Finite-aperture conditional predictions for the FloWave wave-current intervention."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

import numpy as np

SOURCE = '7275a2c6c580bde15b8f1ed0ab89aea3d52da436c43580fa08608b01cc457e3f'
FREQUENCIES = np.array([6,8,10,11,13,14,16,18,19,21,22]) / 32
GAUGES = np.array([[.909,0],[.727,0],[.273,0],[0,0],[-.091,0],
                   [.273,-.273],[.273,.273],[.273,1.377],[1.209,0]])
GROUPS = {'A':11,'B':11,'C':9,'D':12,'E':11,'F':11,'G':9}
ARMS = ('two_ray_aperture','one_ray_aperture','two_ray_still_water',
        'two_ray_small_aperture','force_ridge','gauges_force_ridge',
        'matched_donor','four_ray_aperture','two_ray_flexible','zero')
RIDGES = (1e-8,1e-6,1e-4,.01,.1,1.0)
GRAVITY, DEPTH, DENSITY = 9.81, 2.0, 1000.0


def digest(path):
    with Path(path).open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def encode(x):
    a = np.asarray(x)
    return np.stack((a.real,a.imag),axis=-1).tolist()


def decode(x):
    a = np.array(x)
    return a[...,0] + 1j*a[...,1]


def conditions():
    for group,n in GROUPS.items():
        for i in range(n):
            name = f'ET{group}{i+1:04}'
            if group in 'CG':
                yield name, 13/32, -22.5*i, (.2 if group=='G' else 0)
            elif group == 'D':
                yield name, 13/32, 0., (0,.05,.45,.40,.35,.30,.25,.2,.2,.15,.1,0)[i]
            else:
                yield name, FREQUENCIES[i], (180. if group in 'BF' else 0.), (.2 if group in 'EF' else 0.)


def phasor(z,name,sensor,columns,rate,freq,start=32,scale=1):
    # Only named numeric fields are converted. Header/separator rows have no
    # numeric first token. The nominal common trigger supplies time zero.
    rows = []
    seen = 0
    with z.open(f'DataShareET/{sensor}/{name}.txt') as stream:
        for line in stream:
            fields = line.split()
            if not fields or fields[0][:1] not in b'+-.0123456789':
                continue
            if start*rate <= seen < (start+32)*rate:
                rows.append([float(fields[i]) for i in columns])
            seen += 1
    if len(rows)!=32*rate:
        raise ValueError((name,sensor,rate,start,'incomplete window',len(rows)))
    a = np.array(rows)*scale
    if not np.isfinite(a).all():
        raise ValueError((name,sensor,'nonfinite projected window'))
    t = np.arange(start*rate,(start+32)*rate)/rate
    return 2*(np.exp(-2j*np.pi*freq*t) @ a)/len(t)


def wave_number(omega,along):
    def dispersion(k):
        return np.sqrt(GRAVITY*k*np.tanh(k*DEPTH))+along*k-omega
    lo = 0.
    for hi in np.geomspace(.00001,100,512):
        if dispersion(hi)>=0:
            break
        lo = hi
    else:
        raise ValueError('no positive gravity-branch root')
    for _ in range(60):
        mid = (lo+hi)/2
        if dispersion(mid)<0:
            lo=mid
        else:
            hi=mid
    return (hi+lo)/2


def dsinc(t):
    if abs(t)<1e-4:
        return -t/3+t**3/30
    return (t*np.cos(t)-np.sin(t))/t**2


def footprint(k, small):
    angle=np.deg2rad(22.5)
    axes=np.array([[np.cos(angle),np.sin(angle)],[-np.sin(angle),np.cos(angle)]])
    sides=np.array([.508,.464])
    x=(axes@k)*sides/2
    if small:
        return axes.T@(-sides*x/6)*np.prod(sides)
    si=np.sinc(x/np.pi)
    return axes.T@(sides/2*np.array([dsinc(x[0])*si[1],dsinc(x[1])*si[0]]))*np.prod(sides)


def pressure(w, freq, theta, current, arm):
    angles=[theta]
    if arm!='one_ray_aperture':
        angles.append(theta+180)
    if arm=='four_ray_aperture':
        angles += [theta+90,theta-90]
    if arm=='two_ray_still_water':
        current=0.
    k=[]
    for a in np.deg2rad(angles):
        direction=np.array([np.cos(a),np.sin(a)])
        k.append(wave_number(2*np.pi*freq,current*direction[0])*direction)
    k=np.array(k)
    design=np.exp(-1j*(GAUGES@k.T))
    # Singular values explicit; refusal applies to the complete course.
    cond=float(np.linalg.cond(design))
    if not np.isfinite(cond) or cond>1e5:
        raise ValueError((arm,'source direction design ill-conditioned',cond))
    amp=np.linalg.lstsq(design,w,rcond=1e-12)[0]
    moments=np.zeros(2,complex)
    for ray,a in zip(k,amp):
        grad=footprint(ray,arm=='two_ray_small_aperture')
        pressure_pa=-DENSITY*GRAVITY*a/np.cosh(np.linalg.norm(ray)*DEPTH)
        moments += 1j*pressure_pa*np.array([grad[1],-grad[0]])
    return moments,cond,float(np.linalg.norm(design@amp-w))


def ridge(x,y,z,lam):
    scales=np.maximum(np.sqrt(np.mean(abs(x)**2,axis=0)),1e-12)
    a=x/scales
    coeff=np.linalg.solve(a.conj().T@a+len(a)*lam*np.eye(a.shape[1]),a.conj().T@y)
    return (z/scales)@coeff


def calibrate(x,y,test):
    losses=[]
    for lam in RIDGES:
        errors=[]
        for i in range(len(x)):
            allowed=np.arange(len(x))!=i
            pred=ridge(x[allowed],y[allowed],x[i:i+1],lam)
            errors.append(np.linalg.norm(pred-y[i:i+1]))
        losses.append(float(np.mean(errors)))
    best=int(np.argmin(losses))
    return ridge(x,y,test,RIDGES[best]),{'lambda':RIDGES[best],'loo_mean_error':losses}


def read_panel(z,rows,setting):
    f=[];w=[]
    for name,freq,theta,u in rows:
        rate,offset=(256,32)
        if name=='ETG0001' and setting=='second_block': offset=112
        if name=='ETG0001' and setting=='double_rate': rate=512
        f.append(phasor(z,name,'FP',[0,1,2],rate,freq,offset))
        w.append(phasor(z,name,'WG',range(9),128,freq,scale=.001))
    return np.array(f),np.array(w)


def forecast(z):
    rows=[r for r in conditions() if r[0][2] in 'ABCEFG']
    train=[r for r in rows if r[0][2] in 'ABC']
    test=[r for r in rows if r[0][2] in 'EFG']
    f0,w0=read_panel(z,train,'primary')
    y=np.array([phasor(z,n,'FP',[3,4],256,f) for n,f,*_ in train])
    controls={}
    for n,f,*_ in conditions():
        if n[2]=='D':
            controls[n]=encode(phasor(z,n,'FP',[0,1,2,3,4],256,f))
    out={'train':[r[0] for r in train],'test':[r[0] for r in test],
         'y_train':encode(y),'current_only_off_drive_at_13_over_32':controls,'settings':{}}
    for setting in ('primary','second_block','double_rate'):
        ft,wt=read_panel(z,test,setting)
        f=np.vstack((f0,ft));w=np.vstack((w0,wt))
        forecasts={}; fits={}; diagnostics={}
        for arm in ARMS:
            if arm=='two_ray_flexible':
                drops=np.array([pressure(g,*r[1:],'two_ray_aperture')[0] for g,r in zip(w,train+test)])
                x=np.column_stack((f,drops))
                pred,fits[arm]=calibrate(x[:len(train)],y,x[len(train):])
            elif 'ray' in arm:
                p=[pressure(g,*r[1:],arm) for g,r in zip(w,train+test)]
                base=np.asarray([v[0] for v in p])
                diagnostics[arm]=[[v[1],v[2]] for v in p]
                corr,fits[arm]=calibrate(f0,y-base[:len(train)],ft)
                pred=base[len(train):]+corr
            elif arm=='zero':
                pred=np.zeros((len(test),2),complex)
            elif arm=='matched_donor':
                # A/B/C and E/F/G share the same complete 31-condition order.
                # Compare the complex force ratio of each vertical phasor;
                # a fixed fraction of mean training power fixes the near-zero floor.
                denom=abs(f0[:,2])**2+1e-4*np.mean(abs(f0[:,2])**2)
                pred=y*(ft[:,2]*f0[:,2].conj()/denom)[:,None]
            else:
                x=f if arm=='force_ridge' else np.column_stack((f,w))
                pred,fits[arm]=calibrate(x[:len(train)],y,x[len(train):])
            forecasts[arm]=encode(pred)
        out['settings'][setting]={'forecasts':forecasts,'fits':fits,'ray_design':diagnostics,
                                  'forces':encode(ft),'gauges':encode(wt)}
    return out


def score(z,bank):
    truth={}; report={}
    for setting,reg in bank['settings'].items():
        y=[]
        for n,f,*_ in conditions():
            if n[2] not in 'EFG':continue
            rate=512 if setting=='double_rate' and n=='ETG0001' else 256
            offset=112 if setting=='second_block' and n=='ETG0001' else 32
            y.append(phasor(z,n,'FP',[3,4],rate,f,offset))
        y=np.asarray(y);truth[setting]=encode(y)
        err={};sums={}
        for arm,serialized in reg['forecasts'].items():
            pred=decode(serialized);e=np.linalg.norm(pred-y,axis=1);err[arm]=e.tolist()
            sums[arm]={'all_mean':float(np.mean(e)),'all_worst':float(np.max(e))}
            for g in 'EFG':
                mask=np.array([n[2]==g for n in bank['test']])
                sums[arm][g+'_mean']=float(np.mean(e[mask]))
                sums[arm][g+'_worst']=float(np.max(e[mask]))
        primary=sums[ARMS[0]]
        gates={metric:all(primary[metric]<sums[a][metric] for a in ARMS[1:]) for metric in primary}
        i=int(np.argmax(err[ARMS[0]]));report[setting]={'metrics':sums,'errors':err,'gates':gates,
                'worst':{'id':bank['test'][i],'truth':encode(y[i]),'prediction':reg['forecasts'][ARMS[0]][i],
                         'forces':reg['forces'][i],'gauges':reg['gauges'][i],'vector_nm':err[ARMS[0]][i]}}
    return {'settings':report,'truth':truth,'joint_primary':all(report['primary']['gates'].values())}


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('mode',choices=['forecast','score'])
    parser.add_argument('source',type=Path)
    parser.add_argument('out',type=Path)
    parser.add_argument('--bank',type=Path)
    parser.add_argument('--bank-sha256')
    args=parser.parse_args()
    if digest(args.source)!=SOURCE:raise ValueError('publisher source differs')
    with zipfile.ZipFile(args.source) as archive:
        if args.mode=='forecast':
            result=forecast(archive)
        else:
            if not args.bank or digest(args.bank)!=args.bank_sha256:raise ValueError('frozen bank differs')
            result=score(archive,json.loads(args.bank.read_text()))
    with args.out.open('x') as target:
        json.dump(result,target,sort_keys=True,separators=(',',':'),allow_nan=False)
        target.write('\n')
    print(args.mode,args.out,args.out.stat().st_size,digest(args.out),flush=True)
