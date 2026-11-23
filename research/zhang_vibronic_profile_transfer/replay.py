"""Offline audit of every published score, using the stored measured blue brackets."""
import hashlib
import json
import math
from pathlib import Path

root=Path(__file__).resolve().parent
def read(name):return json.loads((root/name).read_text())
def h(name):return hashlib.sha256((root/name).read_bytes()).hexdigest()
assert h('forecasts.json')=='3c8be4fa779779221fbb2d6d4ef997a5ca36679320294f139693cb41d9628839'
assert h('result.json')=='fdf6a8c5ca82c1453be4ecfa01aec96a461c2066885819a6fd2f402b6f7ad784'
p,r,s=read('forecasts.json'),read('result.json'),read('protocol.json')
roles=s['roles'];c=roles[0];wins=0;cells=0;overall={};worst=(-1,)
for host,profiles in r['profiles'].items():
    assert len(profiles)==len(p[host]['targets'])==5
    avg={role:[[],[]] for role in roles}
    for y,fc in zip(profiles,p[host]['targets']):
        assert fc['T']==y['T'] and fc['scale']==y['scale']
        measured=[]
        for b,(l,rr,xl,xr,yl,yr,x) in zip(y['observed'],y['native_brackets']):
            yy=(yl+(yr-yl)*(x-xl)/(xr-xl))/y['scale']
            assert yy==b
            measured.append(yy)
        for role in roles:
            vals=fc['forecasts'][role];assert len(measured)==len(vals)==len(p[host]['detunings'])
            errs=[abs(yy-v) for yy,v in zip(measured,vals)]
            stats=[sum(errs)/len(errs),math.sqrt(sum(e*e for e in errs)/len(errs))]
            assert stats==y['metrics'][role]
            for k in (0,1):avg[role][k].append(stats[k])
            cells+=len(errs)
            if role==c:
                for j,e in enumerate(errs):
                    if e>worst[0]:worst=(e,host,fc['T'],p[host]['detunings'][j])
        wins+=int(y['metrics'][c][0]<y['metrics']['fit_blue_red_slope'][0])
    overall[host]={role:[sum(series)/5 for series in avg[role]] for role in roles}
assert overall==r['host_means']
macro={role:[sum(v[role][k] for v in overall.values())/len(overall) for k in (0,1)] for role in roles}
assert macro==r['macro']
gate=all(macro[c][k]<macro[role][k] for role in roles[1:] for k in (0,1)) and all(av[c][k]<av[role][k] for av in overall.values() for role in ('blue_persistence','fit_blue_red_slope') for k in (0,1)) and wins>=7
assert wins==r['wins'] and gate==r['gate']
w=r['worst'];assert worst==(w['abs_error'],w['host'],w['T'],w['detuning'])
print(json.dumps({'cells':cells,'held_profiles':10,'gate':gate,'wins':wins,'worst':worst}))
