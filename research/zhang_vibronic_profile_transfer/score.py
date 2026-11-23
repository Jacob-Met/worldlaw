"""Receive the locked blue-branch predictions and score complete temperature profiles."""
import hashlib
import json
import math
from pathlib import Path
import sys
from source import SPEC,acquisition,emit_json,load_host

def main():
    forecast,expected,out=Path(sys.argv[1]),sys.argv[2],Path(sys.argv[3])
    encoded=forecast.read_bytes()
    assert hashlib.sha256(encoded).hexdigest()==expected
    pred=json.loads(encoded)
    roles=SPEC['roles']
    assert set(pred)==set(SPEC['hosts'])
    for name,h in SPEC['hosts'].items():
        grid=list(range(h['band'][0],h['band'][1]+1,5))
        rows=pred[name]['targets']
        assert pred[name]['detunings']==grid and len(rows)==5
        assert [r['T'] for r in rows]==[round(h['T_start']+i*h['T_step'],2) for i in range(h['n']-5,h['n'])]
        for r in rows:
            assert set(r['forecasts'])==set(roles)
            assert all(len(a)==len(grid) and all(math.isfinite(x) for x in a) for a in r['forecasts'].values())
    result={}
    avg={}
    worst=None
    cand=roles[0]
    winner=0
    with acquisition() as archive:
        for name,h in SPEC['hosts'].items():
            grid,observed=load_host(archive,h,receiving=True)
            result[name]=[]
            for rec,p in zip(observed[-5:],pred[name]['targets']):
                assert rec['T']==p['T'] and rec['scale']==p['scale']
                assert hashlib.sha256(emit_json(rec['red']).encode()).hexdigest()==p['red_digest']
                obs=rec['blue']; metrics={}
                for role in roles:
                    diff=[y-v for y,v in zip(obs,p['forecasts'][role])]
                    metrics[role]=[sum(map(abs,diff))/len(diff),math.sqrt(sum(d*d for d in diff)/len(diff))]
                winner+=int(metrics[cand][0]<metrics['fit_blue_red_slope'][0])
                k=max(range(len(grid)),key=lambda i:abs(obs[i]-p['forecasts'][cand][i]))
                error=abs(obs[k]-p['forecasts'][cand][k])
                if worst is None or error>worst['abs_error']:
                    worst={'abs_error':error,'host':name,'T':rec['T'],'detuning':grid[k],'observed':obs[k],'native_bracket':rec['raw_blue'][k],'scale':rec['scale'],'same_cell_predictions':{role:p['forecasts'][role][k] for role in roles}}
                result[name].append({'T':rec['T'],'observed':obs,'native_brackets':rec['raw_blue'],'scale':rec['scale'],'metrics':metrics})
            avg[name]={role:[sum(r['metrics'][role][k] for r in result[name])/5 for k in [0,1]] for role in roles}
    macro={role:[sum(v[role][k] for v in avg.values())/len(avg) for k in [0,1]] for role in roles}
    passed=(all(macro[cand][k]<macro[role][k] for role in roles[1:] for k in [0,1])
            and all(a[cand][k]<a[role][k] for a in avg.values() for role in ['blue_persistence','fit_blue_red_slope'] for k in [0,1]) and winner>=7)
    summary={'gate':passed,'wins':winner,'macro':macro,'host_means':avg,'worst':worst,'forecast_sha256':expected}
    b=(emit_json(dict(summary,profiles=result))+'\n').encode()
    with out.open('xb') as f:f.write(b)
    print(emit_json(dict(summary,path=str(out.resolve()),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())),flush=True)
if __name__=='__main__':main()
