"""Reproduce the fixed training, locked development predictions and registered gates."""
import argparse
import csv
import hashlib
import io
import json
import math
import os
import pathlib
import sys
import tempfile
os.environ.update(OPENBLAS_NUM_THREADS='1', OMP_NUM_THREADS='1', MKL_NUM_THREADS='1')
import numpy as np
from source import assignments, load_cases, member
from scoring import compare
from controls import bundle, saturation

def sha(data):return hashlib.sha256(data).hexdigest()

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('archive',type=pathlib.Path)
    ap.add_argument('pdi',type=pathlib.Path,help='the unmodified author-distributed pdi.py')
    ap.add_argument('output',type=pathlib.Path)
    a=ap.parse_args()
    assert sha(a.archive.read_bytes())=='8aa1630dbad70c135f5940ac16b545b805ee2bc7b5f56ed9ca2f5ab64141e68e'
    assert a.pdi.name=='pdi.py' and sha(a.pdi.read_bytes())=='bb2aafa09567f01552ce7bec612684ce2ac400a3f803c3d40ee21887df159074'
    sys.path.insert(0,str(a.pdi.resolve().parent))
    import capillary_transport as model
    a.output.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        tmp=pathlib.Path(tmp);mt=member(a.archive,'MetaData.csv',tmp).decode('utf-8-sig')
        dialect=csv.Sniffer().sniff(mt[:6000],delimiters=';,\t')
        training,development=assignments(list(csv.DictReader(io.StringIO(mt),dialect=dialect)))
        tr=model.assemble(load_cases(a.archive,tmp,training,'training'));m=model.train(tr)
        assert bundle()==('1/5','4/5')
        lim=np.max(np.abs(np.asarray([saturation(x) for x in tr['fits']])),axis=0)
        assert lim[3]<1e-6 and lim[-1]<lim[3]
        raw=load_cases(a.archive,tmp,development,'forecast')
        dev=model.assemble(raw);yp=model.predict(dev,m)
        assert np.max(abs(model.correction(np.zeros(14),dev)-dev['pdi']))<1e-6
        assert np.isfinite(np.concatenate(list(yp.values()))).all()
        lock=[]
        for i,r in enumerate(raw):
            lock.append({'id':r['id'],'site':r['site'],'pF':r['pF'],'ksat':r['ksat'],'predicted_log10':{k:v[dev['index']==i].tolist() for k,v in yp.items()}})
        output=a.output/'forecasts.json';locked=json.dumps(lock,sort_keys=True,separators=(',',':'),allow_nan=False).encode()
        output.write_bytes(locked);expected=sha(locked);del locked,lock
        cold=output.read_bytes();assert sha(cold)==expected;locked=json.loads(cold)
        labels=load_cases(a.archive,tmp,development,'score')
        report=compare(locked,labels)
        reference=json.loads(pathlib.Path(__file__).with_name('observed.json').read_text())
        for scope in report['means']:
            for k,v in report['means'][scope].items():
                assert math.isclose(v,reference['means'][scope][k],rel_tol=2e-5,abs_tol=1e-7),(scope,k,v)
                assert math.isclose(report['q90'][scope][k],reference['q90'][scope][k],rel_tol=2e-5,abs_tol=1e-7),(scope,k,'q90')
        for key in ('wins','rows','cores','supported','gates','best'):assert report[key]==reference[key],key
        assert report['worst']['weighted_capillary']['id']==reference['worst']['weighted_capillary']['id']
        report['local_forecast_sha256']=expected
        (a.output/'scores.json').write_text(json.dumps(report,sort_keys=True,indent=2))
        print(json.dumps({k:report[k] for k in ('rows','cores','supported','wins','gates','best','local_forecast_sha256')},sort_keys=True))

if __name__=='__main__':main()
