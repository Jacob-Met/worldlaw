"""Verify immutable forecast and score records, optionally using the original ZIP."""
import hashlib
import json
import math
import pathlib
import statistics
import sys

from independent import verify

PINS=['a191eb58d0ec89c9b6342d674b3dc5ccde1285acdaf125e2778f384de0f02f68','4f95a20d29cd94e5f45ad304b2460b06a368d7e78f3db574a43cd59e3a121f0f','20ed1eac55313c80fc8c9cd9eae56a3db449623d4505982f211474e768c24fdc']

def replay(root, archive=None):
    forecasts=(root/'forecasts.json').read_bytes()
    score=(root/'score.json').read_bytes()
    for b,h in zip([forecasts,score],PINS[1:]):
        if hashlib.sha256(b).hexdigest()!=h: raise ValueError('byte custody')
    if archive is not None:
        return verify(archive.read_bytes(),forecasts,score,PINS)
    f=json.loads(forecasts);s=json.loads(score);n=0;max_delta=0.;runs={}
    for metal in ('Au','Ir','Pt'):
        for speed in (1225,2500):
            pred=f['metals'][metal]['predictions'][str(speed)]
            truth=s['sweeps'][metal+str(speed)];y=truth['observed']
            assert len(pred)==10 and len(y)==len(truth['voltage'])
            for role,v in pred.items():
                assert len(v)==len(y)
                err=[a-b for a,b in zip(v,y)];rmse=math.sqrt(statistics.fmean(x*x for x in err))
                max_delta=max(max_delta,abs(rmse-truth['rmse'][role]),abs(statistics.fmean(map(abs,err))-truth['mae'][role]))
                runs.setdefault(role,[]).append(rmse)
            n+=len(y)
    for role,rm in runs.items():
        max_delta=max(max_delta,abs(statistics.fmean(rm)-s['mean_rmse'][role]))
    assert max_delta<1e-14 and n==6498 and s['passed'] is False
    return dict(held_rows=n,predictions=10*n,max_metric_error=max_delta,passed=s['passed'])

if __name__=='__main__':
    print(json.dumps(replay(pathlib.Path(sys.argv[1]),pathlib.Path(sys.argv[2]) if len(sys.argv)>2 else None),sort_keys=True))
