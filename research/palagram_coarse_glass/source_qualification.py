import collections, hashlib, json, pathlib
import h5py, numpy as np
root=pathlib.Path('.')
roles={'runs_CYRIL':'physical-1','runs_MARIE':'physical-2','runs_JEAN':'physical-3','runs_JULIEN':'simulation','runs_JULIEN2':'simulation'}
def text(v):
    if isinstance(v,bytes): return v.decode('utf-8','replace')
    if hasattr(v,'item') and v.size==1: return text(v.item())
    return str(v)
records=[]
for f in sorted(root.glob('data/input_data/runs*/*.nc')):
    r={'file':str(f),'family':roles[f.parent.name],'bytes':f.stat().st_size}
    if r['family']=='simulation':
        records.append(r);continue
    with h5py.File(f,'r') as h:
        r['attributes']={k:text(h.attrs[k]) for k in ['run_oldID','particle_type','set_up','surface_type','author','dataset','label','expe_type'] if k in h.attrs}
        r['available']=sorted(h.keys())
        r['inputs']={}
        for k in ['H0','H_a','L0','W0','rho_f','rho_p','rho_a','phi','alpha','d','nu_a','nu_f','T_a','T_f']:
            if k in h:
                v=np.array(h[k][()])
                assert v.size==1
                x=float(v.ravel()[0])
                r['inputs'][k]=[x if np.isfinite(x) else None,text(h[k].attrs.get('unit',''))]
        r['time_unit']=text(h['t'].attrs.get('unit',''))
        t=np.array(h['t'][:],dtype=float).ravel()
        r['time']=[len(t),float(t[0]),float(t[-1]),float(np.median(np.diff(t))),bool(np.all(np.diff(t)>0))]
        r['front_descriptor']=[list(h['x_front'].shape),text(h['x_front'].attrs.get('unit',''))]
    records.append(r)
print(json.dumps({'source':'d7559b7772e59c26358b9cd931f915e218de5dd9','roles':dict(collections.Counter(row['family'] for row in records)),'records':records,'front_arrays_read':0,'fit_members_read':0,'scope':'input-only source, geometry and time metadata'},sort_keys=True,separators=(',',':'),allow_nan=False))
