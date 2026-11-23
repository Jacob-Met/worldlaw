"""Recompute the authentic IAST equal-spreading-pressure and total-loading identities by quadrature."""
import json,sys
from pathlib import Path
import numpy as np
from scipy.integrate import quad
from envelopes import AUTH,IdealMixture
def check(src,fore):
    temps=[333,303,273];max_equal=max_total=0.;qmax=0.;raw=None
    group_bands={}
    training=src['pure'];binary=src['binary']
    pure_rmse=[]
    for T in temps:
        fit=IdealMixture(AUTH,T)
        lists=[[],[],[]];worst_train=[]
        for r in training:
            if r['T']!=T:continue
            p=np.zeros(3);i=r['i'];p[i]=r['P']*r['y'];val=fit(p)[i]
            lists[i].append(abs(val-r['q'])+max(r['u'],.01))
            worst_train.append((abs(val-r['q']),i,r,val,'pure'))
            pure_rmse.append((i,val-r['q']))
        for r in binary:
            if r['T']!=T:continue
            pred=fit(np.array(r['y'])*r['P'])
            for i,q,u in zip(r['components'],r['q'],r['u']):
                lists[i].append(abs(pred[i]-q)+max(u,.01))
                worst_train.append((abs(pred[i]-q),i,r,float(pred[i]),'binary'))
        group_bands[T]={'author_band_halfwidth':[float(max(v)) for v in lists],'worst_calibration':max(worst_train,key=lambda x:x[0])}
    for row in fore['forecasts']:
        q=np.array(row['predictions'][1]);x=q/q.sum();r=row['row'];p=r['P']*np.array(r['y']);p0=p/x
        spreading=[];pure=[]
        for f,(cap,b0,dh,n) in zip(p0,AUTH):
            b=b0*np.exp(dh/(.00831446261815324*r['T']))
            def deriv(z):return cap*b/(1+(b*z)**n)**(1/n)
            spreading.append(quad(deriv,0,f,epsabs=8e-11,epsrel=8e-11,limit=240)[0])
            pure.append(f*deriv(f))
        err=(max(spreading)-min(spreading))/max(spreading)
        total=1/np.sum(x/np.array(pure))
        max_equal=max(max_equal,err);max_total=max(max_total,float(abs(q.sum()-total)))
    assert max_equal<2e-6 and max_total<2e-7,(max_equal,max_total)
    residual=np.array(pure_rmse)
    return {'all_27_pure_toth_iast_spreading_relative_error':float(max_equal),'max_total_loading_absolute_error':float(max_total),'calibration_bands':group_bands,'rounded_published_toth_pure_rmse':[float(np.sqrt(np.mean(residual[residual[:,0]==i,1]**2))) for i in range(3)]}
if __name__=='__main__':
    src=json.loads(Path(sys.argv[1]).read_text());fore=json.loads(Path('predictions.json').read_text())
    out=check(src,fore);Path('source-diagnostics.json').write_text(json.dumps(out,sort_keys=True))
    print('AUTHENTIC_IAST_QUADRATURE',json.dumps(out,sort_keys=True),flush=True)
