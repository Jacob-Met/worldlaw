"""Offline replay of all 3,648 locked predictions and their scored coordinates."""
import base64, hashlib, json, math, struct, zlib
from pathlib import Path
def read(name,expected):
    path=Path(__file__).with_name(name)
    data=zlib.decompress(base64.b85decode(path.read_bytes().strip()))
    assert hashlib.sha256(data).hexdigest()==expected
    return json.loads(data)
def main():
    p=read('held-forecasts.b85.txt','85553b37821788217503851ea1c71ad373f6056451c94e6d00b77a9e5e17d19c')
    o=read('held-results.b85.txt','e8c9808c64395a537f1090a9cdc790b764646b259a997f516a8b5737fc514f39')
    names=list(o['mean_rms']);assert set(p['forecasts'])==set(o['movies']) and len(o['movies'])==24 and len(names)==8
    scores={k:[] for k in names}
    for s,d in o['movies'].items():
        for k in names:
            y=d['target_log_quantiles'];v=p['forecasts'][s][k]
            assert len(v)==len(y)==19 and hashlib.sha256(struct.pack('<19d',*v)).hexdigest()==p['float64_sha256'][s][k]
            er=math.sqrt(math.fsum((i-j)**2 for i,j in zip(v,y))/19)
            assert abs(er-d['rms'][k])<1e-14;scores[k].append(er)
    means={k:math.fsum(a)/24 for k,a in scores.items()}
    assert all(abs(means[k]-o['mean_rms'][k])<1e-14 for k in names)
    wins={k:sum(x<y for x,y in zip(scores['common_support'],a)) for k,a in scores.items()}
    gate=all(means['common_support']<means[k] for k in names if k!='common_support') and min(wins['affine'],wins['multifeature'])>=13
    assert o['wins']==wins and gate==o['pass']==False
    print('24 held movie pairs, 192 binary forecast arrays, 3648 coordinates verified; common-support primary failed.')
if __name__=='__main__':main()
