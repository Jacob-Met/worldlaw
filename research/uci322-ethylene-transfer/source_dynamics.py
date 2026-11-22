"""Describe source-only repeated transition evidence and its causal limitations."""
from pathlib import Path
import json
import sys
import numpy as np


def summarize(root,gas):
    x=np.load(root/f'training-view-{gas}.npz',allow_pickle=False)['rows']
    t=x[:,0];vals=x[:,3:];q=x[:,1:3]
    scale=np.quantile(vals,.75,axis=0)-np.quantile(vals,.25,axis=0);scale[scale<1e-9]=1.
    norm=vals/scale;edges=np.flatnonzero(np.any(np.diff(q,axis=0)!=0,axis=1))+1
    grouped={};traj={'co_only':[],'ethylene_only':[]}
    for i in edges:
        old,new=q[i-1],q[i]
        if np.count_nonzero(new-old)!=1:continue
        idx=np.searchsorted(t,t[i]+np.array([-15.,-5.,1.,5.,15.,45.,60.,75.]))
        a,b,f1,f5,f15,f45,c,d=idx
        if a==0 or d>=len(x) or np.any(q[a:i]!=old) or np.any(q[i:d]!=new):continue
        pre=norm[a:b].mean(axis=0);late=norm[c:d].mean(axis=0);v=late-pre
        norm2=v@v
        if norm2==0:continue
        key='co_only' if old[0]!=new[0] else 'ethylene_only'
        traj[key].append(((norm[[f1,f5,f15,f45]]-pre)@v/norm2).tolist())
        ident=tuple(np.r_[old,new].tolist())
        grouped.setdefault(ident,[]).append((float(t[i]),late))
    pairs=[]
    for key,events in grouped.items():
        if len(events)<2:continue
        ta,first=events[0];tb,last=events[-1]
        pairs.append(dict(before=key[:2],after=key[2:],repeats=len(events),first_t=ta,last_t=tb,
            delta_hours=(tb-ta)/3600,normalized_RMS_movement=float(np.linalg.norm(last-first)/4),
            first_raw_4=(first*scale)[:4].tolist(),last_raw_4=(last*scale)[:4].tolist()))
    pairs.sort(key=lambda v:v['normalized_RMS_movement'],reverse=True)
    profile={key:{'events':len(v),'median_projected_progress':np.median(v,axis=0).tolist()} for key,v in traj.items()}
    return dict(matched_groups=len(pairs),matches=pairs,lag_seconds=[1,5,15,45],source_response_shape=profile)


if __name__=='__main__':
    root=Path(sys.argv[1]);out={g:summarize(root,g) for g in ('CO','methane')}
    (root/'source-dynamics.json').write_text(json.dumps(out,indent=2,allow_nan=False))
    for g,v in out.items():print(g,v['matched_groups'],v['matches'][:1],v['source_response_shape'],flush=True)
