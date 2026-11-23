"""Locked six-mass-to-subset transfer. Source arrays only; no smaller state is accepted."""
import hashlib
import json
import sys
from pathlib import Path
import numpy as np

def hash_file(stream, name):
    h = hashlib.new(name)
    with stream:
        for block in iter(lambda: stream.read(1048576), b''):
            h.update(block)
    return h


PORTS = np.array([16,45,50,66,94,115,121])
SITES = np.array([19,27,68,74,106,124])
SETS = [[3],[0,3,5],[0,1,3,5],[0,1,2,3,5]]
ARMS = ['subset_resolvent','healthy','six_core_scaled','author_all_nodes_scaled',
        'subset_spatial_composed','truncate_core_diagonal','inverse_core_diagonal','direct_diagonal_ls']


def norm(x):
    return float(np.linalg.norm(x))


def reciprocal_defect(x):
    denominator=norm(x)
    return norm(x-x.T)/denominator if denominator else float('inf')


def matrix_statistics(x):
    u,s,vh=np.linalg.svd(x,full_matrices=False)
    return s, vh[-1].conj()


def pair(z):
    return [float(z.real),float(z.imag)]


def witness(x):
    a=np.asarray(x)
    return {'shape':list(a.shape),'entries':[pair(z) for z in a.reshape(-1)]}


def spectrum(s):
    return [float(x) for x in s]


def held(x):
    return np.concatenate([x[6,:],x[:6,6]])


def fit_gain(h):
    ref=np.max(np.abs(h-np.diag(np.diag(h))))
    rows=[]
    for i in range(7):
        for j in range(i+1,7):
            a,b=h[i,j],h[j,i]
            if ref==0 or min(abs(a),abs(b))<1e-6*ref or min(abs(a),abs(b))==0:continue
            row=np.zeros(7,dtype=complex)
            row[i]=a;row[j]=-b
            rows.append(row/max(abs(a),abs(b)))
    if len(rows)<6:return None,{'reason':'healthy_gain_edges','n_edges':len(rows)}
    eq=np.array(rows)
    sol,_,rank,s=np.linalg.lstsq(eq[:,1:],-eq[:,0],rcond=None)
    w=np.r_[1.,sol]
    if rank!=6 or s[-1]<1e-3*s[0]:
        return None,{'reason':'healthy_gain_design','s':spectrum(s)}
    if min(abs(w))==0 or max(abs(w))>10*min(abs(w)):
        return None,{'reason':'healthy_gain_magnitude','gain':witness(w)}
    defect=reciprocal_defect(h/w)
    if defect>.2:return None,{'reason':'healthy_reciprocity','defect':defect,'gain':witness(w)}
    return w,{'gain':witness(w),'healthy_defect':defect}


def packed(raw_path):
    import zipfile
    with np.load(raw_path,allow_pickle=False) as a:
        b=a['frf']
    return b


