"""Fit only the registered 60% source prefix, with model selection confined to its final 30%."""
from pathlib import Path
import hashlib
import json
import sys
import numpy as np
from decoder import REFERENCES,fit,predict


def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()


def main(root,gas):
    view=np.load(root/f'training-view-{gas}.npz',allow_pickle=False)
    rc=np.load(root/f'oger-training-{gas}.npz',allow_pickle=False)
    raw=view['rows'];ids=view['indices']
    assert np.array_equal(ids,rc['ids'])
    k=int(np.searchsorted(ids,int(rc['dev_start'])))
    inner=fit(raw[:k],rc['fit_inner'])
    sensor=np.column_stack((raw[:,0],raw[:,3:]))
    predicted=predict(sensor,rc['state'],inner)
    y=raw[k:,2]
    metrics={key:float(np.sqrt(np.mean((arr[k:]-y)**2))) for key,arr in predicted.items()}
    ref=min(REFERENCES,key=metrics.get)
    i=k+int(np.argmax(abs(predicted[ref][k:]-y)))
    model=fit(raw,rc['fit_full'])
    out=root/f'frozen-model-{gas}.npz'
    with out.open('xb') as f:np.savez_compressed(f,**model)
    report={'source':gas,'n':len(raw),'fit_dev':k,'test_prediction':'not opened','development_RMSE_ppm':metrics,'chosen_reference':ref,
            'worst_reference':dict(native_index=int(ids[i]),t=float(raw[i,0]),co_setpoint=float(raw[i,1]),ethylene_setpoint=float(raw[i,2]),
              sensor_first4=raw[i,3:7].tolist(),pred={v:float(a[i]) for v,a in predicted.items()}),
            'nuisance_eth_direction_cosine':float(model['nuisance_direction']@model['ethylene_direction']),
            'nuisance_events':len(model['nuisance_events']),'ethylene_events':len(model['ethylene_events']),
            'full_model_sha256':sha(out),'fit_only_native_source':sha(root/f'oger-training-{gas}.npz')}
    path=root/f'development-{gas}.json';path.write_text(json.dumps(report,indent=2))
    print('DEVELOPMENT',json.dumps(report),sha(path),flush=True)


if __name__=='__main__':main(Path(sys.argv[1]),sys.argv[2])
