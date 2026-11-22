"""Compare simple prospective spectral controls only on odd-position source mixed takes."""
import hashlib
import json
from pathlib import Path
import sys
import numpy as np
from mode_features import PITCH


L=np.array([649,650,652,651,652,650.])
D=np.array([[157,99,38],[158,100,41],[160,102,45],[159,101,46],[160,102,49],[158,100,49]])
K=np.arange(1.,26.)
PAIRS=((0,1),(1,2))


def db(x):
    x=abs(np.asarray(x))
    return 20*np.log10(np.maximum(x/np.maximum(x.max(axis=-1,keepdims=True),1e-20),.001))


def ideal(s,j,pair,pickupwidth=0.,pickwidth=0.):
    # Published equations 3, 4 and 12. The overall per-take scale cancels.
    length=L[s];a,b=PAIRS[pair];q=30+20*j
    pluck=np.sin(np.pi*K*q/length)*np.sinc(K*pickwidth/(2*length))/K
    sensors=np.sin(np.pi*K*D[s,a]/length)+np.sin(np.pi*K*D[s,b]/length)
    return abs(pluck*sensors*np.sinc(K*pickupwidth/(2*length)))


def run(d):
    X=np.load(d/'singles.npy');Y=np.load(d/'training-mixed.npy');meta=json.loads((d/'metadata.json').read_bytes())
    assert X.shape==(6,8,3,25) and Y.shape==(6,4,2,25)
    rows=[]
    for s in range(6):
        for pos in range(4):
            j=2*pos
            for pair,(a,b) in enumerate(PAIRS):
                z1,z2=X[s,j, [a,b]];actual=db(Y[s,pos,pair]);phase=np.angle(z1*np.conj(z2))
                methods={'eq4_point':ideal(s,j,pair),'eq12_nominal_15mm':ideal(s,j,pair,15.,.88),
                         'coherent':abs(z1+z2),'rss':np.hypot(abs(z1),abs(z2)),'abs_sum':abs(z1)+abs(z2),
                         'opposite':abs(z1-z2),'single_left':abs(z1),'single_right':abs(z2),
                         'source_geometric_mean':np.exp(np.mean(np.log(np.maximum(Y[s,np.arange(4)!=pos,pair],1e-16)),axis=0))}
                row={'string':s+1,'position_mm':30+20*j,'pair':pair+4,'loss':{}}
                for name,x in methods.items():
                    e=db(x)-actual;row['loss'][name]=float(np.mean(e**2)**.5)
                e=db(methods['coherent'])-actual;k=int(np.argmax(abs(e)));m=meta[f'{s+1}/{j+1}/singles'];m2=meta[f'{s+1}/{j+1}/{pair+4}']
                row['worst_harmonic']={'mode':k+1,'coherent_dB':db(methods['coherent'])[k],'measure_dB':actual[k],'ideal_db':db(methods['eq4_point'])[k],
                'relative_single_phase_deg':float(np.rad2deg(phase[k])),'single_complex':[ [float(z.real),float(z.imag)] for z in (z1[k],z2[k])],
                'f0_single_Hz':m['f0_Hz'],'f0_mixed_Hz':m2['f0_Hz'],'onset_single_sample':m['onset_sample'],'onset_mixed_sample':m2['onset_sample']}
                rows.append(row)
    names=list(rows[0]['loss'])
    avg={k:np.mean([r['loss'][k] for r in rows]) for k in names}
    print(json.dumps({'source_mixed_takes':len(rows),'held_mixed_reads':0,'mean_trial_RMSE_dB':avg,'all':rows,
       'bwf_single_clocks_nonzero':sum(m['bwf_time_reference'][0]!=0 for k,m in meta.items() if k.endswith('/singles')),
       'f0_paired_training_delta_Hz':sorted(abs(meta[f'{s}/{j}/singles']['f0_Hz']-meta[f'{s}/{j}/{p}']['f0_Hz']) for s in range(1,7) for j in (1,3,5,7) for p in (4,5))},sort_keys=True))


if __name__=='__main__':
    run(Path(sys.argv[1]))