def course(directory):
    base=directory/'baseline.npz'
    with np.load(base,allow_pickle=False) as z:
        assert np.array_equal(z['probing_nodes'].reshape(-1),PORTS)
        frequency=z['frequency'].reshape(-1)
        y=z['frf']
        assert y.shape==(7,144,8192) and frequency.shape==(8192,)
    # Full six-mass NPZ may be deserialized; only this copied 6×6 projection enters fitting.
    with np.load(directory/'6 masses.npz',allow_pickle=False) as z:
        assert np.array_equal(z['mass_nodes'].reshape(-1),SITES)
        six=z['frf'][:6,:6,:].copy()
    out=np.lib.format.open_memmap(directory/'forecasts.npy',mode='w+',dtype=np.complex128,shape=(4,8,13,8192))
    success=np.zeros((4,8192),bool)
    import collections
    counts=[collections.Counter() for _ in SETS]
    worst={}
    def inspect(label, value, f, details):
        if label not in worst or value>worst[label]['severity']:
            worst[label]={'severity':float(value),'index':f,'hz':float(frequency[f]),**details}
    for f in range(8192):
        h=y[:,PORTS,f]; b=y[:,SITES,f]; delta0=six[:,:,f]-h[:6,:6]
        if not (np.isfinite(h).all() and np.isfinite(b).all() and np.isfinite(delta0).all()):
            raise ValueError('nonfinite authenticated source at bin '+str(f))
        out[:,:,:,f]=held(h)
        w,quality=fit_gain(h)
        s,weak=matrix_statistics(b[:6])
        relative=s[-1]/s[0] if s[0] else 0.
        inspect('weakest_calibration_field',1-relative,f,{'singular_values':spectrum(s),'weak_site_vector':witness(weak),'healthy_field':witness(b),'observed_calibration_delta':witness(delta0)})
        reason=quality.get('reason')
        if reason=='healthy_reciprocity':
            inspect('largest_healthy_reciprocity_defect',quality['defect'],f,{'healthy_ports':witness(h),**quality})
        if not reason and (s[0]==0 or relative<1e-3):reason='healthy_field_rank'
        if not reason:
            delta=delta0/w[:6]
            def0=reciprocal_defect(delta)
            if np.isfinite(def0):inspect('largest_changed_reciprocity_defect',def0,f,{'changed_difference':witness(delta),'gain':witness(w)})
            if def0>.30:reason='changed_reciprocity'
        if reason:
            for cnt in counts:cnt[reason]+=1
            continue
        sym=(delta+delta.T)/2
        bi=np.linalg.inv(b[:6])
        core=bi@sym@bi.T
        st,_=matrix_statistics(core)
        if st[0]==0 or st[-1]<1e-3*st[0]:
            for cnt in counts:cnt['full_core_rank']+=1
            continue
        inverse=np.linalg.inv(core)
        dictionary=np.stack([np.outer(v,v).reshape(-1) for v in b[:6].T],axis=1)
        diagonal=np.linalg.lstsq(dictionary,sym.reshape(-1),rcond=None)[0]
        all_field=y[:,:,f]
        # Author's np.linalg.lstsq here composes two one-sided, all-node fits.
        extension=all_field@np.linalg.lstsq(all_field[:6],np.eye(6),rcond=None)[0]
        for k,idx in enumerate(SETS):
            rem=[x for x in range(6) if x not in idx]
            aa=np.ix_(idx,idx); ar=np.ix_(idx,rem); rr=np.ix_(rem,rem)
            sr,_=matrix_statistics(core[rr])
            if sr[0]==0 or sr[-1]<max(sr[0]*1e-3,st[0]*1e-4):
                counts[k]['removed_block_rank']+=1;continue
            small=core[aa]-core[ar]@np.linalg.solve(core[rr],core[ar].T)
            a=b[:,idx]; p=a@np.linalg.pinv(a[:6]); factor=len(idx)/6
            inv_diag=np.diag(inverse)[idx]
            if np.any(inv_diag==0):
                counts[k]['nonfinite_control']+=1;continue
            predictions=[a@small@a.T,np.zeros((7,7),complex),factor*(b@core@b.T),
                         factor*(extension@sym@extension.T),p@sym@p.T,
                         (a*np.diag(core)[idx])@a.T,(a*(1/inv_diag))@a.T,(a*diagonal[idx])@a.T]
            row=np.stack([held(h+v*w) for v in predictions])
            if not np.isfinite(row).all():
                counts[k]['nonfinite_output']+=1;continue
            out[k,:,:,f]=row;success[k,f]=True;counts[k]['admitted']+=1
    out.flush()
    quarter=success.reshape(4,4,2048).sum(axis=2)
    admission=bool((success.sum(axis=1)>=4096).all() and (quarter>=512).all())
    report={'source_only_gate':admission,'arms':ARMS,'train_bins':8192,'held_smaller_inputs_opened':0,
            'held_port':121,'quarter_counts':quarter.tolist(),'counts':counts,'source_worst':worst,
            'numpy':np.__version__,'forecast_sha256':hash_file(open(directory/'forecasts.npy','rb'),'sha256').hexdigest()}
    (directory/'source_report.json').write_text(json.dumps(report,sort_keys=True,allow_nan=False))
    np.save(directory/'source_admission.npy',success)
    return report


if __name__=='__main__':
    data=course(Path(sys.argv[1]))
    print(json.dumps({k:v for k,v in data.items() if k!='source_worst'},sort_keys=True),flush=True)
