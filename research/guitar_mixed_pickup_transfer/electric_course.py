"""Generate and verify fixed separate-take spectral forecasts before collecting targets."""
import argparse
import hashlib
import io
import json
import zipfile
from pathlib import Path
import numpy as np
from mode_features import setup,decode,features as early_features
from stable_mode_features import features as stable_features
from switch_model import Cases,ROLES,fit_models,shape,training

METERS=('stable','early')
PRIMARY='shared_circuit'
KEYS=[(s,j,p) for s in range(1,7) for j in (2,4,6,8) for p in (4,5)]
HERE=Path(__file__).resolve().parent


def digest(b):
    return hashlib.sha256(b).hexdigest()


def dump(x):
    return (json.dumps(x,sort_keys=True,separators=(',',':'),allow_nan=False)+'\n').encode()


def freeze():
    b=(HERE/'gate.json').read_bytes();p=json.loads(b)
    for n,h in p['source_files'].items():assert digest((HERE/n).read_bytes())==h,n
    assert list(ROLES)==p['roles'] and p['cases']==[list(k) for k in KEYS]
    return p,digest(b)


def put(z,name,data):
    meta=zipfile.ZipInfo(name,(1980,1,1,0,0,0));meta.compress_type=zipfile.ZIP_DEFLATED;z.writestr(meta,data)


def build(output,source_dirs):
    p,hs=freeze();manifest={'protocol_sha':hs,'cases':KEYS,'roles':ROLES,'members':{},'fit':{}}
    with zipfile.ZipFile(output,'x') as z:
        for meter,d in zip(METERS,source_dirs):
            for name,(size,h) in p['input_artifacts'][meter].items():
                b=(d/name).read_bytes();assert len(b)==size and digest(b)==h,(meter,name)
            c=Cases(d);idx,y=training(d,c);v,theta=fit_models(c,idx,y);hold=np.flatnonzero(c.j%2==1)
            assert list(zip(c.s[hold]+1,c.j[hold]+1,c.p[hold]+4))==KEYS
            for role in ROLES:
                arr=np.asarray(v[role][hold],dtype='<f8',order='C')
                assert arr.shape==(48,25) and np.isfinite(arr).all() and np.max(abs(arr.max(axis=1)))<1e-10 and arr.min()>=-60.000001
                b=arr.tobytes();n=f'{meter}/{role}.f64le';put(z,n,b);manifest['members'][n]=digest(b)
            manifest['fit'][meter]=theta
        put(z,'manifest.json',dump(manifest))
    print(json.dumps({'forecast_sha':digest(output.read_bytes()),'bytes':output.stat().st_size,
           'full_role_arrays':28,'physical_take_predictions':1344,'partial_forecasts':33600,'target_WAVs_read':0,'member_sha':manifest['members']}))


def verify(path,expected):
    p,hs=freeze();b=path.read_bytes();assert digest(b)==expected
    forecast={};allnames={f'{m}/{r}.f64le' for m in METERS for r in ROLES}
    with zipfile.ZipFile(io.BytesIO(b)) as z:
        assert len(z.namelist())==29 and set(z.namelist())==allnames|{'manifest.json'}
        m=json.loads(z.read('manifest.json'))
        assert m['protocol_sha']==hs and m['cases']==list(map(list,KEYS)) and m['roles']==list(ROLES) and set(m['members'])==allnames
        for meter in METERS:
            forecast[meter]={}
            for role in ROLES:
                n=f'{meter}/{role}.f64le';b=z.read(n);assert len(b)==48*25*8 and digest(b)==m['members'][n]
                v=np.frombuffer(b,dtype='<f8').reshape(48,25)
                assert np.isfinite(v).all() and np.min(v)>=-60.000001 and np.max(abs(v.max(axis=1)))<1e-10
                forecast[meter][role]=v
    return forecast


