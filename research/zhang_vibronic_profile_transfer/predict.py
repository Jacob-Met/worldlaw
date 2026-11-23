"""Freeze anti-Stokes predictions from lower temperatures and held red-only inputs."""
import hashlib
import math
from pathlib import Path
import sys
from source import SPEC,acquisition,emit_json,load_host,shift

C2=1.438776877
EPS=.02
def positive(v):
    return max(v,0.)+EPS

def slope(xs,ys):
    xbar=sum(xs)/len(xs)
    ybar=sum(ys)/len(ys)
    return sum((x-xbar)*(y-ybar) for x,y in zip(xs,ys))/sum((x-xbar)**2 for x in xs)

def forecast_host(h,archive):
    grid,recs=load_host(archive,h)
    train=[r for r in recs if not r['held']]
    donor=train[-1]
    fit=train[-4:]
    u0=1e7/h['lambda0_nm']
    result=[]
    for r in recs[-5:]:
        assert r['held'] and 'blue' not in r
        tau=1/r['T']-1/donor['T']
        data={name:[] for name in SPEC['roles']}
        for k,d in enumerate(grid):
            i=min(range(len(h['as'])),key=lambda j:abs(h['as'][j]-d))
            E=h['s'][i]
            b=donor['blue'][k]
            rat=positive(r['red'][k])/positive(donor['red'][k])
            therm=math.exp(-C2*E*tau)
            det=math.exp(-C2*d*tau)
            xs=[1/z['T'] for z in fit]
            lny=[math.log(positive(z['blue'][k])) for z in fit]
            lns=[math.log(positive(z['red'][k])) for z in fit]
            optical=((u0+d)/(u0-shift(d,h)))**3*r['red'][k]
            nums=[positive(b)*rat*therm-EPS,b,positive(b)*therm-EPS,positive(b)*rat-EPS,
                  positive(b)*rat*det-EPS,positive(b)*math.exp(slope(xs,lny)*tau)-EPS,
                  positive(b)*rat*math.exp(slope(xs,[a-bb for a,bb in zip(lny,lns)])*tau)-EPS,
                  optical*math.exp(-C2*E/r['T']),optical*math.exp(-C2*d/r['T']),0.]
            assert all(math.isfinite(v) for v in nums)
            for name,v in zip(SPEC['roles'],nums):data[name].append(v)
        result.append({'T':r['T'],'forecasts':data,'scale':r['scale'],'red_digest':hashlib.sha256(emit_json(r['red']).encode()).hexdigest()})
    return {'detunings':grid,'targets':result,'training_temperatures':[v['T'] for v in train]}

def main():
    with acquisition() as archive:
        results={name:forecast_host(h,archive) for name,h in SPEC['hosts'].items()}
    path=Path(sys.argv[1])
    data=(emit_json(results)+'\n').encode()
    with path.open('xb') as f:f.write(data)
    print(emit_json({'path':str(path.resolve()),'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'series':sum(len(s['targets'])*len(SPEC['roles']) for s in results.values()),'blue_held_numerical_reads':0,'temperatures':{k:[a['T'] for a in v['targets']] for k,v in results.items()}}),flush=True)
if __name__=='__main__':main()
