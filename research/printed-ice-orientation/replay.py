"""Replay the source/geometry admission decisions while keeping all orientation outcomes closed."""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import urllib.request

import numpy as np

from exact_winding import verify as exact_winding
from mesh_geometry import ARCHIVE_SHA,geometry,source_meshes
from mesh_forecast import clean_solid
from orientation_bounds import run as ellipsoid_bounds
from source_table import read_rows


HERE=Path(__file__).resolve().parent
URL='https://repository.nottingham.ac.uk/server/api/core/bitstreams/1e760ef6-a929-4a19-b556-c7630b14bd55/content'


def read_json(name):
    return json.loads((HERE/name).read_text())


def resolved(r):
    if r[1]-r[0]<.02:return [2]
    if r[2]-r[1]<.02:return [0]
    return [0,1,2]


def check_tensor(result):
    m=np.array(result['mass_tensor'])
    if not np.allclose(m,m.T,atol=1e-12):raise ValueError('non-symmetric recorded tensor')
    eig,vec=np.linalg.eigh(m)
    if np.min(eig)<=0 or not np.allclose(result['spectrum'],eig,atol=1e-11):
        raise ValueError('principal values disagree')
    rank=int((eig>=.985*eig[-1]).sum())
    if rank!=result['top_rank']:raise ValueError('leading-subspace dimension mismatch')
    # The stored basis of an isolated unoriented line can be verified directly.
    if rank==1:
        theta=np.rad2deg(np.arccos(np.clip(np.abs(vec[:,-1]),0,1)))
        if not np.allclose(theta,result['angles'],atol=1e-6):raise ValueError('principal line mismatch')
    return eig


def recount(raw,exact=True):
    if hashlib.sha256(raw).hexdigest()!=ARCHIVE_SHA:raise ValueError('unexpected archive')
    source=read_rows(raw);meshes=source_meshes(raw)
    if len(source)!=128 or set(meshes)!={r['name'] for r in source}:raise ValueError('source roster failed')
    labels={r['name']:r['ratios'] for r in source}
    counts=collections.Counter(r['name'] for r in source)
    geom={n:geometry(clean_solid(t)[0]) for n,t in meshes.items()}
    errors={n:float(np.max(abs(g['ratios']-labels[n]))) for n,g in geom.items()}
    if max(errors.values())>.002 or len({g['radial_fingerprint'] for g in geom.values()})!=20:raise ValueError('archived solid moment or distinct mesh gate failed')
    result={'source':{'sha256':ARCHIVE_SHA,'n_shapes':len(meshes),'n_rows':len(source),'counts':dict(sorted(counts.items())),
                      're_domain':[min(r['re'] for r in source),max(r['re'] for r in source)],
                      'source_ratio_max_error':max(errors.values())}}
    for name,file,field in [('voxel','frozen-geometry.json','grid'),('panels','frozen-panels.json','panel_outputs')]:
        d=read_json(file);good=d['records']
        missing={s.split()[1] for s in d['refusals']}
        if set(good)&missing or set(good)|missing!=set(meshes):raise ValueError(('incomplete attempted roster',name))
        results={}
        for n,r in good.items():
            a,b=r[field]
            e1,e2=check_tensor(a),check_tensor(b)
            comp=resolved(labels[n]);drift=float(np.abs(np.array(a['angles'])-b['angles'])[comp].mean())
            delta=float(np.linalg.norm(np.array(a['mass_tensor'])-b['mass_tensor'],ord=2))
            results[n]={'drift_deg':drift,'operator_difference':delta,'coarse_fine_top_gaps':[float(e1[-1]-e1[-2]),float(e2[-1]-e2[-2])]}
        result[name]={'completed':len(good),'refusals':sorted(missing),
                      'above_ten_degrees':sorted([n for n,v in results.items() if v['drift_deg']>10]),
                      'records':results,'full_roster_admitted':not missing and all(z['drift_deg']<=10 for z in results.values())}
    if result['voxel']['completed']!=15 or result['panels']['completed']!=9:raise ValueError('original completion counts changed')
    if result['voxel']['above_ten_degrees']!=['Ag,Cr14','Ag,Cr77','Ag,Cr92']:raise ValueError('original drift mismatches')
    if result['panels']['above_ten_degrees'] or result['panels']['full_roster_admitted']:raise ValueError('panel conclusion changed')
    fills=read_json('digital-fill-moments.json')
    if set(fills)!=set(meshes):raise ValueError('incomplete digital fill census')
    nonbinary=[];spread={};ratio_spread={}
    for n,d in fills.items():
        rules=list(d['alternatives'].values())
        volume=[r['volume'] for r in rules]
        spread[n]=(max(volume)-min(volume))/d['original']['volume']
        ratio_spread[n]=float(np.ptp(np.array([r['ratios'] for r in rules]),axis=0).max())
        if any(r['faces'] for r in d['levels']['-1']) or any(r['faces'] and r['level']>=2 for r in d['levels']['1']):
            nonbinary.append(n)
        if d['signed_reconstruction_relative']>1e-10:raise ValueError(('reconstructed digital moments',n))
    if len(nonbinary)!=12:raise ValueError('winding cell count changed')
    result['digital_fills']={'nonbinary_shapes':sorted(nonbinary),'largest_volume_spread_shape':max(spread,key=spread.get),
                             'largest_relative_volume_spread':max(spread.values()),'largest_absolute_inertia_spread':max(ratio_spread.values())}
    result['ellipsoid']=ellipsoid_bounds()
    if exact:result['exact_winding']=exact_winding(meshes)
    result['empirical_orientation_rows_scored']=0
    return result


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--archive',type=Path,help='original Nottingham ZIP; downloaded from the official repository when omitted')
    args=p.parse_args()
    if args.archive:
        raw=args.archive.read_bytes()
    else:
        with urllib.request.urlopen(URL,timeout=100) as r:raw=r.read(792964)
    print(json.dumps(recount(raw),indent=2,sort_keys=True))


if __name__=='__main__':
    main()