def collect(archive,expected,out):
    # No target locator gets opened until every role has passed verification.
    verify(archive,expected);src=setup();out.mkdir(exist_ok=False)
    for idx,(s,j,pick) in enumerate(KEYS):
        name=f'string-{s}/{j}/{pick:02d}.wav';raw,clock=decode(src,name)
        observations={}
        for meter,fn in [('early',early_features),('stable',stable_features)]:
            try:
                z,m=fn(raw[None,:],s)
            except (ValueError,AssertionError) as e:
                failure={'index':idx,'path':name,'meter':meter,'refusal':repr(e),'forecast':expected}
                (out/f'refusal-{idx}.json').write_bytes(dump(failure));print(json.dumps(failure),flush=True);raise
            observations[meter]={'magnitude':abs(z[0]).tolist(),'shape_dB':shape(z[0]).tolist(),'metadata':m}
        stamp={'case':[s,j,pick],'source_lfs':src['roster'][name],'bwf_time_reference':clock,'forecast':expected,'measurements':observations}
        (out/f'{idx:02d}.json').write_bytes(dump(stamp))
        if (idx+1)%8==0:print(json.dumps({'target_cases_scored':idx+1}),flush=True)
    print(json.dumps({'source_obs_sha':{p.name:digest(p.read_bytes()) for p in sorted(out.glob('*.json'))},'n':48}))


def summarize(archive,expected,d):
    forecast=verify(archive,expected);rows={}
    assert {p.name for p in d.iterdir()}=={f'{i:02d}.json' for i in range(48)}
    for i,case in enumerate(KEYS):
        r=json.loads((d/f'{i:02d}.json').read_bytes());assert r['case']==list(case) and r['forecast']==expected
        for meter in METERS:
            obs=r['measurements'][meter];y=shape(np.asarray(obs['magnitude']))
            assert max(abs(y-np.asarray(obs['shape_dB'])))<1e-10
            err={role:forecast[meter][role][i]-y for role in ROLES}
            k=int(np.argmax(abs(err[PRIMARY])))
            raw={role:float(forecast[meter][role][i,k]) for role in ROLES}
            rows.setdefault(meter,[]).append({'case':list(case),'measurement':obs['metadata'],'loss':{role:float(np.sqrt(np.mean(x*x))) for role,x in err.items()},
                'worst_by_role':{role:[int(np.argmax(abs(x)))+1,float(np.max(abs(x)))] for role,x in err.items()},
                'candidate_worst_mode':{'mode':k+1,'measured_dB':float(y[k]),'fullscale_magnitude':float(obs['magnitude'][k]),'all_forecast_dB':raw}})
    groups={};results={}
    for m,rs in rows.items():
        def mean(ix):return {a:float(np.mean([r['loss'][a] for r in ix])) for a in ROLES}
        g={'all':mean(rs),'switch':{str(p):mean([r for r in rs if r['case'][2]==p]) for p in (4,5)},
           'string':{str(s):mean([r for r in rs if r['case'][0]==s]) for s in range(1,7)},
           'position_mm':{str(30+20*(j-1)):mean([r for r in rs if r['case'][1]==j]) for j in (2,4,6,8)}}
        best=min((r for r in ROLES if r!=PRIMARY),key=lambda a:g['all'][a])
        wins=sum(v[PRIMARY]<v[best] for v in g['string'].values())
        results[m]={'strongest_control':best,'strict_string_wins':wins,'lower_in_both_switches':all(v[PRIMARY]<v[best] for v in g['switch'].values()),
                    'mean_strict_win':g['all'][PRIMARY]<g['all'][best]}
        groups[m]=g
    primary=results['stable']
    return {'forecast_sha':expected,'row_metrics':rows,'group_metrics':groups,'gates':results,'joint_pass':primary['mean_strict_win'] and primary['lower_in_both_switches'] and primary['strict_string_wins']>=4,
            'status':'48 intact targets evaluated','early_endpoint':'Registered sensitivity diagnostic, excluded from joint decision.'}


if __name__=='__main__':
    p=argparse.ArgumentParser();sub=p.add_subparsers(dest='op',required=True)
    a=sub.add_parser('build');a.add_argument('archive',type=Path);a.add_argument('stable',type=Path);a.add_argument('early',type=Path)
    for name in ('collect','score'):
        a=sub.add_parser(name);a.add_argument('archive',type=Path);a.add_argument('sha');a.add_argument('observations',type=Path)
    args=p.parse_args()
    if args.op=='build':build(args.archive,[args.stable,args.early])
    elif args.op=='collect':collect(args.archive,args.sha,args.observations)
    else:print(json.dumps(summarize(args.archive,args.sha,args.observations),sort_keys=True))
