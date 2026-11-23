"""Verify all 42 locked arrays before selecting any held nut values."""
import hashlib, json, sys
from pathlib import Path
import numpy as np
from acquisition import parse,read_raw
from forecast import HELD,ROLES,prep,rms

def main(base,dest,lock_sha):
    p=Path(dest);lock=(p/'forecast-lock.json').read_bytes()
    assert hashlib.sha256(lock).hexdigest()==lock_sha
    m=json.loads(lock);assert m['held_ids']==list(HELD) and m['roles']==list(ROLES)
    assert set(m['files'])=={f'stroke-{i:02d}.npz' for i in HELD}
    frozen={}
    for i in HELD:
        n=f'stroke-{i:02d}.npz';meta=m['files'][n];b=(p/n).read_bytes()
        assert len(b)==meta['bytes'] and hashlib.sha256(b).hexdigest()==meta['sha256']
        with np.load(p/n,allow_pickle=False) as z:
            assert set(z.files)==set(ROLES)
            frozen[i]={r:z[r].astype(float) for r in ROLES}
        assert all(v.shape==(meta['rows_5k'],) and np.isfinite(v).all() for v in frozen[i].values())
    rows={};raw_worst={};truth_arrays={}
    for meta,raw in read_raw(base,HELD):
        i=meta['index'];n=f'stroke-{i:02d}.npz';reg=m['files'][n];assert reg['source_member_sha256']==meta['sha256']
        q=parse(raw,usecols=(1,2,3));assert np.isfinite(q).all();y=prep(q[:,2])[::10];truth_arrays[str(i)]=y
        arms=frozen[i];onset=reg['onset_5k'];rows[i]={'n':len(y),'onset':onset,'beta':meta['beta'],'whole':{},'onset100ms':{},'pre_motion':{}}
        assert len(y)==reg['rows_5k']
        for split,win in [('whole',slice(None)),('onset100ms',slice(onset,onset+500)),('pre_motion',slice(0,onset))]:
            for role,x in arms.items():
                v=x[win];u=y[win];e=v-u
                rows[i][split][role]={'rmse_N':rms(e),'mae_N':float(np.mean(abs(e))),'max_abs_N':float(np.max(abs(e))),'samples':len(e)}
        for role,x in arms.items():
            j=int(np.argmax(abs(x-y)));err=abs(float((x-y)[j]))
            if role not in raw_worst or err>raw_worst[role]['abs_N']:
                raw_worst[role]={'id':i,'idx_5k':j,'abs_N':err,'time_s':j/5000,'source_50k_raw_speed_bridge_nut':q[10*j].tolist(),'neighbor_samples':[{'idx':l,'filtered_truth':float(y[l]),'forecasts':{r:float(a[l]) for r,a in arms.items()}} for l in range(max(0,j-3),min(len(y),j+4))]}
    summary={split:{r:float(np.mean([rows[i][split][r]['rmse_N'] for i in HELD])) for r in ROLES} for split in ('whole','onset100ms','pre_motion')}
    c='mechanics_filter';ctrls=['source_geometry','direct_fir','long_fir','signed_half_period']
    gate={};metric=summary['whole'];gate['mean_rmse_below_all_controls']=all(metric[c]<metric[r] for r in ctrls)
    counts={r:sum(rows[i]['whole'][c]['rmse_N']<rows[i]['whole'][r]['rmse_N'] for i in HELD) for r in ctrls}
    # Compare the onset to the stronger source-development-selected empirical FIR; no held best selection for this arm.
    fir=['direct_fir','long_fir'];best=min(fir,key=lambda r:np.mean(m['development']['/'.join(map(str,m['selected'][r]))]))
    gate['at_least_four_whole_wins_each']=all(v>=4 for v in counts.values())
    ons=sum(rows[i]['onset100ms'][c]['rmse_N']<rows[i]['onset100ms'][best]['rmse_N'] for i in HELD)
    gate['at_least_four_onset_wins']=ons>=4;gate['pass']=all(gate.values())
    np.savez_compressed(p/'scored-targets.npz',**truth_arrays)
    result={'source_lock':lock_sha,'selected_FIR_control':best,'summary':summary,'whole_wins':counts,'onset_wins':ons,'gate':gate,'worst':raw_worst,'rows':rows,'truth_sha256':hashlib.sha256((p/'scored-targets.npz').read_bytes()).hexdigest()}
    (p/'score.json').write_text(json.dumps(result,sort_keys=True,separators=(',',':'))+'\n')
    print(json.dumps(result,sort_keys=True))
if __name__=='__main__':main(*sys.argv[1:])
