"""Independent image-source receiver of the three archived pressure forecasts."""
import argparse
import hashlib
import json
import math
import pathlib
import zipfile
from fractions import Fraction

import numpy as np
from scipy.integrate import quad
from scipy.special import erfc

WELLS = ("W2_2z_D09", "W2_2z_U01", "W2_2z_U07")
DS = [7.5, 10.5, 13.5]


def direct_unit(r, d, D, ratio):
    # Integrate the infinite-space 3-D anisotropic point-source step response
    # over both finite screens. Even image pairs implement both reflecting faces.
    t = np.arange(1, 933)
    x, weights = np.polynomial.legendre.leggauss(6)
    x, weights = x/2, weights/2
    nmax = math.ceil(1 + 9*math.sqrt(D*ratio*932)/9)
    n = 18*np.arange(-nmax,nmax+1)
    target = np.zeros(933)
    for i, s in enumerate(9.5-6+x):
        for j, z in enumerate(d-6+x):
            heights = np.concatenate((z-s-n,z+s-n))
            dist = np.sqrt(r*r+heights**2/ratio)
            target[1:] += weights[i]*weights[j]*(9/np.sqrt(ratio))*np.sum(
                erfc(dist[:,None]/(2*np.sqrt(D*t))) / dist[:,None],axis=0)
    return target


def direct_theis(r, D):
    vals = [0.]
    for t in range(1, 933):
        u = r*r/(4*D*t)
        vals.append(quad(lambda q: math.exp(-q)/q,u,np.inf,epsabs=3e-12,epsrel=3e-11)[0])
    return np.array(vals)


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('source',type=pathlib.Path);ap.add_argument('report',type=pathlib.Path)
    ap.add_argument('forecasts',type=pathlib.Path);ap.add_argument('out',type=pathlib.Path)
    a=ap.parse_args();o=json.loads(a.report.read_text())
    assert hashlib.sha256(a.source.read_bytes()).hexdigest()==o['archive_sha256']
    assert o['archive_sha256']=='ab7d202b630667c53f868c4fa20c43c8847af46f180ce6757beb2839b1a1d034'
    all_r=[];ds=[];raw={}
    with zipfile.ZipFile(a.source) as z:
        names=z.namelist();coords={}
        for line in z.read(next(n for n in names if n.endswith('/CoordinateData.txt'))).decode().splitlines()[1:]:
            tok=line.split()
            if tok:coords[tok[0]]=tuple(float(v) for v in tok[1:3])
        for w in WELLS:
            all_r.append(math.dist(coords['NMR04'],coords[w]))
            arr=[]
            for j in range(3):
                n=next(n for n in names if w+'_S1_R'+str(j+1)+'_' in n)
                rows=[line.split() for line in z.read(n).decode().splitlines()]
                assert [Fraction(i[0]) for i in rows]==list(range(933))
                ds_frac=[Fraction(i[1]) for i in rows];arr.append(ds_frac)
                raw[n]=hashlib.sha256(z.read(n)).hexdigest()
            ds.append(arr)
        pumpname=next(n for n in names if '/NMR4_NMR4_S1_' in n)
        pump=dict((int(float(t)),float(v)) for t,v in (line.split() for line in z.read(pumpname).decode().splitlines()))
    controls=[]
    for i,cl in enumerate(ds):
        widths=[max(x)-min(x) for x in zip(*cl)]
        at=widths.index(max(widths))
        controls.append(dict(well=WELLS[i],worst_second=at,minimax_halfspread_mm=str(500*widths[at]),
                             pressure_at_three_screen_centres_mm=[str(1000*x[at]) for x in cl],
                             perfect_depthblind_MSE_mm2=str(sum(sum((v-sum(row)/3)**2 for v in row)
                                for row in zip(*cl))*1000000/(3*933))))
    observed=np.asarray(ds,dtype=float);a.out.mkdir(parents=True,exist_ok=True)
    outputs={'raw_sha256':raw,'source_hash':o['archive_sha256'],'independent_exact_depth_floor':controls,
             'method':'independent 3-D erfc image superposition and double six-point Gauss-Legendre screen integral; scalar adaptive improper quadrature for 2-D Theis','comparisons':{}}
    pred=np.load(a.forecasts)
    assert np.array_equal(observed,pred['observed_m'])
    for name,coeffs in o['primary']['fits'].items():
        summary=[]
        for i,m in enumerate(coeffs):
            reconstructed=np.zeros((3,933))
            for j,d in enumerate(DS):
                unit=direct_unit(all_r[i],d,m['D_m2_s'],m['vertical_horizontal_ratio']) if name=='finite_screen' else direct_theis(all_r[i],m['D_m2_s'])
                recon=unit.copy();recon[332:]-=unit[:-332]
                reconstructed[j]=recon*m['gain_m']
            delta=reconstructed-pred[name][i];err=reconstructed-observed[i]
            max_entry=np.unravel_index(np.argmax(abs(err)),err.shape)
            summary.append(dict(well=WELLS[i],worst_difference_to_archived_prediction_mm=float(1000*np.max(abs(delta))),
                           independent_rmse_mm=float(1000*np.sqrt(np.mean(err**2))),
                           pointwise_maximum=dict(depth=DS[max_entry[0]],second=int(max_entry[1]),signed_error_mm=1000*float(err[max_entry])),
                           stock_rmse_mm=o['primary']['fits'][name][i]['full_rmse_mm']))
        outputs['comparisons'][name]=summary
    outputs['local_rebound']={'pump_m_at_332':pump[332],'pump_m_at_334':pump[334],'pump_m_at_340':pump[340],
                             'U07_m_at_332':observed[2,:,332].tolist(),'U07_m_at_334':observed[2,:,334].tolist(),
                             'U07_m_at_340':observed[2,:,340].tolist()}
    # Exact internal ambiguity of a special passive hydraulic network under the
    # same external input. Unit heat capacity/plug volumes on distinguishable paths.
    net=[]
    for g in [(Fraction(1),Fraction(2)),(Fraction(2),Fraction(1))]:
        fr=[v/sum(g) for v in g];net.append(dict(conductance=list(map(str,g)),total=str(sum(g)),
                      upper_fraction=str(fr[0]),unit_volume_upper_breakthrough=str(1/fr[0])))
    assert net[0]['total']==net[1]['total'] and net[0]['upper_fraction']!=net[1]['upper_fraction']
    outputs['counterfactual_control']=net
    maxdiff=max(x['worst_difference_to_archived_prediction_mm'] for method in outputs['comparisons'].values() for x in method)
    outputs['max_disagreement_mm']=maxdiff
    # One-micrometre numerical agreement criterion, independent of instrument certification.
    outputs['match_1_micrometre']=maxdiff<=.001
    path=a.out/'independent-pressure-receipt.json';path.write_text(json.dumps(outputs,indent=2)+'\n')
    print('INDEPENDENT',json.dumps(outputs),flush=True)
    print('COMPLETE',hashlib.sha256(path.read_bytes()).hexdigest(),path,flush=True)
    if not outputs['match_1_micrometre']:raise SystemExit(2)
if __name__=='__main__':main()
