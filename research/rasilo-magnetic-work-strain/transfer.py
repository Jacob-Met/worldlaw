"""Prospective interval-work transfer between source-averaged magnetic and strain curves."""
import argparse,hashlib,json
from pathlib import Path
import numpy as np
from scipy.integrate import cumulative_trapezoid
from scipy.interpolate import CubicSpline,PchipInterpolator,interp1d
from source import ANCHORS,HELD,STRESS,read
from fit_author import spline_predict

ARMS=('reciprocal_trapezoid','magnetic_natural','magnetic_pchip','anchor_linear','anchor_pchip',
      'anchor_natural','magnetic_anchored_residual','pooled_quadrature_ridge','author_derivative_spline')

def forecast(data):
    b=data['Bx']; h=data['Hx']; s=STRESS.astype(float); lam=data['lamxx']
    rel=(lam-lam[0])*1e6
    linear=interp1d(s[ANCHORS],rel,axis=1,fill_value='extrapolate')(s)
    seed=PchipInterpolator(s[ANCHORS],lam,axis=1)(s)
    pchip=(seed-seed[0])*1e6
    natural=CubicSpline(s[ANCHORS],rel,axis=1,bc_type='natural')(s)
    # H dB gives Pa; division by MPa gives the matching strain in microstrain.
    work=cumulative_trapezoid(h,b,axis=0,initial=0.)
    pair=-np.diff(work,axis=1)/np.diff(s)
    signs=(-1.)**np.arange(len(s))
    particular=np.zeros_like(work)
    for j in range(len(s)-1):
        particular[:,j+1]=2*pair[:,j]-particular[:,j]
    gauge=((rel-particular[:,ANCHORS])*signs[ANCHORS]).mean(axis=1)
    primary=particular+gauge[:,None]*signs
    dnat=-CubicSpline(s,work,axis=1,bc_type='natural')(s,1)
    dpc=-PchipInterpolator(s,work,axis=1)(s,1)
    anchored=dnat+PchipInterpolator(s[ANCHORS],rel-dnat[:,ANCHORS],axis=1)(s)
    # Same 16 rectangle observations, with anchor-curve interpolation as the
    # fixed prior. Penalize equally per observed interval and per nodal prior.
    M=(np.eye(17)[:-1]+np.eye(17)[1:])/2
    ridge=np.linalg.solve(M.T@M+np.eye(17),(pair@M+linear).T).T
    author,ad=spline_predict(b,s*1e6,h,lam,ANCHORS,seed)
    pred=dict(zip(ARMS,(primary,dnat,dpc,linear,pchip,natural,anchored,ridge,author)))
    for v in pred.values():
        if v.shape!=(100,17) or not np.isfinite(v).all():raise ValueError('invalid frozen forecast')
    return {'induction_T':b.tolist(),'stresses_MPa':s[HELD].tolist(),'reference_T':float(b[0]),
            'author_fit':ad,'interval_MPa':np.diff(s).tolist(),'magnetic_rectangle_averages_ppm':pair.tolist(),
            'calibrated_alternating_coefficient_ppm':gauge.tolist(),
            'forecasts_ppm':{a:v[:,HELD].T.tolist() for a,v in pred.items()}}

def metrics(delta,b):
    return np.sum((np.abs(delta[:,1:])+np.abs(delta[:,:-1]))/2*np.diff(b),axis=1)/(b[-1]-b[0])

def score(data,bank):
    b=data['Bx'];assert np.array_equal(b,bank['induction_T'])
    truth=((data['lamxx']-data['lamxx'][0])*1e6).T
    assert list(bank['forecasts_ppm'])==list(ARMS) and bank['stresses_MPa']==STRESS[HELD].tolist()
    curves={};worst={};summary={}
    for a in ARMS:
        f=np.array(bank['forecasts_ppm'][a]);delta=f-truth;w=metrics(delta,b);curves[a]=w.tolist()
        i,j=np.unravel_index(np.argmax(np.abs(delta)),delta.shape)
        worst[a]={'stress_MPa':int(STRESS[HELD[i]]),'index':int(j),'B_T':float(b[j]),
                  'predicted_ppm':float(f[i,j]),'truth_ppm':float(truth[i,j]),'signed_error_ppm':float(delta[i,j])}
        summary[a]={}
        for label,ix in [('all',np.ones(len(HELD),bool)),('inside',STRESS[HELD]<80),('outside',STRESS[HELD]>80)]:
            summary[a][label]={'mean':float(w[ix].mean()),'worst':float(w[ix].max())}
    gates={}
    for region in ('all','inside','outside'):
        for metric in ('mean','worst'):
            gates[region+'_'+metric]=all(summary[ARMS[0]][region][metric]<summary[a][region][metric] for a in ARMS[1:])
    return {'unit':'microstrain, relative to first stored induction','source_truth_ppm':truth.tolist(),
            'per_stress_MAE':curves,'summary':summary,'largest_components':worst,'gates':gates,'joint':all(gates.values())}
def write(path,j):
    raw=(json.dumps(j,separators=(',',':'),allow_nan=False)+'\n').encode()
    with path.open('xb') as f:f.write(raw)
    print(path.name,len(raw),hashlib.sha256(raw).hexdigest())
def main():
    p=argparse.ArgumentParser()
    p.add_argument('role',choices=['forecast','score']);p.add_argument('mat',type=Path);p.add_argument('out',type=Path)
    p.add_argument('--bank',type=Path);p.add_argument('--bank-sha');args=p.parse_args()
    if args.role=='forecast':write(args.out,forecast(read(args.mat,'forecast')))
    else:
        raw=args.bank.read_bytes()
        if hashlib.sha256(raw).hexdigest()!=args.bank_sha:raise ValueError('wrong frozen bank')
        v=score(read(args.mat,'score'),json.loads(raw));write(args.out,v)
        print(json.dumps({k:v[k] for k in ('summary','gates','joint','largest_components')}))
if __name__=='__main__':main()
