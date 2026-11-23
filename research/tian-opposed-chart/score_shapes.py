"""Score every sealed float32 forecast on its immutable measured chart crop."""
import base64
import hashlib
import json
from pathlib import Path
import sys
import zlib

import numpy as np
from verify_lock import checked,sha,ROLES

N=65536
def unit(a):
    n=np.linalg.norm(a)
    return a/n if n else np.zeros_like(a)
def shape(a):
    return unit(a-a.mean())
def projected(a,u):
    r=a-u*float(a@u)
    n=np.linalg.norm(r)
    return r/n if n>1e-7 else np.zeros_like(a)
def value(rec,field,idx):
    return float(rec[field][idx])

def main():
    split_path,lockdir,ldigest,sourcedir,helddir,hdigest=sys.argv[1:]
    split,lock=checked(split_path,lockdir,ldigest)
    root=Path(lockdir);source=Path(sourcedir);held=Path(helddir)
    sr=(source/'receipts.json').read_bytes();hr=(held/'receipts.json').read_bytes()
    assert sha(sr)==lock['tile_receipt_sha256'] and sha(hr)==hdigest
    measured={'source':json.loads(sr),'held':json.loads(hr)}
    assert set(map(int,measured['held']))==set(lock['target_ids'])
    u=np.fromfile(root/'source-common.f64le',dtype='<f8')
    assert u.size==N and abs(np.linalg.norm(u)-1)<1e-12
    roles=sorted(ROLES)
    data={r:np.memmap(root/(r+'.f32le'),dtype='<f4',mode='r',shape=(98,N)) for r in roles}
    rows=[];details={};worst={}
    for j,p in enumerate(lock['pairs']):
        coords=split['frames'][str(p['target'])]['led_xy']
        rr={}
        for kind,where,i in [('donor',source,p['donor']),('target',held,p['target'])]:
            b=(where/f'{i:03}.u16le').read_bytes()
            assert len(b)==2*N and sha(b)==measured['source' if kind=='donor' else 'held'][str(i)]['raw_roi_sha256']
            rr[kind]=np.frombuffer(b,'<u2').astype(np.float64)
        a=rr['target'];b=rr['donor'];y=shape(a);yu=projected(y,u)
        r2=sum(v*v for v in coords);na=4000*np.sqrt(r2)/np.sqrt(67500**2+4000**2*r2)
        rms=float(np.std(a));drms=float(np.std(b));norm_weight=min(1.,rms**2)
        row={'target':p['target'],'donor':p['donor'],'pair_id':p['pair_id'],'xy':coords,'r2':r2,'NA':float(na),'brightfield':bool(na<.1),
             'bin': '<=1' if rms<=1 else '1..4' if rms<=4 else '4..16' if rms<=16 else '>16',
             'target_minmax':[int(a.min()),int(a.max())],'donor_minmax':[int(b.min()),int(b.max())],
             'target_mean_DN':float(a.mean()),'target_rms_DN':rms,'donor_mean_DN':float(b.mean()),'donor_rms_DN':drms,
             'target_stored_limits':int(np.count_nonzero((a==0)|(a==65535))),'scores':{}}
        predictions={r:np.asarray(z[j],dtype=np.float64) for r,z in data.items()}
        for role,v in predictions.items():
            diff=v-y
            err=float(diff@diff);du=projected(v,u)-yu
            row['scores'][role]={'primary':err,'common_removed':float(du@du),'floor_sensitivity':norm_weight*err}
            if role not in worst or err>worst[role][0]:
                idx=int(np.argmax(np.abs(diff)))
                worst[role]=(err,p['target'])
                details[role]={'target':p['target'],'donor':p['donor'],'sensor_row_col':[952+idx//256,1152+idx%256],
                              'raw_target_DN':int(a[idx]),'raw_donor_DN':int(b[idx]),'unit_target':float(y[idx]),
                              'donor_z':float((b[idx]-b.mean())/drms) if drms else 0.,
                              'target_z':float((a[idx]-a.mean())/rms) if rms else 0.,
                              'all_predictions_at_same_pixel':{r:float(z[idx]) for r,z in predictions.items()}}
        rows.append(row)
    by_target={row['target']:row for row in rows}
    for item in details.values():
        row=by_target[item['target']]
        item['all_same_pair_scores']=row['scores']
    def table(sub):
        return {r:{f:float(np.mean([x['scores'][r][f] for x in sub])) for f in ('primary','common_removed','floor_sensitivity')} for r in roles} if sub else {}
    means=table(rows);cand=lock['prespecified_primary']
    best=min((r for r in roles if r!=cand),key=lambda r:(means[r]['primary'],r))
    wins=sum(x['scores'][cand]['primary']<x['scores'][best]['primary'] for x in rows)
    summaries={r:{'median':float(np.median([x['scores'][r]['primary'] for x in rows])),'max':worst[r][0],'worst_target':worst[r][1]} for r in roles}
    strata={}
    for tag,pred in [('brightfield',lambda r:r['brightfield']),('darkfield',lambda r:not r['brightfield'])]+[(k,lambda r,k=k:r['bin']==k) for k in ('<=1','1..4','4..16','>16')]:
        sub=[r for r in rows if pred(r)];strata[tag]={'n':len(sub),'mean':table(sub)}
    out={'prediction_lock':ldigest,'held_receipt':hdigest,'source_receipt':sha(sr),'rows':rows,'mean':means,
         'partial_order':summaries,'strata':strata,'worst':details,'constant_target_count':sum(x['target_rms_DN']==0 for x in rows),
         'primary':cand,'best_comparator':best,'wins_over_best_comparator':wins,'joint_pass':means[cand]['primary']<means[best]['primary'] and wins>=50}
    raw=(json.dumps(out,sort_keys=True,separators=(',',':'))+'\n').encode()
    (held/'physical-score.json').write_bytes(raw)
    summary={'mean':{r:means[r]['primary'] for r in roles},'best':best,'wins':wins,'joint_gate':out['joint_pass'],'source_common_mean':{r:means[r]['common_removed'] for r in roles},'worst_candidate':details[cand],'strata_counts':{k:x['n'] for k,x in strata.items()}}
    print('COMPLETE_SCORE',len(raw),sha(raw),json.dumps(summary,sort_keys=True),flush=True)
    print('COMPRESSED_SCORE',base64.b64encode(zlib.compress(raw,9)).decode(),flush=True)
if __name__=='__main__':main()
