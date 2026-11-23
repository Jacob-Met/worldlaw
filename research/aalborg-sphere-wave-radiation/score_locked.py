"""Receive a fixed forecast archive before decoding the four experimental gauge panels."""
import argparse
import hashlib
import io
import json
from pathlib import Path
from urllib.request import urlopen
import zipfile
import numpy as np

URL="https://www.oceanenergysystems.org/documents/55575-datafile.zip/"
SHA="04c4d78d6987e4eec6c31d692d3c5cf5adea2580ffcfe50fbbd44e6589c7623f"
TIMES=np.arange(3025)/500
FAMILIES=('constant_area','cap_tied','opposite_cubic','free_pair','free_asymmetric')
VENDORS=('RANS2','RANS3','RANS4','RANS5')
RELEASE=('zero','height_pooled','height_latest','height_quadratic','height_cubic')


def digest(b):
    return hashlib.sha256(b).hexdigest()


def receive(directory,lock_sha,registry_sha):
    registry=(directory/'forecast-registry.json').read_bytes()
    assert digest(registry)==registry_sha
    record=json.loads(registry)
    assert record['source_sha256']==SHA and record['high_experimental_gauge_columns_parsed']==0
    content=(directory/'forecast-lock.npz').read_bytes()
    assert digest(content)==lock_sha==record['archive_sha256'] and len(content)==record['archive_bytes']
    roster=set(['motion_'+k for k in (*FAMILIES,'dev_convex','other_repeat_cap')]+['release_'+k for k in RELEASE])
    vendor_shapes={}
    for v in VENDORS:
        assert v in record['vendors']
        expected=['clock','submitted']
        if record['vendors'][v]['paired_heave_roles'] is True:expected+=['constant_area','cap_tied','free_pair','dev_convex']
        for k in expected:
            name='solver_'+v+'_'+k
            roster.add(name)
            n=record['vendors'][v]['matched_rows']
            vendor_shapes[name]=(n,) if k=='clock' else (n,3)
    arrays={}
    with zipfile.ZipFile(io.BytesIO(content)) as archive:
        assert len(archive.namelist())==len(roster) and set(archive.namelist())=={n+'.npy' for n in roster}
        assert set(record['members'])==roster
        for name in sorted(roster):
            raw=archive.read(name+'.npy');shape,sha=record['members'][name]
            assert digest(raw)==sha
            a=np.load(io.BytesIO(raw),allow_pickle=False)
            expected=(4,3025,3) if name.startswith('motion_') else (3025,3)
            assert list(a.shape)==shape and a.shape==vendor_shapes.get(name,expected) and a.dtype==np.dtype('<f8') and np.isfinite(a).all()
            arrays[name]=a
    return arrays


def measured():
    with urlopen(URL,timeout=45) as response: data=response.read(17549046)
    assert len(data)==17549045 and digest(data)==SHA
    ys=[]
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        for i in range(1,5):
            with archive.open(f'Datafile/Experimental results/05D_Measured{i}_Raw.txt') as f:
                header=f.readline().decode('utf-8-sig')
                assert all(label in header for label in ('t','x3','WG1','WG2','WG3'))
                a=np.loadtxt(f,usecols=(0,2,3,4))
            a=a[a[:,0]>=0]
            assert np.array_equal(a[:,0],TIMES) and np.isfinite(a).all()
            ys.append(a[:,1:])
    return np.stack(ys)


def rms(a,axis=None):
    return np.sqrt(np.mean(a*a,axis=axis))


def score(name,grid,predictions,truth):
    if predictions.ndim==2:
        predictions=np.broadcast_to(predictions,truth.shape)
    assert predictions.shape==truth.shape
    e=predictions-truth
    i,t,g=np.unravel_index(np.argmax(np.abs(e)),e.shape)
    periods={}
    for label,mask in [('early',grid<=4.56),('later',grid>4.56)]:
        periods[label]=float(rms(e[:,mask])) if mask.any() else None
    return dict(name=name,rows=len(grid),clock_s=[float(grid[0]),float(grid[-1])],
        rms_m=float(rms(e)),per_repeat_m=rms(e,(1,2)).tolist(),per_gauge_m=rms(e,(0,1)).tolist(),
        per_repeat_gauge_m=rms(e,1).tolist(),split_rms_m=periods,
        worst=dict(rep=int(i)+1,t=float(grid[t]),gauge=int(g)+1,pred_m=float(predictions[i,t,g]),
                   actual_m=float(truth[i,t,g]),error_m=float(e[i,t,g])))


def main(directory,lock_sha,registry_sha):
    arrays=receive(directory,lock_sha,registry_sha)
    truth=measured()
    rows={}
    for name,a in arrays.items():
        if name.endswith('_clock'): continue
        if name.startswith('solver_'):
            v=name.split('_')[1]
            grid=arrays['solver_'+v+'_clock'];ix=np.searchsorted(TIMES,grid)
            assert np.array_equal(TIMES[ix],grid)
        else: grid=TIMES;ix=np.arange(len(grid))
        rows[name]=score(name,grid,a,truth[:,ix,:])
    cand=rows['motion_cap_tied']
    comp=['motion_'+f for f in ['constant_area','opposite_cubic','free_pair','free_asymmetric','dev_convex','other_repeat_cap']]
    gates={}
    for k in comp:
        ctr=rows[k]
        gates[k]=[cand['rms_m']<ctr['rms_m'],
            int(np.sum(np.array(cand['per_gauge_m'])<ctr['per_gauge_m'])),
            int(np.sum(np.array(cand['per_repeat_m'])<ctr['per_repeat_m']))]
    worst=cand['worst'];i=worst['rep']-1;j=np.searchsorted(TIMES,worst['t']);g=worst['gauge']-1
    match={}
    for name,a in arrays.items():
        if name.endswith('_clock'): continue
        row=j
        if name.startswith('solver_'):
            grid=arrays['solver_'+name.split('_')[1]+'_clock']
            row=int(np.searchsorted(grid,TIMES[j]))
            if row==len(grid) or grid[row]!=TIMES[j]: continue
        pred=a[i,row,g] if a.ndim==3 else a[row,g]
        match[name]=float(pred)
    results={'archive_sha':lock_sha,'registry_sha':registry_sha,'rows':rows,'primary_gate':gates,
        'primary_passed':all(v[0] and v[1]>=2 and v[2]>=3 for v in gates.values()),
        'worst_same_cell_forecasts_m':match,'worst_measured_episode':truth[i,max(0,j-4):min(3025,j+5)].tolist(),
        'worst_episode_grid_s':TIMES[max(0,j-4):min(3025,j+5)].tolist(),
        'truth_sha256':digest(np.asarray(truth,dtype='<f8').tobytes())}
    out=directory/'score-original.json'
    if out.exists(): raise RuntimeError('Existing score original')
    out.write_text(json.dumps(results,sort_keys=True)+'\n')
    for k,row in rows.items(): print(json.dumps(row,separators=(',',':')),flush=True)
    print(json.dumps({k:v for k,v in results.items() if k!='rows'}),flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('directory',type=Path);p.add_argument('archive_sha');p.add_argument('registry_sha')
    a=p.parse_args();main(a.directory,a.archive_sha,a.registry_sha)
